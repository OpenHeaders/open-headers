/**
 * `InspectorFacet` — pure UI projection over `RequestLifecycle[]`.
 *
 * The lifecycle store is the single source of truth; this facet shapes
 * those lifecycles into the rows the network panel renders. Pure: same
 * input → same output, no subscriptions, no IO. Consumers wrap it in a
 * `useMemo` over `store.getSnapshot().ordered`.
 *
 * Concerns owned here (and nowhere else in the panel):
 *   - **Stable sort key.** `startedAtMs` ascending, with discovery order
 *     (the order requests entered the log) as the tiebreaker — the host
 *     breaks exact start-time ties by insertion order, not by id. A naive
 *     `requestId` string compare mis-orders the burst of requests a page
 *     fires in one tick (CDP ids like `…​.10` sort before `…​.4`).
 *   - **Display id.** 1-indexed sequence after consolidation; the legacy
 *     panel showed `#42`-style ids and the network UX leans on a stable
 *     compact identifier the user can reference verbally.
 *   - **Redirect un-folding.** A redirect chain is one lifecycle with its
 *     hops in `har[]` (invariant 4). The table shows each hop as its own
 *     row, so every intermediate hop is expanded into a synthetic single-hop
 *     row (see `redirect-hop-rows.ts`) emitted just before the real final
 *     row, numbered consecutively.
 *   - **Retry consolidation.** When a failed lifecycle is immediately
 *     followed by a same-(url, method) restart inside a short window,
 *     collapse the pair so the table doesn't show a flicker of the
 *     intermediate failure. Opt-in via `opts.consolidateRetries` because
 *     replay (post-reconnect) should NOT consolidate — every prior
 *     lifecycle was a real, observed attempt.
 *
 * Intentionally NOT here: cookie / header insights, timing breakdowns,
 * search indexing. Those are downstream of rows and live in their own
 * modules.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { synthesizeRedirectHopLifecycles } from './redirect-hop-rows';

export interface InspectorRow {
  readonly lifecycle: RequestLifecycle;
  /** 1-indexed sequence number (1, 2, 3, …); UI prepends `#` when rendering. */
  readonly displayId: number;
  /**
   * Prior-attempt `requestId`s collapsed into this row by retry
   * consolidation. Empty when consolidation is off or the row is not a
   * retry. Always ordered oldest → newest attempt.
   */
  readonly consolidatedRetryOf: readonly string[];
  /**
   * True when the row is a synthetic redirect-hop row (the `302` leg of a
   * chain), not the real final-hop lifecycle. The Type cell appends
   * `/ Redirect` for these — host parity. Absent (falsy) on every real row.
   */
  readonly isRedirectHop?: boolean;
}

export interface BuildInspectorRowsOptions {
  /**
   * When true, a `failed` lifecycle immediately followed (in sort order)
   * by a same-`(url, method)` restart inside {@link retryWindowMs} is
   * collapsed into the retry row. Default: `false` — opt in from the
   * call site that wants the consolidated view.
   */
  readonly consolidateRetries?: boolean;
  /**
   * Maximum gap in wall-clock milliseconds between the failed attempt's
   * `completedAtMs` and the retry's `startedAtMs` to count as a retry.
   * Default: 250ms — wide enough for browser auto-retry, narrow enough
   * that an unrelated request to the same URL is not mistaken for one.
   */
  readonly retryWindowMs?: number;
}

const DEFAULT_RETRY_WINDOW_MS = 250;

/** Stable sort key — `startedAtMs` first, `requestId` as tiebreaker. */
export function inspectorSortKey(lifecycle: RequestLifecycle): number {
  return lifecycle.startedAtMs;
}

/**
 * Build the network table rows from a lifecycle snapshot. Pure; safe to
 * call inside `useMemo` over `store.getSnapshot().ordered`.
 */
export function buildInspectorRows(
  lifecycles: readonly RequestLifecycle[],
  opts: BuildInspectorRowsOptions = {},
): readonly InspectorRow[] {
  // Request # is discovery order — the order requests entered the log
  // (`lifecycles` arrives in store insertion order, oldest first).
  // Numbering off the input rather than the time-sorted projection means
  // sorting the table never renumbers: under a start-time sort the column
  // reads scrambled, the way the browser's own Request # column does.
  //
  // A redirect chain's hops entered the log before its final hop, so each
  // hop is numbered consecutively just ahead of its final lifecycle (302=#k,
  // 200=#k+1) — host-exact. Synthetic ids are deterministic, so the same id
  // numbered here matches the one emitted in the display expansion below.
  const discoveryRank = new Map<string, number>();
  const rank = (id: string): void => {
    if (!discoveryRank.has(id)) discoveryRank.set(id, discoveryRank.size + 1);
  };
  for (const lc of lifecycles) {
    for (const hop of synthesizeRedirectHopLifecycles(lc)) rank(hop.requestId);
    rank(lc.requestId);
  }
  // Discovery rank doubles as the start-time tiebreak (host-exact): exact
  // ties resolve to insertion order, never a `requestId` string compare.
  const rankOf = (lc: RequestLifecycle): number => discoveryRank.get(lc.requestId) ?? Number.MAX_SAFE_INTEGER;

  const sorted = [...lifecycles].sort((a, b) => a.startedAtMs - b.startedAtMs || rankOf(a) - rankOf(b));
  const projected = opts.consolidateRetries
    ? consolidateRetries(sorted, opts.retryWindowMs ?? DEFAULT_RETRY_WINDOW_MS)
    : sorted.map(asUnconsolidated);

  // Un-fold each lifecycle into [hop0 … hopN-1 synthetic rows, real final
  // row], consecutive and in hop order so the table renders the redirect leg
  // immediately before its destination. Retry consolidation already chose
  // the surviving final lifecycle; its hops follow it.
  const rows: InspectorRow[] = [];
  for (const entry of projected) {
    const lc = entry.lifecycle;
    for (const hop of synthesizeRedirectHopLifecycles(lc)) {
      rows.push({
        lifecycle: hop,
        displayId: discoveryRank.get(hop.requestId) ?? 0,
        consolidatedRetryOf: [],
        isRedirectHop: true,
      });
    }
    rows.push({
      lifecycle: lc,
      displayId: discoveryRank.get(lc.requestId) ?? 0,
      consolidatedRetryOf: entry.consolidatedRetryOf,
    });
  }
  return rows;
}

interface ConsolidationEntry {
  readonly lifecycle: RequestLifecycle;
  readonly consolidatedRetryOf: readonly string[];
}

function asUnconsolidated(lifecycle: RequestLifecycle): ConsolidationEntry {
  return { lifecycle, consolidatedRetryOf: [] };
}

/**
 * Walk `sorted` once; when a `failed` lifecycle is immediately followed
 * by a same-`(url, method)` restart inside `windowMs`, swallow the
 * failure into the retry's `consolidatedRetryOf`. Chains of multiple
 * retries are collapsed transitively.
 */
function consolidateRetries(sorted: readonly RequestLifecycle[], windowMs: number): readonly ConsolidationEntry[] {
  const result: ConsolidationEntry[] = [];

  for (const lifecycle of sorted) {
    const tail = result[result.length - 1];
    if (
      tail !== undefined &&
      tail.lifecycle.phase === 'failed' &&
      tail.lifecycle.url === lifecycle.url &&
      tail.lifecycle.method === lifecycle.method &&
      tail.lifecycle.completedAtMs !== undefined &&
      lifecycle.startedAtMs - tail.lifecycle.completedAtMs <= windowMs
    ) {
      result[result.length - 1] = {
        lifecycle,
        consolidatedRetryOf: [...tail.consolidatedRetryOf, tail.lifecycle.requestId],
      };
    } else {
      result.push(asUnconsolidated(lifecycle));
    }
  }

  return result;
}
