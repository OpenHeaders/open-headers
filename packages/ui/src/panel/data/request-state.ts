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
import { currentHarEntry } from './inspector-row-projection';

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
  // Lifecycle carries an aggregated `fromCache` boolean from the
  // correlator (CORS/cache verdict). When set without a specific
  // source, default to `memory` — same convention `_servedFromCache`
  // uses.
  if (lifecycle.fromCache) return 'memory';
  return null;
}

// ── Classifier ──────────────────────────────────────────────────

export function classifyRequestState(lifecycle: RequestLifecycle): RequestState {
  const har = currentHarEntry(lifecycle);
  const statusText = lifecycle.statusText ?? har?.response?.statusText ?? '';
  const statusCode = lifecycle.statusCode;

  // 1. Renderer-rejected errors win even when a wire status arrived.
  if (lifecycle.error && isRendererRejectCode(lifecycle.error.code)) {
    const probe = lifecycle.error.reason || statusText;
    if (isBlockedStatus(probe)) {
      return { kind: 'blocked', reason: lifecycle.error.reason || statusText || 'blocked' };
    }
    return { kind: 'failed', reason: lifecycle.error.reason || statusText || 'network error' };
  }

  // 2. Pending — response still in flight (no status, no error).
  if (statusCode == null) {
    if (lifecycle.error) {
      const probe = lifecycle.error.reason || statusText;
      if (isBlockedStatus(probe)) {
        return { kind: 'blocked', reason: lifecycle.error.reason || statusText || 'blocked' };
      }
      return { kind: 'failed', reason: lifecycle.error.reason || statusText || 'network error' };
    }
    return { kind: 'pending' };
  }

  if (statusCode < 0) return { kind: 'failed', reason: statusText || 'failed' };
  if (isBlockedStatus(statusText)) return { kind: 'blocked', reason: statusText };
  if (isFailureStatus(statusText)) return { kind: 'failed', reason: statusText };

  const src = cacheSource(lifecycle);
  if (src) return { kind: 'cached', source: src, status: statusCode };

  if (statusCode >= 300 && statusCode < 400) {
    const location = har?.response?.redirectURL ?? null;
    return { kind: 'redirect', status: statusCode, location };
  }

  if (statusCode >= 400) {
    return { kind: 'httpError', status: statusCode };
  }

  return { kind: 'success', status: statusCode };
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
