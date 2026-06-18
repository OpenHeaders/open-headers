/**
 * Pure mapper: a single CDP event → zero-or-more
 * `RequestLifecycleUpdate`s.
 *
 * The mapping is straightforward because CDP carries `requestId` from
 * the first event and preserves it across redirects (unlike webRequest,
 * we do not need a closest-timestamp HAR join). One event = one update,
 * with the single carve-out that a `requestWillBeSent` carrying a
 * `redirectResponse` produces a `redirect` update for the prior hop
 * rather than a `started` for the new hop — the new hop's URL is
 * already present in `request.url`.
 *
 * This module is the engine-shaped side of the seam — it knows nothing
 * about chrome.debugger; the `CdpCorrelator` wires events from a
 * `CdpEventSource` into it.
 */

import type { RequestError, RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import { cdpBlockedReasonLabel } from './blocked-reason';
import type { CdpWallClockResolver } from './cdp-wall-clock';
import { type CdpNetworkEvent, cdpStoreRequestId } from './events';

/**
 * Wall-clock seconds → ms, full precision — the start-time sort baseline.
 *
 * Kept fractional on purpose. The host sorts the table by the *network* start
 * (`NetworkRequest.startTime` = `timing.requestTime`), which the panel
 * reconstructs as `startedAtMs + queueing`. Two requests fired in the same ms
 * but queued differently order by that sub-ms network start, so the issue
 * baseline must keep its fraction — truncating here collapses near-
 * simultaneous requests into one ms bucket and mis-sorts them against the
 * host. The HAR export still truncates for display (`new Date(wallTime *
 * 1000)`), and truncation preserves order, so the export stays monotonic.
 */
const wallSecondsToMs = (sec: number): number => sec * 1000;

/**
 * Project a CDP event into lifecycle updates. The decision to emit
 * `started` vs `redirect` is taken from CDP's own `redirectResponse`
 * carve-out, so a malformed trace (redirect with no prior `started`)
 * still emits a `redirect` and lets the store reject it as
 * `unknown-request`.
 *
 * `toWallMs` resolves a monotonic instant to wall-clock ms for the terminal
 * events (`loadingFinished` / `loadingFailed`), which carry only CDP's
 * monotonic `timestamp` — see {@link CdpWallClockResolver}. Injected (not
 * captured inside the mapper) so this stays pure and total: the stateful
 * {@link ../correlator-cdp/correlator.CdpCorrelator} owns the offset store.
 */
export function cdpEventToUpdates(
  event: CdpNetworkEvent,
  toWallMs: CdpWallClockResolver,
): readonly RequestLifecycleUpdate[] {
  switch (event.method) {
    case 'Network.requestWillBeSent':
      return event.redirectResponse !== undefined ? [redirectUpdate(event)] : [startedUpdate(event)];
    case 'Network.responseReceived':
      return [headersReceivedUpdate(event, toWallMs)];
    case 'Network.loadingFinished':
      return [completedUpdate(event, toWallMs)];
    case 'Network.loadingFailed':
      return [failedUpdate(event, toWallMs)];
    case 'Network.dataReceived':
    case 'Network.requestWillBeSentExtraInfo':
    case 'Network.responseReceivedExtraInfo':
      // Body chunks and on-the-wire header refinements carry no lifecycle
      // signal — they only enrich the HAR for an already-known hop (decoded
      // size / on-the-wire headers; see CdpHarBuilder).
      return [];
    case 'Network.webSocketCreated':
      return [wsStartedUpdate(event)];
    case 'Network.webSocketWillSendHandshakeRequest':
      // The issue instant + cooked handshake headers ride the HAR builder's
      // header update (same split as the plain-HTTP request events).
      return [];
    case 'Network.webSocketHandshakeResponseReceived':
      return [wsHandshakeUpdate(event)];
    case 'Network.webSocketFrameSent':
      return [wsFrameUpdate(event, 'send', toWallMs)];
    case 'Network.webSocketFrameReceived':
      return [wsFrameUpdate(event, 'receive', toWallMs)];
    case 'Network.webSocketFrameError':
      return [wsFrameErrorUpdate(event, toWallMs)];
    case 'Network.webSocketClosed':
      return [wsClosedUpdate(event, toWallMs)];
    case 'Network.eventSourceMessageReceived':
      return [sseMessageUpdate(event, toWallMs)];
  }
}

function startedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>,
): RequestLifecycleUpdate {
  const startedAtMs = wallSecondsToMs(event.wallTime);
  const lifecycle: RequestLifecycle = {
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    url: event.request.url,
    method: event.request.method,
    // CDP reports CapitalCase resource types (`Document`, `Stylesheet`, `XHR`);
    // every panel consumer of `lifecycle.resourceType` (notably the footer's
    // `isMainDocument`, which matches `'document'`) and the HAR `_resourceType`
    // use lowercase. Normalize at the source so the lifecycle carries one
    // vocabulary regardless of correlator — without this a CDP `'Document'`
    // never reads as the main document and the footer loses its redirect leg.
    resourceType: (event.type ?? 'other').toLowerCase(),
    initiator: event.initiator?.url,
    // The navigation's loader id — the page-binding key, stable across this
    // request's redirect hops (the host reuses it per navigation). A worker
    // request carries an empty loader id at the wire; leave the field unset
    // there so identity binding never mis-attributes a worker row to a page.
    ...(event.loaderId ? { loaderId: event.loaderId } : {}),
    // The issuing frame — lets webRequest-vocabulary consumers split a CDP
    // `Document` into main_frame vs sub_frame. Absent for worker requests.
    ...(event.frameId ? { frameId: event.frameId } : {}),
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    har: [],
    harBodyByHop: [],
  };
  return { kind: 'started', lifecycle };
}

function redirectUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>,
): RequestLifecycleUpdate {
  // Guaranteed non-undefined by the dispatch in `cdpEventToUpdates`.
  const prior = event.redirectResponse;
  if (prior === undefined) throw new Error('redirectUpdate called without redirectResponse');
  return {
    kind: 'redirect',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    hop: {
      sourceUrl: prior.url,
      redirectUrl: event.request.url,
      statusCode: prior.status,
      // Wall clock (not the monotonic `timestamp`) to match `startedAtMs` and
      // `RedirectHop.timestampMs`'s contract: the reducer copies this into the
      // final hop's `hopStartedAtMs`, which the start-time sort reads. A
      // monotonic value there would be a different scale from every other
      // row's wall-clock start and mis-order the redirect chain.
      timestampMs: wallSecondsToMs(event.wallTime),
      // An Open Headers `redirect`/`query-param` rule realizes as a synthetic
      // internal redirect, which carries this status text instead of a server
      // reason phrase — the marker the annotation rail keys its rewrite label on.
      ...(prior.statusText === 'Internal Redirect' ? { internal: true } : {}),
    },
    nextUrl: event.request.url,
  };
}

// `timing.requestTime` is the hop's network start (when it left the queue for
// the wire) on CDP's monotonic clock — Chrome's `NetworkRequest.startTime` and
// the footer's `baseTime`. Converted to wall through `toWallMs` so it sits on
// the same clock as `hopStartedAtMs` (the earlier issue instant), and stamped
// as `hopNetworkStartMs` so the footer can anchor to the network start without
// re-deriving it from the HAR. Absent timing (cached / blocked hop) leaves the
// field unset; the footer falls back to `hopStartedAtMs`.
function headersReceivedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.responseReceived' }>,
  toWallMs: CdpWallClockResolver,
): RequestLifecycleUpdate {
  const requestTime = event.response.timing?.requestTime;
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    patch: {
      phase: 'headers-received',
      statusCode: event.response.status,
      statusText: event.response.statusText,
      fromCache: event.response.fromDiskCache,
      ...(requestTime !== undefined
        ? { hopNetworkStartMs: toWallMs(event.tabId, event.sessionId, event.requestId, requestTime) }
        : {}),
    },
  };
}

// `loadingFinished` carries no status fields — `statusCode` / `statusText` /
// `fromCache` were stamped earlier by `responseReceived`. Heuristic
// `completedUpdate` re-stamps them (refinement-safe under invariant 5); CDP's
// narrower payload is correct, not an oversight.
//
// `completedAtMs` is wall-clock to match the wall `startedAtMs` /
// `hopStartedAtMs` — the event's `timestamp` is monotonic, so it is converted
// through `toWallMs`. Subtracting a monotonic finish from a wall start would
// go negative and clamp `lifecycleDuration` to 0.
function completedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.loadingFinished' }>,
  toWallMs: CdpWallClockResolver,
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    patch: {
      phase: 'completed',
      completedAtMs: toWallMs(event.tabId, event.sessionId, event.requestId, event.timestamp),
    },
  };
}

// ── WebSocket / EventSource projections ──────────────────────────────
//
// A WebSocket has no plain-Network events at the wire — the `webSocket*`
// vocabulary IS its lifecycle (see events.ts). The row mints at
// `webSocketCreated`, reaches `headers-received` at the handshake
// response (status 101), and terminates at `webSocketClosed` — the same
// span the host's own network log gives the row. Frames and parsed SSE
// events project to `message-appended`, the panel's Messages /
// EventStream plane.

function wsStartedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.webSocketCreated' }>,
): RequestLifecycleUpdate {
  const lifecycle: RequestLifecycle = {
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    url: event.url,
    // A WS handshake is always a GET; the wire confirms it at
    // `webSocketWillSendHandshakeRequest`, which carries no method field.
    method: 'GET',
    resourceType: 'websocket',
    initiator: event.initiator?.url,
    // Sockets carry no loaderId/frameId — page binding falls to the
    // start-time floor, the same posture as worker requests.
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: event.atWallMs,
    hopStartedAtMs: event.atWallMs,
    har: [],
    harBodyByHop: [],
  };
  return { kind: 'started', lifecycle };
}

function wsHandshakeUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.webSocketHandshakeResponseReceived' }>,
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    patch: {
      phase: 'headers-received',
      statusCode: event.response.status,
      statusText: event.response.statusText,
    },
  };
}

function wsFrameUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.webSocketFrameSent' | 'Network.webSocketFrameReceived' }>,
  type: 'send' | 'receive',
  toWallMs: CdpWallClockResolver,
): RequestLifecycleUpdate {
  return {
    kind: 'message-appended',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    message: {
      kind: 'ws',
      type,
      atMs: toWallMs(event.tabId, event.sessionId, event.requestId, event.timestamp),
      opcode: event.response.opcode,
      mask: event.response.mask,
      data: event.response.payloadData,
    },
  };
}

// A frame error joins the frame list (`type: 'error'`, opcode −1, the
// message as data) — the host's own posture; it does not terminate the
// request, `webSocketClosed` still follows.
function wsFrameErrorUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.webSocketFrameError' }>,
  toWallMs: CdpWallClockResolver,
): RequestLifecycleUpdate {
  return {
    kind: 'message-appended',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    message: {
      kind: 'ws',
      type: 'error',
      atMs: toWallMs(event.tabId, event.sessionId, event.requestId, event.timestamp),
      opcode: -1,
      mask: false,
      data: event.errorMessage,
    },
  };
}

function wsClosedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.webSocketClosed' }>,
  toWallMs: CdpWallClockResolver,
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    patch: {
      phase: 'completed',
      completedAtMs: toWallMs(event.tabId, event.sessionId, event.requestId, event.timestamp),
    },
  };
}

function sseMessageUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.eventSourceMessageReceived' }>,
  toWallMs: CdpWallClockResolver,
): RequestLifecycleUpdate {
  return {
    kind: 'message-appended',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    message: {
      kind: 'sse',
      atMs: toWallMs(event.tabId, event.sessionId, event.requestId, event.timestamp),
      eventName: event.eventName,
      eventId: event.eventId,
      data: event.data,
    },
  };
}

function failedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.loadingFailed' }>,
  toWallMs: CdpWallClockResolver,
): RequestLifecycleUpdate {
  const blockedReason = cdpBlockedReasonLabel(event.blockedReason);
  const error: RequestError = {
    code: event.errorText,
    reason: event.blockedReason ?? event.errorText,
    ...(blockedReason !== undefined ? { blockedReason } : {}),
  };
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    patch: {
      phase: 'failed',
      // Wall-clock (see `completedUpdate`): the monotonic `timestamp` is
      // converted so a failed row's duration stays on the same clock as its start.
      completedAtMs: toWallMs(event.tabId, event.sessionId, event.requestId, event.timestamp),
      error,
    },
  };
}
