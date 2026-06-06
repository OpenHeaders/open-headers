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
import { type CdpNetworkEvent, cdpStoreRequestId } from './events';

/** Seconds → ms. CDP `timestamp` is a `MonotonicTime` in seconds. */
const secondsToMs = (t: number): number => Math.round(t * 1000);

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
 */
export function cdpEventToUpdates(event: CdpNetworkEvent): readonly RequestLifecycleUpdate[] {
  switch (event.method) {
    case 'Network.requestWillBeSent':
      return event.redirectResponse !== undefined ? [redirectUpdate(event)] : [startedUpdate(event)];
    case 'Network.responseReceived':
      return [headersReceivedUpdate(event)];
    case 'Network.loadingFinished':
      return [completedUpdate(event)];
    case 'Network.loadingFailed':
      return [failedUpdate(event)];
    case 'Network.dataReceived':
    case 'Network.requestWillBeSentExtraInfo':
    case 'Network.responseReceivedExtraInfo':
      // Body chunks and on-the-wire header refinements carry no lifecycle
      // signal — they only enrich the HAR for an already-known hop (decoded
      // size / on-the-wire headers; see CdpHarBuilder).
      return [];
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
    },
    nextUrl: event.request.url,
  };
}

function headersReceivedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.responseReceived' }>,
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    patch: {
      phase: 'headers-received',
      statusCode: event.response.status,
      statusText: event.response.statusText,
      fromCache: event.response.fromDiskCache,
    },
  };
}

// `loadingFinished` carries no status fields — `statusCode` / `statusText` /
// `fromCache` were stamped earlier by `responseReceived`. Heuristic
// `completedUpdate` re-stamps them (refinement-safe under invariant 5); CDP's
// narrower payload is correct, not an oversight.
function completedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.loadingFinished' }>,
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: cdpStoreRequestId(event.sessionId, event.requestId),
    patch: {
      phase: 'completed',
      completedAtMs: secondsToMs(event.timestamp),
    },
  };
}

function failedUpdate(event: Extract<CdpNetworkEvent, { method: 'Network.loadingFailed' }>): RequestLifecycleUpdate {
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
      completedAtMs: secondsToMs(event.timestamp),
      error,
    },
  };
}
