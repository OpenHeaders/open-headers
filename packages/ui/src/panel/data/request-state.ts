/**
 * Request-state taxonomy — the single source of truth for every UI
 * surface that needs to know "is this row red / grey / pending / a
 * redirect / a cache hit?". Replaces the scattered per-concern
 * predicates (`isBlockedRequest`, ad-hoc `statusCode === 0` checks,
 * ad-hoc `_fromCache` lookups) with one classifier and one
 * discriminated union.
 *
 * Callers branch on `state.kind` — no more "is it both blocked and
 * cached?" ambiguity. Each entry has exactly one state.
 *
 * Precedence when multiple signals are present:
 *
 *   1. `pending`  — no response observed yet (treat as in-flight)
 *   2. `blocked`  — Chrome blocked it before the wire (DNR, CSP,
 *                   mixed-content, ad-block extensions)
 *   3. `failed`   — a wire attempt failed (DNS, TLS, timeout,
 *                   net::ERR_*)
 *   4. `cached`   — the response came from a local cache layer
 *                   (disk / memory / service-worker) rather than the
 *                   server
 *   5. `redirect` — 3xx that points elsewhere
 *   6. `success`  — anything else with a real HTTP response
 *
 * The ordering matters: a blocked cached request is still best
 * described as "blocked" (the cache layer didn't serve it either),
 * and a failed redirect is still "failed".
 */

import type { InspectorRequest } from './types';

export type CacheSource = 'disk' | 'memory' | 'service-worker';

export type RequestState =
  | { kind: 'pending' }
  | { kind: 'success'; status: number }
  | { kind: 'redirect'; status: number; location: string | null }
  | { kind: 'cached'; source: CacheSource; status: number }
  /** A real HTTP response that the server returned with a 4xx or 5xx
   *  code. Distinct from `failed` (net-stack failure, no HTTP exchange)
   *  but rendered with the same red row styling — matches Chrome's
   *  Network panel UX. */
  | { kind: 'httpError'; status: number }
  | { kind: 'blocked'; reason: string }
  | { kind: 'failed'; reason: string };

// ── Detection primitives ────────────────────────────────────────

/** True when the status text / message reads as a Chrome net-stack block. */
function isBlockedStatus(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('blocked') || t.includes('net::err_blocked');
}

/** Canonical failure codes surfaced in status text. `net::ERR_*` is
 *  Chrome's prefix; Firefox uses `NS_ERROR_*`; we match broadly. */
function isFailureStatus(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.startsWith('net::err_') ||
    t.startsWith('ns_error_') ||
    t.includes('timed_out') ||
    t.includes('timed out') ||
    t.includes('name_not_resolved') ||
    t.includes('internet_disconnected') ||
    t.includes('connection_refused') ||
    t.includes('connection_reset') ||
    t.includes('ssl_') ||
    t.includes('cert_')
  );
}

function cacheSource(entry: InspectorRequest): CacheSource | null {
  const har = entry.harEntry;
  // Chromium emits `_fetchedViaServiceWorker: true` when a service
  // worker intercepted the fetch. Not all builds expose it in HAR, so
  // fall back to a second signal if needed.
  if (har?._fetchedViaServiceWorker) return 'service-worker';
  const raw = har?._fromCache;
  if (raw === 'disk' || raw === 'memory') return raw;
  if (har?._servedFromCache) return 'memory';
  return null;
}

/** Did we observe a response at all? Used for the pending classifier. */
function hasResponse(entry: InspectorRequest): boolean {
  if (entry.statusCode != null) return true;
  const har = entry.harEntry;
  return !!har?.response && typeof har.response.status === 'number' && har.response.status > 0;
}

// ── Classifier ──────────────────────────────────────────────────

export function classifyRequestState(entry: InspectorRequest): RequestState {
  const statusText = entry.statusText ?? entry.harEntry?.response?.statusText ?? '';
  const statusCode = entry.statusCode ?? entry.harEntry?.response?.status ?? 0;

  // 1. Pending — response still in flight.
  if (!hasResponse(entry)) return { kind: 'pending' };

  // 2. Blocked — Chrome aborted before/at the wire.
  //
  //    Prefer `entry.error.reason` (the human-friendly mapping from
  //    `chromium-error-codes.ts`) over the raw status text. Chromium's
  //    `ERR_FAILED` maps to reason `'blocked:other'` to match Chrome's
  //    Network panel, so the classifier sees it as blocked, not failed.
  const blockedProbe = entry.error?.reason ?? statusText;
  if (statusCode === 0) {
    if (isBlockedStatus(blockedProbe)) return { kind: 'blocked', reason: entry.error?.reason || statusText || 'blocked' };
    return { kind: 'failed', reason: entry.error?.reason || statusText || 'network error' };
  }
  // Some recorders use a negative status as their "generic failure"
  // sentinel (no net-stack text, no HTTP response). Treat as failed.
  if (statusCode < 0) return { kind: 'failed', reason: entry.error?.reason || statusText || 'failed' };
  if (isBlockedStatus(blockedProbe)) return { kind: 'blocked', reason: entry.error?.reason || statusText };

  // 3. Failed — status text reads as a net-stack error even with a
  //    non-zero synthetic status (rare but possible).
  if (isFailureStatus(statusText)) return { kind: 'failed', reason: statusText };

  // 4. Cached — only if the response has a recognised cache source.
  const src = cacheSource(entry);
  if (src) return { kind: 'cached', source: src, status: statusCode };

  // 5. Redirect — 3xx with a Location / redirectURL.
  if (statusCode >= 300 && statusCode < 400) {
    const location = entry.harEntry?.response?.redirectURL ?? null;
    return { kind: 'redirect', status: statusCode, location };
  }

  // 6. HTTP error — 4xx (client error) or 5xx (server error). The
  //    request itself succeeded at the network layer but the server
  //    rejected it; visually treated as a failure to match Chrome's
  //    "red row" convention.
  if (statusCode >= 400) {
    return { kind: 'httpError', status: statusCode };
  }

  // 7. Default — real HTTP response.
  return { kind: 'success', status: statusCode };
}

// ── UX helpers ──────────────────────────────────────────────────

/** Derive a stable CSS-class modifier for the row. UI picks the
 *  colour / opacity from this — keeps style workbench and state in
 *  lockstep. */
export function rowStateClass(state: RequestState): string | null {
  switch (state.kind) {
    case 'pending':
      return 'dt-row--pending';
    case 'blocked':
      return 'dt-row--blocked';
    case 'failed':
      return 'dt-row--failed';
    case 'httpError':
      // 4xx/5xx reuses the failed styling so the row is unmistakably
      // flagged — same convention Chrome's Network panel applies.
      return 'dt-row--failed';
    case 'cached':
      return 'dt-row--cached';
    case 'redirect':
      return 'dt-row--redirect';
    case 'success':
      return null;
  }
}

/** Status-column text for a state. Covers non-HTTP states (pending,
 *  blocked, failed) that don't have a real status code.
 *
 *  When `entry.error` is set (the row came from
 *  `chrome.webRequest.onErrorOccurred`), prefer the looked-up `reason`
 *  over the raw `net::ERR_*` / `NS_ERROR_*` code — matches Chrome's
 *  Network tab which shows `(blocked)`, `(canceled)`, `(failed)` etc. */
export function statusText(state: RequestState, entry: InspectorRequest): string {
  switch (state.kind) {
    case 'pending':
      return '(pending)';
    case 'blocked':
      return `(${entry.error?.reason || entry.statusText || 'blocked'})`;
    case 'failed':
      return `(${entry.error?.reason || entry.statusText || 'failed'})`;
    case 'cached':
    case 'redirect':
    case 'success':
    case 'httpError':
      return String(state.status);
  }
}

/** True when the state should count for "this request warrants a
 *  second look" triage — red rows in Chrome-speak. */
export function isErrorState(state: RequestState): boolean {
  return state.kind === 'blocked' || state.kind === 'failed' || state.kind === 'httpError';
}
