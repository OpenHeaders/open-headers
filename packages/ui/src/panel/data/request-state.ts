/**
 * Request-state taxonomy — the single source of truth for every UI
 * surface that needs to know "is this row red / grey / pending / a
 * redirect / a cache hit?".
 *
 * Callers branch on `state.kind` — no more "is it both blocked and
 * cached?" ambiguity. Each lifecycle has exactly one state.
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

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { isRendererRejectCode } from './chromium-error-codes';
import { currentHarEntry, lifecycleTransferredBytes } from './inspector-row-projection';

export type CacheSource = 'disk' | 'memory' | 'service-worker';

export type RequestState =
  | { kind: 'pending' }
  | { kind: 'success'; status: number }
  | { kind: 'redirect'; status: number; location: string | null }
  | { kind: 'cached'; source: CacheSource; status: number }
  /** A real HTTP response that the server returned with a 4xx or 5xx
   *  code. Distinct from `failed` (net-stack failure, no HTTP exchange)
   *  but rendered with the same red row styling. */
  | { kind: 'httpError'; status: number }
  | { kind: 'blocked'; reason: string }
  | { kind: 'failed'; reason: string };

// ── Detection primitives ────────────────────────────────────────

function isBlockedStatus(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('blocked') || t.includes('net::err_blocked');
}

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

function cacheSource(lifecycle: RequestLifecycle): CacheSource | null {
  const har = currentHarEntry(lifecycle);
  if (har?._fetchedViaServiceWorker) return 'service-worker';
  const raw = har?._fromCache;
  if (raw === 'disk' || raw === 'memory') return raw;
  if (har?._servedFromCache) return 'memory';
  // The lifecycle's bare `fromCache` boolean (from webRequest) is set both
  // for a true memory-cache hit AND for a 304 revalidation that sent bytes
  // over the wire. Only the former bypasses the network entirely, so treat
  // it as memory cache only when nothing was transferred — otherwise the
  // request is a real (revalidated) network response shown by its status.
  if (lifecycle.fromCache && (lifecycleTransferredBytes(lifecycle) ?? 0) === 0) return 'memory';
  return null;
}

// ── Classifier ──────────────────────────────────────────────────

/**
 * The status code to display. Prefers the devtools HAR status — the
 * authoritative HTTP status, including `304 Not Modified` — over the
 * webRequest `statusCode`, which surfaces the cached `200` for a
 * revalidated resource. Falls back to webRequest while the HAR is still
 * in flight (no response shell yet).
 */
export function effectiveStatusCode(lifecycle: RequestLifecycle): number | undefined {
  const harStatus = currentHarEntry(lifecycle)?.response?.status;
  if (typeof harStatus === 'number' && harStatus > 0) return harStatus;
  return lifecycle.statusCode;
}

export function classifyRequestState(lifecycle: RequestLifecycle): RequestState {
  const har = currentHarEntry(lifecycle);
  const statusText = lifecycle.statusText ?? har?.response?.statusText ?? '';
  // Pending / failure detection stays on the raw webRequest status — it is
  // the authority on whether the request even reached a response (a `< 0`
  // code is a net-stack failure that the HAR shell must never mask).
  const rawStatus = lifecycle.statusCode;

  // 1. Renderer-rejected errors win even when a wire status arrived.
  if (lifecycle.error && isRendererRejectCode(lifecycle.error.code)) {
    const probe = lifecycle.error.reason || statusText;
    if (isBlockedStatus(probe)) {
      return { kind: 'blocked', reason: lifecycle.error.reason || statusText || 'blocked' };
    }
    return { kind: 'failed', reason: lifecycle.error.reason || statusText || 'network error' };
  }

  // 2. Pending — response still in flight (no status, no error).
  if (rawStatus == null) {
    if (lifecycle.error) {
      const probe = lifecycle.error.reason || statusText;
      if (isBlockedStatus(probe)) {
        return { kind: 'blocked', reason: lifecycle.error.reason || statusText || 'blocked' };
      }
      return { kind: 'failed', reason: lifecycle.error.reason || statusText || 'network error' };
    }
    return { kind: 'pending' };
  }

  if (rawStatus < 0) return { kind: 'failed', reason: statusText || 'failed' };
  if (isBlockedStatus(statusText)) return { kind: 'blocked', reason: statusText };
  if (isFailureStatus(statusText)) return { kind: 'failed', reason: statusText };

  // Past the failure gates, the HAR status is the authoritative HTTP code
  // for display (it carries 304; webRequest reports the cached 200).
  const status = effectiveStatusCode(lifecycle) ?? rawStatus;

  // 304 Not Modified is a conditional-GET revalidation — a real network
  // round-trip the browser shows as "304" with its transferred bytes, not
  // a from-cache label. Resolve it before the cache check so a webRequest
  // `fromCache` flag can't mislabel it as a memory-cache hit.
  if (status === 304) return { kind: 'success', status: 304 };

  const src = cacheSource(lifecycle);
  if (src) return { kind: 'cached', source: src, status };

  if (status >= 300 && status < 400) {
    const location = har?.response?.redirectURL ?? null;
    return { kind: 'redirect', status, location };
  }

  if (status >= 400) {
    return { kind: 'httpError', status };
  }

  return { kind: 'success', status };
}

// ── UX helpers ──────────────────────────────────────────────────

/** Stable CSS-class modifier for the row. */
export function rowStateClass(state: RequestState): string | null {
  switch (state.kind) {
    case 'pending':
      return 'dt-row--pending';
    case 'blocked':
      return 'dt-row--blocked';
    case 'failed':
    case 'httpError':
      return 'dt-row--failed';
    case 'cached':
      return 'dt-row--cached';
    case 'redirect':
      return 'dt-row--redirect';
    case 'success':
      return null;
  }
}

/** Status-column text for a state. */
export function statusText(state: RequestState, lifecycle: RequestLifecycle): string {
  switch (state.kind) {
    case 'pending':
      return '(pending)';
    case 'blocked':
      return `(${lifecycle.error?.reason || lifecycle.statusText || 'blocked'})`;
    case 'failed':
      return `(${lifecycle.error?.reason || lifecycle.statusText || 'failed'})`;
    case 'cached':
    case 'redirect':
    case 'success':
    case 'httpError':
      return String(state.status);
  }
}

/** True when the state warrants a "second look" — red rows in Chrome-speak. */
export function isErrorState(state: RequestState): boolean {
  return state.kind === 'blocked' || state.kind === 'failed' || state.kind === 'httpError';
}
