/**
 * Pure mapper: a single webRequest event → zero-or-more
 * `RequestLifecycleUpdate`s.
 *
 * H1 cut — what this mapper handles:
 *   - `onBeforeRequest`     → `started`
 *   - `onHeadersReceived`   → `phase: 'headers-received'`
 *   - `onBeforeRedirect`    → `redirect`
 *   - `onCompleted`         → `phase: 'completed'`
 *   - `onErrorOccurred`     → `phase: 'failed'`
 *
 * Not handled in this pure mapper:
 *   - `onSendHeaders` — emits nothing. CORS classification (H5) and
 *     request-header capture attach here in the correlator, not in the
 *     mapper. Kept in the type union so the adapter still subscribes
 *     (invariant 7's "exactly one webRequest subscriber" only holds if
 *     all six are owned by the adapter).
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

import type { WebRequestEvent } from './events';

/**
 * Project one webRequest event into lifecycle updates. Returns an empty
 * array for events H1 does not yet act on (`onSendHeaders`) — those
 * remain valid events the adapter must forward; the mapper just emits
 * nothing for them today.
 */
export function webRequestEventToUpdates(event: WebRequestEvent): readonly RequestLifecycleUpdate[] {
  switch (event.method_kind) {
    case 'onBeforeRequest':
      return [startedUpdate(event)];
    case 'onSendHeaders':
      return [];
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
function startedUpdate(
  event: Extract<WebRequestEvent, { method_kind: 'onBeforeRequest' }>,
): RequestLifecycleUpdate {
  const lifecycle: RequestLifecycle = {
    tabId: event.tabId,
    requestId: event.requestId,
    url: event.url,
    method: event.method,
    resourceType: event.type,
    initiator: event.initiator,
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
    },
  };
}

function redirectUpdate(
  event: Extract<WebRequestEvent, { method_kind: 'onBeforeRedirect' }>,
): RequestLifecycleUpdate {
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

function completedUpdate(
  event: Extract<WebRequestEvent, { method_kind: 'onCompleted' }>,
): RequestLifecycleUpdate {
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

function failedUpdate(
  event: Extract<WebRequestEvent, { method_kind: 'onErrorOccurred' }>,
): RequestLifecycleUpdate {
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
