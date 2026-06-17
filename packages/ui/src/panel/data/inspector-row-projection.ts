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
import { parseRedirectHopRequestId, type RedirectRewriteKind } from './redirect-hop-rows';
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
  return lifecycle.har[idx] ?? null;
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
  return lifecycle.harBodyByHop[idx] ?? null;
}

/**
 * Pending verdict — true when the lifecycle has been observed at
 * request-start (`pending` phase) but no terminal phase has landed.
 * Rows in this state render as skeleton placeholders in the panel.
 */
export function isPendingLifecycle(lifecycle: RequestLifecycle): boolean {
  return lifecycle.phase === 'pending' && lifecycle.statusCode == null;
}

/** Type guard — lifecycle resolved to a `failed` terminal. */
export function isFailedLifecycle(lifecycle: RequestLifecycle): lifecycle is RequestLifecycle & { phase: 'failed' } {
  return lifecycle.phase === 'failed';
}

/**
 * Best-known duration in milliseconds: HAR `time` when the current hop
 * has landed (authoritative); otherwise `completedAtMs - startedAtMs` for a
 * terminated lifecycle; otherwise, while still in flight, the elapsed time to
 * the latest body chunk (`lastActivityAtMs - startedAtMs`) — the browser's
 * live `endTime - startTime`, so the Time column grows during a slow download
 * instead of reading "Pending". Returns `null` only before the first byte —
 * no synthesized zero. `lastActivityAtMs` is CDP-only; the heuristic path has
 * no per-chunk signal, so it stays `null` until the terminal event.
 */
export function lifecycleDurationMs(lifecycle: RequestLifecycle): number | null {
  const harTime = currentHarEntry(lifecycle)?.time;
  if (typeof harTime === 'number' && harTime > 0) return harTime;
  if (lifecycle.completedAtMs != null) {
    const d = lifecycle.completedAtMs - lifecycle.startedAtMs;
    if (d > 0) return d;
  }
  if (lifecycle.lastActivityAtMs != null) {
    const d = lifecycle.lastActivityAtMs - lifecycle.startedAtMs;
    if (d > 0) return d;
  }
  return null;
}

/** Effective MIME type — first non-empty of HAR response content / request post-data. */
export function lifecycleMimeType(lifecycle: RequestLifecycle): string | null {
  const har = currentHarEntry(lifecycle);
  const mime = har?.response?.content?.mimeType ?? har?.request?.postData?.mimeType;
  return mime && mime.length > 0 ? mime : null;
}

/**
 * Bytes transferred over the wire — Chrome's `_transferSize` (encoded
 * headers + encoded body), falling back to the standard `bodySize`.
 *
 * `bodySize` is `-1` for any compressed or cache-served response, so it
 * cannot stand alone as a wire-byte count; `_transferSize` carries the
 * real figure. Returns `null` when neither field is a usable count
 * (pending / cached before-open / missing rows).
 */
export function lifecycleTransferredBytes(lifecycle: RequestLifecycle): number | null {
  const r = currentHarEntry(lifecycle)?.response;
  if (!r) return null;
  if (typeof r._transferSize === 'number' && r._transferSize >= 0) return r._transferSize;
  if (typeof r.bodySize === 'number' && r.bodySize >= 0) return r.bodySize;
  return null;
}

/**
 * Wire bytes to DISPLAY — the live figure while in flight, the authoritative
 * HAR figure once finished. The browser's Size column and footer total read
 * the request's running `transferSize`/`resourceSize` as the body streams;
 * we mirror that with the first-class `bytesTransferredSoFar` (CDP-only, summed
 * per `dataReceived`) until the terminal event lands the final HAR. Keyed on
 * `completedAtMs` (genuinely in-flight), NOT the display state — a streaming
 * row already carries its status. Shared by the Size column and the status-bar
 * total so the two never diverge. `null` before the first byte.
 */
export function displayTransferredBytes(lifecycle: RequestLifecycle): number | null {
  if (lifecycle.completedAtMs == null && lifecycle.bytesTransferredSoFar != null) {
    return lifecycle.bytesTransferredSoFar;
  }
  return lifecycleTransferredBytes(lifecycle);
}

/** Decoded resource bytes to DISPLAY — the running `bytesReceivedSoFar` while
 *  in flight (the browser's live `resourceSize`), the authoritative HAR
 *  `content.size` once finished. `null` when unknown. Sibling of
 *  {@link displayTransferredBytes}. */
export function displayResourceBytes(lifecycle: RequestLifecycle): number | null {
  if (lifecycle.completedAtMs == null && lifecycle.bytesReceivedSoFar != null) {
    return lifecycle.bytesReceivedSoFar;
  }
  const size = currentHarEntry(lifecycle)?.response?.content?.size;
  return typeof size === 'number' && size >= 0 ? size : null;
}

/**
 * Resolve a lifecycle's `pageref` — id of the `Page` it belongs to.
 *
 * **Loader join (authoritative).** A request belongs to the page whose
 * committed loader id it carries: `lifecycle.loaderId === page.loaderId`.
 * This is the host's own binding — `PageLoad.bindRequest` keys a request to
 * the page load whose `mainFrame.loaderId` it matches (set once at request
 * start, stable across redirect hops, 1:1 with the navigation). It is exact
 * even in a slow-nav transition window, where a subresource of the *old* page
 * can start marginally after the *new* navigation has begun — start-time
 * proximity mis-bins it to the new page; the loader id does not.
 *
 * **Document join (heuristic sibling).** The webRequest path carries no loader
 * id but stamps `documentId` on rows the outermost frame's document issued;
 * a row belongs to the page whose committed `documentId` it carries. The LAST
 * matching page wins — a back/forward-cache restore re-commits a page with the
 * document's original UUID, so the same id can legitimately appear on an
 * earlier page entry too.
 *
 * **Start-time proximity (fallback).** When the row carries no binding (an
 * iframe subresource, a worker request, Firefox), or no known page matches its
 * binding (CDP attached mid-flight, the page not yet observed, the heuristic
 * resolution still in flight), bind to the page whose `startedAtMs` is the
 * latest one not greater than the lifecycle's `startedAtMs` — the navigation
 * in flight when the request started.
 *
 * A page's `startedAtMs` is its document request's queue-adjusted start, which
 * lands marginally *after* that same request's own raw start — so the
 * navigation's defining document request is the one request that begins just
 * before the page it belongs to. When no page is at-or-before the lifecycle but
 * pages exist, attribute it to the earliest page: a request can't predate the
 * navigation it belongs to, and the only one landing before the first page's
 * start is that page's document request.
 *
 * Trade-off: under Preserve-log a tab can also hold requests that genuinely
 * predate the first *captured* navigation (in flight when the panel opened).
 * The earliest-page fallback claims those for the first page too; that
 * extends the first page's window backward rather than leaving them
 * ungrouped, which is acceptable for the common fresh-capture case the
 * panel optimizes for.
 *
 * Returns `null` only when there are no pages at all.
 */
export function resolvePageref(lifecycle: RequestLifecycle, pages: readonly Page[]): string | null {
  if (pages.length === 0) return null;
  const loaderId = lifecycle.loaderId;
  if (loaderId) {
    for (const page of pages) {
      if (page.loaderId === loaderId) return page.id;
    }
  }
  const documentId = lifecycle.documentId;
  if (documentId) {
    let match: Page | null = null;
    for (const page of pages) {
      if (page.documentId === documentId) match = page;
    }
    if (match) return match.id;
  }
  let chosen: Page = pages[0];
  for (const page of pages) {
    if (page.startedAtMs > lifecycle.startedAtMs) break;
    chosen = page;
  }
  return chosen.id;
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
  /** Set on a synthetic redirect-hop row whose underlying request carries a
   *  non-shadowed query-param/redirect fire — i.e. the hop is an Open Headers
   *  internal redirect, not a server one. Drives the row-annotation rail. */
  readonly redirectRewrite?: RedirectRewriteKind;
}

export function attachFiresToRows(rows: readonly InspectorRow[], fires: readonly InspectorFire[]): RowsWithFires {
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

/**
 * Stamp `redirectRewrite` onto synthetic redirect-hop rows whose underlying
 * request carries a non-shadowed query-param/redirect fire. Such a hop is the
 * internal redirect Open Headers' own DNR `query-param`/`redirect` rule
 * produced — the rail labels it so a self-inflicted 307 doesn't read as a
 * mysterious server redirect.
 *
 * Keyed on the real row's lifecycle requestId (which the synthetic hop id
 * embeds), NOT on `fire.requestId` — so the join holds across both correlator
 * id spaces (webRequest and CDP), where the fire-to-row binding may have gone
 * through URL/time translation. Pure; returns the input array when nothing
 * matches (the overwhelmingly common case — no redirect-class rule armed).
 */
export function stampRedirectRewrites(rows: readonly InspectorRowWithFires[]): readonly InspectorRowWithFires[] {
  const rewriteByRequestId = new Map<string, RedirectRewriteKind>();
  for (const row of rows) {
    for (const fire of row.fires) {
      if (fire.shadowedBy) continue;
      const type = fire.ruleSnapshot?.type;
      if (type === 'query-param' || type === 'redirect') {
        rewriteByRequestId.set(row.lifecycle.requestId, type);
      }
    }
  }
  if (rewriteByRequestId.size === 0) return rows;

  let changed = false;
  const stamped = rows.map((row) => {
    const parsed = parseRedirectHopRequestId(row.lifecycle.requestId);
    if (!parsed) return row;
    const kind = rewriteByRequestId.get(parsed.realRequestId);
    if (!kind) return row;
    changed = true;
    return { ...row, redirectRewrite: kind };
  });
  return changed ? stamped : rows;
}
