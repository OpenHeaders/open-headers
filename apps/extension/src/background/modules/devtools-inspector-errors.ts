/**
 * Capture blocked/canceled/failed requests for the panel.
 *
 * `chrome.devtools.network.onRequestFinished` only fires on completed
 * requests, so blocked/canceled traffic never reaches the panel via the
 * normal HAR path. We listen to `chrome.webRequest.onErrorOccurred` —
 * the canonical "this request failed before producing a HAR-shaped
 * response" signal across Chromium and Firefox webextensions — and
 * relay each one through the inspector port as a `request-error`
 * message.
 *
 * Firefox emits the same event shape but uses `NS_ERROR_*` codes
 * instead of Chromium's `net::ERR_*`; the panel's lookup table covers
 * both prefixes.
 */
import type { InspectorRequestError } from '@openheaders/core/types';

export interface RequestErrorRelay {
  send(error: InspectorRequestError): void;
}

/**
 * Subscribe to webRequest errors for `tabId`. Returns an unsubscribe
 * function the caller wires into the session teardown. Silent no-op
 * (returns an empty unsubscribe) when `chrome.webRequest` is missing
 * — keeps the panel functional in test harnesses without the API.
 */
export function subscribeRequestErrors(tabId: number, relay: RequestErrorRelay): () => void {
  const api = chrome?.webRequest?.onErrorOccurred;
  if (!api || typeof api.addListener !== 'function') return () => {};

  const listener = (details: chrome.webRequest.OnErrorOccurredDetails) => {
    if (details.tabId !== tabId) return;
    relay.send({
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      resourceType: details.type,
      timestamp: new Date(details.timeStamp).toISOString(),
      error: details.error,
      initiator: details.initiator,
      fromCache: details.fromCache ?? false,
    });
  };

  api.addListener(listener, { urls: ['<all_urls>'], tabId });
  return () => {
    try {
      api.removeListener(listener);
    } catch {
      // Already gone — no-op.
    }
  };
}
