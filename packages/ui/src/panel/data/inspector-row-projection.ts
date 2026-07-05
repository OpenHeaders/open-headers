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
import type { InspectorOverrideBody, RequestLifecycle } from '@openheaders/core/request-lifecycle';
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
 * Resource type to display — the devtools HAR's own `_resourceType` for the
 * current hop when present, else the lifecycle's webRequest-vocabulary type.
 * `chrome.webRequest` collapses `fetch()` and `XMLHttpRequest` both to
 * `xmlhttprequest`; the devtools HAR distinguishes them (`fetch` vs `xhr`), so
 * preferring it surfaces the precise kind in the heuristic path too — matching
 * the host and CDP mode, never guessing one over the other. Falls back to the
 * webRequest type only until the HAR lands (a pending row).
 */
export function effectiveResourceType(lifecycle: RequestLifecycle): string {
  return currentHarEntry(lifecycle)?._resourceType ?? lifecycle.resourceType;
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
 * The body the page actually RECEIVED for a response a rule modified — the
 * `served` side of {@link RequestLifecycle.responseOverride}, captured by the
 * modifier (not the wire). `null` when no response rule modified this request
 * or the served capture carried no body. The body/size/state reads prefer this
 * over the wire body: the wire carries the unmodified server reply (or, for a
 * page-substituted fetch, nothing the devtools HAR ever delivers), so it is the
 * served capture — not the wire — that tells the inspector what the page saw.
 */
export function servedResponseBody(lifecycle: RequestLifecycle): InspectorOverrideBody | null {
  return lifecycle.responseOverride?.served?.body ?? null;
}

/**
 * Decoded byte length of the served override body — UTF-8 bytes for text,
 * decoded bytes for base64 — so the Size cell reflects what the page received
 * instead of the wire-only partial HAR's `0`. `null` when there is no served
 * body or a base64 payload fails to decode.
 */
export function servedResponseBodyBytes(lifecycle: RequestLifecycle): number | null {
  const body = servedResponseBody(lifecycle);
  if (body == null) return null;
  if (body.encoding === 'base64') {
    try {
      return atob(body.content).length;
    } catch {
      return null;
    }
  }
  return new TextEncoder().encode(body.content).byteLength;
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
  // A page-modified response never crossed the wire as the bytes the page saw,
  // so the wire HAR carries no usable transfer count — fall back to the served
  // body's size so the Size cell reads the served payload, not `0`.
  const served = servedResponseBodyBytes(lifecycle);
  return lifecycleTransferredBytes(lifecycle) ?? served;
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
  if (typeof size === 'number' && size >= 0) return size;
  // No wire content size (a page-modified response's wire HAR is partial) —
  // the served body's decoded size is what the page received.
  return servedResponseBodyBytes(lifecycle);
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
 * requestId. Fires the exact join leaves over get one fallback pass —
 * the cross-id-space join for stream rows (see {@link streamRowTakesFire}):
 * a confirmed scriptable fire (a ws/sse wrapper reporting per frame)
 * carries a webRequest-adopted id or none, while a CDP-fed tab keys its
 * rows by the CDP store id, so the exact key can never bind. Such a fire
 * joins the stream row whose URL it reported, gated by the connection's
 * lifetime and refused on ambiguity — never guessed. Dangling = whatever
 * neither join claims. Caller surfaces these in the Rule Activity view.
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

/** Pairing slack between a scriptable fire's page clock and the row's
 *  lifecycle clock — same posture as the fire hub's authoritative
 *  translation window. */
const STREAM_JOIN_SLACK_MS = 5_000;

/**
 * Whether a stream row (WebSocket / EventSource connection) accounts for
 * a fire the exact requestId join left over: same endpoint URL, fire
 * instant within the connection's lifetime (slack on both edges — the
 * fire is stamped on the page clock, the lifecycle on the host clock).
 */
function streamRowTakesFire(row: InspectorRow, fire: InspectorFire): boolean {
  const lc = row.lifecycle;
  if (lc.resourceType !== 'websocket' && lc.resourceType !== 'eventsource') return false;
  if (fire.url !== lc.url) return false;
  if (fire.t < lc.startedAtMs - STREAM_JOIN_SLACK_MS) return false;
  return lc.completedAtMs == null || fire.t <= lc.completedAtMs + STREAM_JOIN_SLACK_MS;
}

export function attachFiresToRows(rows: readonly InspectorRow[], fires: readonly InspectorFire[]): RowsWithFires {
  if (fires.length === 0) {
    return {
      rows: rows.map((r) => ({ ...r, fires: [] })),
      dangling: [],
    };
  }
  const byRequestId = new Map<string, InspectorFire[]>();
  const unclaimed: InspectorFire[] = [];
  for (const fire of fires) {
    if (!fire.requestId) {
      unclaimed.push(fire);
      continue;
    }
    const existing = byRequestId.get(fire.requestId);
    if (existing) existing.push(fire);
    else byRequestId.set(fire.requestId, [fire]);
  }

  const firesByRow = new Map<number, InspectorFire[]>();
  const claimed = new Set<string>();
  rows.forEach((row, i) => {
    const matched = byRequestId.get(row.lifecycle.requestId);
    if (matched) {
      claimed.add(row.lifecycle.requestId);
      firesByRow.set(i, matched.slice());
    }
  });
  for (const [requestId, list] of byRequestId) {
    if (!claimed.has(requestId)) unclaimed.push(...list);
  }

  // Fallback pass — cross-id-space join for stream rows. Only a confirmed
  // scriptable fire qualifies (an in-page wrapper reported the action ran);
  // authoritative fires already have their own translation in the fire hub.
  // Exactly one candidate row or the fire stays dangling.
  const dangling: InspectorFire[] = [];
  for (const fire of unclaimed) {
    if (fire.authoritative || fire.evidence !== 'confirmed' || fire.url === undefined) {
      dangling.push(fire);
      continue;
    }
    let target = -1;
    let ambiguous = false;
    rows.forEach((row, i) => {
      if (!streamRowTakesFire(row, fire)) return;
      if (target !== -1) ambiguous = true;
      target = i;
    });
    if (target === -1 || ambiguous) {
      dangling.push(fire);
      continue;
    }
    const list = firesByRow.get(target);
    if (list) list.push(fire);
    else firesByRow.set(target, [fire]);
  }

  const projected: InspectorRowWithFires[] = rows.map((row, i) => ({ ...row, fires: firesByRow.get(i) ?? [] }));
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
  // Which hop indices of each chain are Open Headers' own internal rewrites —
  // read from the real (un-split) lifecycle, which carries the full chain.
  const internalHopsByRequestId = new Map<string, Set<number>>();
  for (const row of rows) {
    for (const fire of row.fires) {
      if (fire.shadowedBy) continue;
      const type = fire.ruleSnapshot?.type;
      if (type === 'query-param' || type === 'redirect') {
        rewriteByRequestId.set(row.lifecycle.requestId, type);
      }
    }
    if (parseRedirectHopRequestId(row.lifecycle.requestId) === null) {
      const internal = new Set<number>();
      row.lifecycle.redirectHops.forEach((hop, i) => {
        if (hop.internal) internal.add(i);
      });
      if (internal.size > 0) internalHopsByRequestId.set(row.lifecycle.requestId, internal);
    }
  }
  if (rewriteByRequestId.size === 0) return rows;

  let changed = false;
  const stamped = rows.map((row) => {
    const parsed = parseRedirectHopRequestId(row.lifecycle.requestId);
    if (!parsed) return row;
    const kind = rewriteByRequestId.get(parsed.realRequestId);
    if (!kind) return row;
    // Only the rule's own internal-redirect hop gets the label — a server
    // redirect leg in the same chain (e.g. a 301 ahead of the rule's 307)
    // must not read as a rewrite.
    if (!internalHopsByRequestId.get(parsed.realRequestId)?.has(parsed.hop)) return row;
    changed = true;
    return { ...row, redirectRewrite: kind };
  });
  return changed ? stamped : rows;
}
