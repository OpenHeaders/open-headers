/**
 * `InspectorFacet` — pure UI projection over `RequestLifecycle[]`.
 *
 * The lifecycle store is the single source of truth; this facet shapes
 * those lifecycles into the rows the network panel renders. Pure: same
 * input → same output, no subscriptions, no IO. Consumers wrap it in a
 * `useMemo` over `store.getSnapshot().ordered`.
 *
 * Concerns owned here (and nowhere else in the panel):
 *   - **Stable sort key.** `startedAtMs` ascending, with `requestId` as a
 *     tiebreaker so two requests with identical wall-clock starts get a
 *     deterministic order across re-renders.
 *   - **Display id.** 1-indexed sequence after consolidation; the legacy
 *     panel showed `#42`-style ids and the network UX leans on a stable
 *     compact identifier the user can reference verbally.
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
  const sorted = [...lifecycles].sort(compareLifecycles);
  const projected = opts.consolidateRetries
    ? consolidateRetries(sorted, opts.retryWindowMs ?? DEFAULT_RETRY_WINDOW_MS)
    : sorted.map(asUnconsolidated);

  // Request # is discovery order — the order requests entered the log
  // (`lifecycles` arrives in store insertion order, oldest first).
  // Numbering off the input rather than the time-sorted projection means
  // sorting the table never renumbers: under a start-time sort the column
  // reads scrambled, the way the browser's own Request # column does.
  const discoveryRank = new Map<string, number>();
  for (const lc of lifecycles) {
    if (!discoveryRank.has(lc.requestId)) discoveryRank.set(lc.requestId, discoveryRank.size + 1);
  }

  return projected.map((entry) => ({
    lifecycle: entry.lifecycle,
    displayId: discoveryRank.get(entry.lifecycle.requestId) ?? 0,
    consolidatedRetryOf: entry.consolidatedRetryOf,
  }));
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
function consolidateRetries(
  sorted: readonly RequestLifecycle[],
  windowMs: number,
): readonly ConsolidationEntry[] {
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

function compareLifecycles(a: RequestLifecycle, b: RequestLifecycle): number {
  if (a.startedAtMs !== b.startedAtMs) return a.startedAtMs - b.startedAtMs;
  return a.requestId < b.requestId ? -1 : a.requestId > b.requestId ? 1 : 0;
}
