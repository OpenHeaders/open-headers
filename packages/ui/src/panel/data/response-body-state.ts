/**
 * Response body classification — the single source of truth for "what
 * should the Response/Preview tabs render for this lifecycle?".
 *
 * Without a classifier, the body views devolve into N cascaded ifs
 * (preflight → "no content for preflight", HEAD → "no body", 304 →
 * "cached", blocked → error, in-flight → spinner, etc.) — easy to
 * miss a case like "preflight still shows infinite skeleton because
 * the body string is empty, not null."
 *
 * The classifier centralises the decision: every body view consumes
 * a `BodyState` discriminated union and renders a single branch per
 * variant. Adding a new edge case means extending the union, not
 * threading another condition through two UI files.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry, currentResponseBody } from './inspector-row-projection';
import { classifyRequestState } from './request-state';

export type BodyState =
  | { kind: 'loading' }
  | { kind: 'not-applicable'; reason: NotApplicableReason; message: string }
  | { kind: 'empty' }
  | { kind: 'unavailable'; reason: UnavailableReason; message: string }
  | { kind: 'text'; content: string }
  | { kind: 'binary'; base64: string };

export type NotApplicableReason =
  | 'preflight'
  | 'head'
  | 'connect'
  | 'status-204'
  | 'status-205'
  | 'status-304'
  | 'informational'
  | 'websocket';

export type UnavailableReason = 'blocked' | 'cancelled' | 'failed' | 'opaque' | 'cache' | 'unknown';

const NOT_APPLICABLE_COPY: Record<NotApplicableReason, string> = {
  preflight: 'No content available for preflight request',
  head: 'No response body for HEAD request',
  connect: 'No response body for CONNECT request',
  'status-204': 'No content (204 No Content)',
  'status-205': 'No content (205 Reset Content)',
  'status-304': 'Not modified — body served from browser cache',
  informational: 'No content (informational response)',
  websocket: 'WebSocket connection upgraded — see the Messages tab',
};

const UNAVAILABLE_COPY: Record<UnavailableReason, string> = {
  blocked: 'Request was blocked',
  cancelled: 'Request was cancelled before a body arrived',
  failed: 'Failed to load response data',
  opaque: 'Response body not available — opaque cross-origin response',
  cache: 'Body not available — response was served from cache before DevTools opened',
  unknown:
    "Body not captured. The host returned no content — the response was streamed without buffering or served from cache.",
};

function isInformational(status: number | undefined): boolean {
  return status != null && status >= 100 && status < 200 && status !== 101;
}

function isOpaqueResponse(lifecycle: RequestLifecycle): boolean {
  // Opaque responses are reported with no status and no statusText —
  // the host emitted headers but withheld the body.
  if (lifecycle.statusCode != null) return false;
  const statusText = (lifecycle.statusText ?? '').toLowerCase();
  const s = classifyRequestState(lifecycle);
  return s.kind !== 'blocked' && s.kind !== 'failed' && statusText === '';
}

function contentLengthZero(lifecycle: RequestLifecycle): boolean {
  const har = currentHarEntry(lifecycle);
  const bodySize = har?.response?.bodySize;
  const contentSize = har?.response?.content?.size;
  if (bodySize === 0 && (contentSize === 0 || contentSize == null)) return true;
  const header = har?.response?.headers?.find((h) => h.name.toLowerCase() === 'content-length');
  return header?.value === '0';
}

function servedFromCache(lifecycle: RequestLifecycle): boolean {
  const har = currentHarEntry(lifecycle);
  if (har) {
    if (har._fromCache === 'disk' || har._fromCache === 'memory') return true;
    if (har._servedFromCache === true) return true;
  }
  return lifecycle.fromCache === true;
}

/**
 * Classify the body state for a lifecycle. Views render exactly the
 * branch they're given — no fallbacks around the result.
 */
export function classifyBodyState(lifecycle: RequestLifecycle): BodyState {
  const method = lifecycle.method.toUpperCase();
  const status = lifecycle.statusCode;
  const resourceType = lifecycle.resourceType.toLowerCase();

  // ── Per-protocol "no body" rules ─────────────────────────
  if (resourceType === 'preflight') {
    return { kind: 'not-applicable', reason: 'preflight', message: NOT_APPLICABLE_COPY.preflight };
  }
  if (method === 'HEAD') {
    return { kind: 'not-applicable', reason: 'head', message: NOT_APPLICABLE_COPY.head };
  }
  if (method === 'CONNECT') {
    return { kind: 'not-applicable', reason: 'connect', message: NOT_APPLICABLE_COPY.connect };
  }
  if (status === 101 || resourceType === 'websocket') {
    return { kind: 'not-applicable', reason: 'websocket', message: NOT_APPLICABLE_COPY.websocket };
  }
  if (status === 204) {
    return { kind: 'not-applicable', reason: 'status-204', message: NOT_APPLICABLE_COPY['status-204'] };
  }
  if (status === 205) {
    return { kind: 'not-applicable', reason: 'status-205', message: NOT_APPLICABLE_COPY['status-205'] };
  }
  if (status === 304) {
    return { kind: 'not-applicable', reason: 'status-304', message: NOT_APPLICABLE_COPY['status-304'] };
  }
  if (isInformational(status)) {
    return { kind: 'not-applicable', reason: 'informational', message: NOT_APPLICABLE_COPY.informational };
  }

  // ── Transport-level failure ──────────────────────────────
  const reqState = classifyRequestState(lifecycle);
  if (reqState.kind === 'blocked') {
    return { kind: 'unavailable', reason: 'blocked', message: UNAVAILABLE_COPY.blocked };
  }
  if (reqState.kind === 'failed') {
    return { kind: 'unavailable', reason: 'failed', message: UNAVAILABLE_COPY.failed };
  }

  // ── In-flight ────────────────────────────────────────────
  // Body hasn't been attached yet (host hasn't called body-attached).
  const body = currentResponseBody(lifecycle);
  if (body == null) {
    return { kind: 'loading' };
  }

  // ── Empty body ───────────────────────────────────────────
  if (body.content === '') {
    if (contentLengthZero(lifecycle)) return { kind: 'empty' };
    if (isOpaqueResponse(lifecycle)) {
      return { kind: 'unavailable', reason: 'opaque', message: UNAVAILABLE_COPY.opaque };
    }
    if (servedFromCache(lifecycle)) {
      return { kind: 'unavailable', reason: 'cache', message: UNAVAILABLE_COPY.cache };
    }
    return { kind: 'unavailable', reason: 'unknown', message: UNAVAILABLE_COPY.unknown };
  }

  // ── Has content ──────────────────────────────────────────
  if (body.encoding === 'base64') {
    return { kind: 'binary', base64: body.content };
  }
  return { kind: 'text', content: body.content };
}
