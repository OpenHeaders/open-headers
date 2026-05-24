/**
 * Capture completed requests for the panel as a secondary resolution
 * signal.
 *
 * `chrome.devtools.network.onRequestFinished` is our primary HAR
 * source but has documented coverage gaps — it does not fire for some
 * lazy-loaded modulepreload chunks, speculation-rule navigations, and
 * a few other categories Chrome's own Network panel still renders via
 * CDP. webRequest's `onCompleted` event fires for every request the
 * extension's net stack observes reaching completion, so subscribing
 * to it lets the panel resolve still-pending rows that the devtools
 * API silently dropped.
 *
 * Rows that already have a HAR ignore the event on the panel side, so
 * the secondary signal never double-counts.
 */
import type { InspectorRequestCompleted } from '@openheaders/core/types';

export interface RequestCompletedRelay {
  send(event: InspectorRequestCompleted): void;
}

export function subscribeRequestCompletions(tabId: number, relay: RequestCompletedRelay): () => void {
  const api = chrome?.webRequest?.onCompleted;
  if (!api || typeof api.addListener !== 'function') return () => {};

  const listener = (details: chrome.webRequest.OnCompletedDetails) => {
    if (details.tabId !== tabId) return;
    relay.send({
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      resourceType: details.type,
      statusCode: details.statusCode,
      statusLine: details.statusLine,
      timestamp: new Date(details.timeStamp).toISOString(),
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
