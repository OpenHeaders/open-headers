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
 * about chrome.debugger; the `CdpCorrelatorStub` wires events from a
 * mocked `CdpEventSource` into it.
 */

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import type { CdpNetworkEvent } from './events';

/** Seconds → ms. CDP `timestamp` is a `MonotonicTime` in seconds. */
const secondsToMs = (t: number): number => Math.round(t * 1000);

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
      return event.redirectResponse !== undefined
        ? [redirectUpdate(event)]
        : [startedUpdate(event)];
    case 'Network.responseReceived':
      return [headersReceivedUpdate(event)];
    case 'Network.loadingFinished':
      return [completedUpdate(event)];
    case 'Network.loadingFailed':
      return [failedUpdate(event)];
  }
}

function startedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>,
): RequestLifecycleUpdate {
  const startedAtMs = secondsToMs(event.wallTime);
  const lifecycle: RequestLifecycle = {
    tabId: event.tabId,
    requestId: event.requestId,
    url: event.request.url,
    method: event.request.method,
    resourceType: event.type ?? 'other',
    initiator: event.initiator?.url,
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    har: new Map(),
    harBodyByHop: new Map(),
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
    requestId: event.requestId,
    hop: {
      sourceUrl: prior.url,
      redirectUrl: event.request.url,
      statusCode: prior.status,
      timestampMs: secondsToMs(event.timestamp),
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
    requestId: event.requestId,
    patch: {
      phase: 'headers-received',
      statusCode: event.response.status,
      statusText: event.response.statusText,
      fromCache: event.response.fromDiskCache,
    },
  };
}

function completedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.loadingFinished' }>,
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: event.requestId,
    patch: {
      phase: 'completed',
      completedAtMs: secondsToMs(event.timestamp),
    },
  };
}

function failedUpdate(
  event: Extract<CdpNetworkEvent, { method: 'Network.loadingFailed' }>,
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: event.tabId,
    requestId: event.requestId,
    patch: {
      phase: 'failed',
      completedAtMs: secondsToMs(event.timestamp),
      error: { code: event.errorText, reason: event.blockedReason ?? event.errorText },
    },
  };
}
