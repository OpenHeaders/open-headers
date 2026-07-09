/**
 * Adapter from a frozen example's captured response to the executed-
 * snapshot shape the response views render. The capture deliberately
 * excludes execution internals (wire, timing, scripts, request size),
 * so the adapted snapshot simply omits those optional fields — the
 * views already degrade honestly when they're absent — and a captured
 * exchange is never an error snapshot (`error: null`; failed sends
 * can't be saved as examples).
 */

import type { CapturedResponse, ExecutedRequestSnapshot } from '@openheaders/core/types';

export function capturedResponseToSnapshot(response: CapturedResponse): ExecutedRequestSnapshot {
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers: response.headers.map((h) => ({ key: h.key, value: h.value })),
    body: response.body,
    bodyTruncated: response.bodyTruncated,
    bodyCapBytes: response.bodyCapBytes,
    bodyBytes: response.bodyBytes,
    durationMs: response.durationMs,
    error: null,
  };
}
