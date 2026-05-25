/**
 * Pure projection helpers for `InspectorRow`.
 *
 * `inspector-facet.ts` produces lifecycle-shaped rows (sort, display id,
 * retry consolidation). Downstream detail panes need a flatter shape
 * (a single "current HAR entry", a flat error / pending verdict, a
 * fires companion array). These helpers are the bridge — pure, no
 * subscriptions, no IO — so the row contract a component reads is
 * deterministic and trivially testable.
 *
 * Layering: this module knows lifecycle + fire shapes; it does NOT
 * know any React types. The `useMemo` call lives in the hook that
 * wires the facet + the fire client together.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import type { InspectorRow } from './inspector-facet';
import type { InspectorFire } from './types';

/**
 * The "current" HAR shell for a lifecycle — the HAR for the current
 * hop. Redirects accumulate hops in `lifecycle.har`; consumers that
 * want to render the response line should use the latest hop's HAR
 * (the row's URL is the same hop's URL).
 *
 * Returns `null` for lifecycles whose hop HAR hasn't landed yet
 * (request observed but `chrome.devtools.network.onRequestFinished`
 * hasn't fired). The caller decides whether to render a "pending"
 * skeleton or skip.
 */
export function currentHarEntry(lifecycle: RequestLifecycle): InspectorHarEntry | null {
  const idx = lifecycle.redirectHopCount;
  return lifecycle.har.get(idx) ?? null;
}

/**
 * The "current" response body for a lifecycle — the body for the
 * current hop. `null` until `body-attached` arrives. Redirect bodies
 * (3xx response bodies, usually empty) are intentionally NOT
 * surfaced; the detail pane shows the destination response body, not
 * each hop's.
 */
export function currentResponseBody(lifecycle: RequestLifecycle): InspectorHarBody | null {
  const idx = lifecycle.redirectHopCount;
  return lifecycle.harBodyByHop.get(idx) ?? null;
}

/**
 * Pending verdict — true when the lifecycle has been observed at
 * request-start (`pending` phase) but no terminal phase has landed.
 * Matches the legacy `InspectorRequest.pending` flag's UI semantics:
 * the row should render as a skeleton placeholder.
 */
export function isPendingLifecycle(lifecycle: RequestLifecycle): boolean {
  return lifecycle.phase === 'pending' && lifecycle.statusCode == null;
}

/** Type guard — lifecycle resolved to a `failed` terminal. */
export function isFailedLifecycle(
  lifecycle: RequestLifecycle,
): lifecycle is RequestLifecycle & { phase: 'failed' } {
  return lifecycle.phase === 'failed';
}

/**
 * Resolve a lifecycle's `pageref` — id of the `Page` it belongs to.
 *
 * Picks the page whose `startedAtMs` is the latest one not greater
 * than the lifecycle's `startedAtMs` (i.e. the navigation that was
 * in flight when the request started). Returns `null` when no page
 * predates the lifecycle — the caller (HAR export) decides whether
 * to synthesize a placeholder.
 */
export function resolvePageref(lifecycle: RequestLifecycle, pages: readonly Page[]): string | null {
  if (pages.length === 0) return null;
  let chosen: Page | null = null;
  for (const page of pages) {
    if (page.startedAtMs > lifecycle.startedAtMs) break;
    chosen = page;
  }
  return chosen?.id ?? null;
}

/**
 * Per-row fire attribution + dangling-fire partition.
 *
 * Fires carry `requestId`; join by exact match to the row's lifecycle
 * requestId. Dangling = fires whose requestId either is null
 * (scriptable-only) or matches no known row. Caller surfaces these in
 * the Rule Activity view.
 *
 * Pure: rows in, fires in, rows-with-fires + dangling out. Stable
 * reference identity is the caller's responsibility (useMemo).
 */
export interface RowsWithFires {
  readonly rows: readonly InspectorRowWithFires[];
  readonly dangling: readonly InspectorFire[];
}

export interface InspectorRowWithFires extends InspectorRow {
  /** Fires attached to this row, in arrival order. Empty when none matched. */
  readonly fires: readonly InspectorFire[];
}

export function attachFiresToRows(
  rows: readonly InspectorRow[],
  fires: readonly InspectorFire[],
): RowsWithFires {
  if (fires.length === 0) {
    return {
      rows: rows.map((r) => ({ ...r, fires: [] })),
      dangling: [],
    };
  }
  const byRequestId = new Map<string, InspectorFire[]>();
  const dangling: InspectorFire[] = [];
  for (const fire of fires) {
    if (!fire.requestId) {
      dangling.push(fire);
      continue;
    }
    const existing = byRequestId.get(fire.requestId);
    if (existing) existing.push(fire);
    else byRequestId.set(fire.requestId, [fire]);
  }

  const claimed = new Set<string>();
  const projected: InspectorRowWithFires[] = rows.map((row) => {
    const matched = byRequestId.get(row.lifecycle.requestId);
    if (matched) {
      claimed.add(row.lifecycle.requestId);
      return { ...row, fires: matched };
    }
    return { ...row, fires: [] };
  });

  for (const [requestId, list] of byRequestId) {
    if (!claimed.has(requestId)) dangling.push(...list);
  }

  return { rows: projected, dangling };
}
