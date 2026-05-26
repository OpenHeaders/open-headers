/**
 * Pure CORS classification for the heuristic correlator (H5).
 *
 * Three pure functions, zero state, zero chrome surface. The correlator
 * (or any other host) calls these with header values it has already
 * extracted from `OnSendHeadersEvent` / `OnHeadersReceivedEvent`.
 *
 * Background: `chrome.webRequest.onErrorOccurred` reports CORS-blocked
 * requests with the generic `net::ERR_FAILED` code — it does not expose
 * the underlying classification (missing `Access-Control-Allow-Origin`,
 * disallowed origin, etc.). DevTools surfaces it via
 * `Network.loadingFailed.corsErrorStatus`, but the webRequest path
 * doesn't see that signal. This module recovers the distinction from
 * observable request/response headers alone:
 *
 *   - `Origin` (request) — cross-origin only when its scheme/host/port
 *     differ from the response URL.
 *   - `Access-Control-Allow-Origin` (response) — must equal the origin
 *     or `*` for the response to pass the browser's CORS check.
 */

import type { CorsVerdict } from '@openheaders/core/request-lifecycle';

import type { WebRequestHeader } from './events';

/**
 * Case-insensitive header lookup. Returns `null` (not `undefined`) when
 * the header is absent so callers can distinguish "header carried no
 * value" (`''`) from "header not present" (`null`).
 */
export function extractHeader(
  headers: readonly WebRequestHeader[] | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h.name?.toLowerCase() === lower) return h.value ?? null;
  }
  return null;
}

/**
 * True when the request's `Origin` header indicates a cross-origin call.
 * `'null'` is the literal sandbox/opaque origin sentinel the browser
 * sends for sandboxed iframes — not a cross-origin signal.
 */
export function isCrossOrigin(origin: string | null, requestUrl: string): boolean {
  if (!origin || origin === 'null') return false;
  try {
    return new URL(origin).origin !== new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

export interface ClassifyCorsInput {
  readonly origin: string | null;
  readonly requestUrl: string;
  readonly acao: string | null;
}

/**
 * Produce the verdict the correlator attaches to `cors` patches. Always
 * returns a verdict — `{ isCrossOrigin: false, rejection: no-rejection }`
 * for same-origin requests is meaningful information ("we checked, no
 * CORS involvement") and a clean signal for downstream consumers.
 */
export function classifyCors({ origin, requestUrl, acao }: ClassifyCorsInput): CorsVerdict {
  const xo = isCrossOrigin(origin, requestUrl);
  if (!xo) return { isCrossOrigin: false, rejection: { kind: 'no-rejection' } };
  if (acao === null) return { isCrossOrigin: true, rejection: { kind: 'missing-acao' } };
  if (acao === '*' || acao === origin) {
    return { isCrossOrigin: true, rejection: { kind: 'no-rejection' } };
  }
  return { isCrossOrigin: true, rejection: { kind: 'origin-mismatch', acao } };
}
