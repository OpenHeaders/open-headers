/**
 * CORS context capture for the inspector panel.
 *
 * Background. `chrome.webRequest.onErrorOccurred` reports CORS-blocked
 * requests with the generic `net::ERR_FAILED` code — it does not expose
 * the underlying CORS classification (missing `Access-Control-Allow-Origin`,
 * disallowed method, etc.) that Chrome's DevTools Network panel surfaces
 * via CDP's `Network.loadingFailed.corsErrorStatus`. The inspector panel
 * therefore loses the distinction between "request failed for some opaque
 * reason" and "request failed because the response was missing ACAO."
 *
 * This module recovers that distinction from observable signals only:
 *
 *   - `onSendHeaders` (with `'requestHeaders'`) — captures the outgoing
 *     `Origin` header. Cross-origin only when origin's scheme/host/port
 *     differ from the response URL.
 *   - `onHeadersReceived` (with `'responseHeaders'`) — inspects
 *     `Access-Control-Allow-Origin`. ACAO must equal the origin or `*`
 *     for the response to be accepted by the browser's CORS check.
 *
 * The resulting per-request `CorsContext` is stored in a small per-tab
 * map. The error relay consults it on every `onErrorOccurred`; if the
 * error is `net::ERR_FAILED` and the context indicates a CORS rejection,
 * the relay rewrites the error code to a refined `oh:cors-*` token
 * before forwarding to the panel.
 *
 * Cleanup. Entries persist for the lifetime of the per-tab session, bounded
 * by an LRU cap (`MAX_ENTRIES_PER_TAB`). Eager removal on `onCompleted` /
 * `onErrorOccurred` is intentionally avoided — the HAR refinement consumer
 * arrives via a cross-process port message (devtools_page → background) in
 * a later macrotask than the webRequest event, and an eager delete would
 * race the HAR's arrival.
 */

export type CorsRejection =
  | { kind: 'missing-acao' }
  | { kind: 'origin-mismatch'; acao: string }
  | { kind: 'no-rejection' };

export interface CorsContext {
  /** True when the request carried a cross-origin `Origin` header. */
  isCrossOrigin: boolean;
  /** Verdict from inspecting the response's `Access-Control-Allow-Origin`. */
  rejection: CorsRejection;
}

interface PendingContext {
  origin: string | null;
  /** Set once headers are received; undefined until then. */
  rejection?: CorsRejection;
}

/** Defensive cap per tab; pathological pages without `onCompleted` could otherwise leak. */
const MAX_ENTRIES_PER_TAB = 5_000;

const byTab: Map<number, Map<string, PendingContext>> = new Map();

function tabMap(tabId: number): Map<string, PendingContext> {
  let map = byTab.get(tabId);
  if (!map) {
    map = new Map();
    byTab.set(tabId, map);
  }
  return map;
}

function evictIfFull(map: Map<string, PendingContext>): void {
  while (map.size >= MAX_ENTRIES_PER_TAB) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

function headerValue(headers: chrome.webRequest.HttpHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h.name?.toLowerCase() === lower) return h.value ?? null;
  }
  return null;
}

function isCrossOrigin(originHeader: string | null, requestUrl: string): boolean {
  if (!originHeader || originHeader === 'null') return false;
  try {
    const a = new URL(originHeader);
    const b = new URL(requestUrl);
    return a.origin !== b.origin;
  } catch {
    return false;
  }
}

function classifyRejection(origin: string | null, acao: string | null): CorsRejection {
  if (!origin) return { kind: 'no-rejection' };
  if (acao == null) return { kind: 'missing-acao' };
  if (acao === '*' || acao === origin) return { kind: 'no-rejection' };
  return { kind: 'origin-mismatch', acao };
}

/**
 * Synchronous lookup used by the error relay. Returns the captured context
 * if both phases (send + headers received) ran, or partial context if only
 * the send phase ran (response never arrived — typical for opaque failures).
 * `null` means we have no signal for this request at all.
 */
export function lookupCorsContext(tabId: number, requestId: string): CorsContext | null {
  const map = byTab.get(tabId);
  if (!map) return null;
  const pending = map.get(requestId);
  if (!pending) return null;
  return {
    isCrossOrigin: pending.origin != null && pending.origin !== 'null',
    rejection: pending.rejection ?? { kind: 'no-rejection' },
  };
}

/**
 * Subscribe CORS tracking for `tabId`. Sets up `onSendHeaders` +
 * `onHeadersReceived` + `onCompleted` (for entry cleanup). Returns an
 * unsubscribe function that detaches all listeners and clears the
 * per-tab map.
 */
export function subscribeCorsTracking(tabId: number): () => void {
  const wr = chrome?.webRequest;
  if (!wr) return () => {};

  const onSend = wr.onSendHeaders;
  const onHeaders = wr.onHeadersReceived;
  if (!onSend?.addListener || !onHeaders?.addListener) return () => {};

  const sendListener = (details: chrome.webRequest.OnSendHeadersDetails) => {
    if (details.tabId !== tabId) return;
    const origin = headerValue(details.requestHeaders, 'Origin');
    const map = tabMap(tabId);
    evictIfFull(map);
    map.set(details.requestId, { origin });
  };

  // Returns `BlockingResponse | undefined` to satisfy the blocking-capable
  // overload TypeScript picks for `onHeadersReceived.addListener`. We always
  // return undefined — this is an observation-only listener.
  const headersListener = (
    details: chrome.webRequest.OnHeadersReceivedDetails,
  ): chrome.webRequest.BlockingResponse | undefined => {
    if (details.tabId !== tabId) return undefined;
    const map = byTab.get(tabId);
    const pending = map?.get(details.requestId);
    const origin = pending?.origin ?? null;
    const xo = isCrossOrigin(origin, details.url);
    const acao = headerValue(details.responseHeaders, 'Access-Control-Allow-Origin');
    const rejection = xo ? classifyRejection(origin, acao) : { kind: 'no-rejection' as const };
    if (pending) {
      pending.rejection = rejection;
    } else {
      const m = tabMap(tabId);
      evictIfFull(m);
      m.set(details.requestId, { origin, rejection });
    }
    return undefined;
  };

  // `extraHeaders` is REQUIRED to see the `Origin` request header and the
  // `Access-Control-Allow-Origin` response header — Chrome treats both as
  // "security-sensitive" and hides them from webRequest unless the listener
  // explicitly opts in. Without this opt-in, `Origin` always reads as null
  // and the CORS classifier sees every request as same-origin.
  onSend.addListener(sendListener, { urls: ['<all_urls>'], tabId }, ['requestHeaders', 'extraHeaders']);
  onHeaders.addListener(headersListener, { urls: ['<all_urls>'], tabId }, ['responseHeaders', 'extraHeaders']);

  return () => {
    try {
      onSend.removeListener(sendListener);
    } catch {
      /* already gone */
    }
    try {
      onHeaders.removeListener(headersListener);
    } catch {
      /* already gone */
    }
    byTab.delete(tabId);
  };
}

export const __internalsForTests = {
  reset(): void {
    byTab.clear();
  },
  size(tabId: number): number {
    return byTab.get(tabId)?.size ?? 0;
  },
};
