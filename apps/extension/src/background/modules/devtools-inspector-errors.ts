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
import { lookupCorsContext } from './devtools-inspector-cors';

export interface RequestErrorRelay {
  send(error: InspectorRequestError): void;
}

/**
 * Refine a generic `net::ERR_FAILED` to a CORS-specific code when the
 * captured CORS context indicates the response failed the browser's
 * cross-origin check. `net::ERR_FAILED` is Chromium's catch-all for
 * renderer-rejected responses; without this refinement the panel cannot
 * tell CORS failures from other renderer rejections. Non-`ERR_FAILED`
 * codes and requests without CORS context are returned unchanged.
 */
function refineCorsError(tabId: number, error: InspectorRequestError): InspectorRequestError {
  if (error.error !== 'net::ERR_FAILED') return error;
  const ctx = lookupCorsContext(tabId, error.requestId);
  if (!ctx || !ctx.isCrossOrigin) return error;
  const r = ctx.rejection;
  if (r.kind === 'missing-acao') return { ...error, error: 'oh:cors-missing-acao' };
  if (r.kind === 'origin-mismatch') return { ...error, error: 'oh:cors-origin-mismatch' };
  return error;
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
    const raw: InspectorRequestError = {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      resourceType: details.type,
      timestamp: new Date(details.timeStamp).toISOString(),
      error: details.error,
      initiator: details.initiator,
      fromCache: details.fromCache ?? false,
    };
    relay.send(refineCorsError(tabId, raw));
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
