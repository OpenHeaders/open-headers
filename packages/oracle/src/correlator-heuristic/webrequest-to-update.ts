/**
 * Pure mapper: a single webRequest event → zero-or-more
 * `RequestLifecycleUpdate`s.
 *
 * H1 cut — what this mapper handles:
 *   - `onBeforeRequest`     → `started`
 *   - `onSendHeaders`       → `phase` carrying the hop's request headers
 *                             (provisional until the response confirms it)
 *   - `onHeadersReceived`   → `phase: 'headers-received'` (+ drop the
 *                             request-headers provisional flag)
 *   - `onBeforeRedirect`    → `redirect`
 *   - `onCompleted`         → `phase: 'completed'`
 *   - `onErrorOccurred`     → `phase: 'failed'`
 *
 * Not handled in this pure mapper:
 *   - CORS classification (H5) — the correlator reads `onSendHeaders`'
 *     `Origin` itself; the mapper only projects the headers onto the
 *     lifecycle. Both readers see the same event.
 *   - HAR closest-timestamp join (H2/H3), per-URL FIFO matching (H4),
 *     CORS verdict (H5/H6), late-arrival buffer (H7), per-hop HAR / body
 *     attachment (H8/H9) — all live in the correlator, which calls this
 *     mapper for the base projection and layers refinements on top.
 *
 * This module is the engine-shaped side of the seam — it knows nothing
 * about `chrome.webRequest`; the SW adapter wires actual listener
 * callbacks through `WebRequestEventSource` into here.
 */

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import type { WebRequestEvent, WebRequestHeader } from './events';

/**
 * Project one webRequest event into lifecycle updates. Returns an empty
 * array for an `onSendHeaders` that carries no headers — the event still
 * forwards (the correlator reads its `Origin` for CORS), it just has
 * nothing for the mapper to project.
 */
export function webRequestEventToUpdates(event: WebRequestEvent): readonly RequestLifecycleUpdate[] {
  switch (event.method_kind) {
    case 'onBeforeRequest':
      return [startedUpdate(event)];
    case 'onSendHeaders': {
      const update = requestHeadersUpdate(event);
      return update !== undefined ? [update] : [];
    }
    case 'onHeadersReceived':
      return [headersReceivedUpdate(event)];
    case 'onBeforeRedirect':
      return [redirectUpdate(event)];
    case 'onCompleted':
      return [completedUpdate(event)];
    case 'onErrorOccurred':
      return [failedUpdate(event)];
  }
}

// duplicate-started carve-out: `onBeforeRequest` fires once per redirect hop
// with the SAME `requestId`, so this mapper emits a second `started` after a
// redirect. The store's reducer rejects the duplicate as `duplicate-started`
// (invariant-8 test pins it). Do NOT filter here — the mapper is pure and the
// reducer is the single boundary enforcer.
function startedUpdate(event: Extract<WebRequestEvent, { method_kind: 'onBeforeRequest' }>): RequestLifecycleUpdate {
  const lifecycle: RequestLifecycle = {
    tabId: event.tabId,
    requestId: event.requestId,
    url: event.url,
    method: event.method,
    resourceType: event.type,
    initiator: event.initiator,
    // The page-binding stamp — only when the OUTERMOST frame's document
    // issued the request. An iframe subresource carries its own iframe
    // document's UUID, which can never equal a committed page's documentId;
    // stamping it would falsely supersede a live iframe row, so sub-frame
    // (and fenced-frame) rows stay unbound and keep the start-time floor.
    ...(event.frameType === 'outermost_frame' && event.documentId ? { documentId: event.documentId } : {}),
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: event.timeStamp,
    hopStartedAtMs: event.timeStamp,
    har: [],
    harBodyByHop: [],
  };
  return { kind: 'started', lifecycle };
}

/**
 * Project `onSendHeaders`' request headers onto the lifecycle so an
 * in-flight row shows them before the response-gated HAR lands — the
 * heuristic mirror of the CDP path's request-header surface. These are the
 * set the network stack is sending (our adapter opts into the
 * security-sensitive headers), but the row reads `provisional` until the
 * response confirms the wire exchange (`onHeadersReceived`), matching the
 * browser's "Provisional headers are shown" banner. Absent on a request
 * served before send (cache / blocked), where `onSendHeaders` never fires.
 *
 * Returns `undefined` when the event carried no headers — nothing to
 * project, so the mapper emits no update.
 */
function requestHeadersUpdate(
  event: Extract<WebRequestEvent, { method_kind: 'onSendHeaders' }>,
): RequestLifecycleUpdate | undefined {
  const headers = normalizeRequestHeaders(event.requestHeaders);
  if (headers === undefined) return undefined;
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: event.requestId,
    patch: {
      requestHeaders: headers,
      requestHeadersProvisional: true,
    },
  };
}

function headersReceivedUpdate(
  event: Extract<WebRequestEvent, { method_kind: 'onHeadersReceived' }>,
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: event.requestId,
    patch: {
      phase: 'headers-received',
      statusCode: event.statusCode,
      statusText: extractStatusText(event.statusLine),
      fromCache: event.fromCache,
      // The response came back, so the request demonstrably crossed the
      // wire — the captured request headers are no longer provisional.
      requestHeadersProvisional: false,
    },
  };
}

function redirectUpdate(event: Extract<WebRequestEvent, { method_kind: 'onBeforeRedirect' }>): RequestLifecycleUpdate {
  return {
    kind: 'redirect',
    tabId: event.tabId,
    requestId: event.requestId,
    hop: {
      sourceUrl: event.url,
      redirectUrl: event.redirectUrl,
      statusCode: event.statusCode,
      timestampMs: event.timeStamp,
    },
    nextUrl: event.redirectUrl,
  };
}

function completedUpdate(event: Extract<WebRequestEvent, { method_kind: 'onCompleted' }>): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: event.requestId,
    patch: {
      phase: 'completed',
      statusCode: event.statusCode,
      statusText: extractStatusText(event.statusLine),
      fromCache: event.fromCache,
      completedAtMs: event.timeStamp,
    },
  };
}

function failedUpdate(event: Extract<WebRequestEvent, { method_kind: 'onErrorOccurred' }>): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: event.requestId,
    patch: {
      phase: 'failed',
      completedAtMs: event.timeStamp,
      error: { code: event.error, reason: event.error },
    },
  };
}

/**
 * webRequest headers carry an optional `value`; the lifecycle's request-header
 * shape requires a string. Default a missing value to `''` (an empty-valued
 * header that was genuinely sent), and return `undefined` when no header list
 * was provided at all so the caller emits no update.
 */
function normalizeRequestHeaders(
  headers: readonly WebRequestHeader[] | undefined,
): readonly { name: string; value: string }[] | undefined {
  if (headers === undefined) return undefined;
  return headers.map((h) => ({ name: h.name, value: h.value ?? '' }));
}

/**
 * `statusLine` is `'HTTP/1.1 200 OK'` shape; extract the reason phrase.
 * Returns `undefined` if the line is absent or malformed — invariant 5
 * forbids setting fields to `undefined`, so the patch reducer skips it.
 */
function extractStatusText(statusLine: string | undefined): string | undefined {
  if (statusLine === undefined) return undefined;
  const firstSpace = statusLine.indexOf(' ');
  if (firstSpace < 0) return undefined;
  const secondSpace = statusLine.indexOf(' ', firstSpace + 1);
  if (secondSpace < 0) return undefined;
  const text = statusLine.slice(secondSpace + 1).trim();
  return text.length > 0 ? text : undefined;
}
