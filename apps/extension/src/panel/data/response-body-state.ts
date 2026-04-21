/**
 * Response body classification — the single source of truth for "what
 * should the Response/Preview tabs render for this entry?".
 *
 * Chrome's Network tab makes a dozen distinct decisions for body
 * rendering (preflight → "no content for preflight", HEAD → "no body",
 * 304 → "cached", blocked → error, in-flight → spinner, etc.). Without
 * a classifier, the body views devolve into N cascaded ifs — easy to
 * miss a case like "preflight still shows infinite skeleton because
 * responseBody is empty string, not null."
 *
 * The classifier centralises the decision: every body view consumes
 * a `BodyState` discriminated union and renders a single branch per
 * variant. Adding a new edge case means extending the union, not
 * threading another condition through two UI files.
 */

import { classifyRequestState } from './request-state';
import type { InspectorRequest } from './types';

/**
 * Body classification.
 *
 *   - `loading`         Body fetch is in progress — panel still expects a har-body message.
 *   - `not-applicable`  Per-protocol no body (preflight / HEAD / 204 / 304 / 1xx / 101).
 *   - `empty`           Legitimately empty body (e.g. 200 with Content-Length: 0).
 *   - `unavailable`     Body should exist but isn't retrievable (blocked, opaque, cache miss).
 *   - `text`            Decoded text content (may be pretty-printed or syntax-highlighted).
 *   - `binary`          Base64-encoded payload — shown as hex / preview / decoded on demand.
 */
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
    "Body not captured. Chrome's entry.getContent returned empty — the response was streamed without buffering or served from cache.",
};

function isInformational(status: number | undefined): boolean {
  return status != null && status >= 100 && status < 200 && status !== 101;
}

function isCorsLikelyOpaque(request: InspectorRequest): boolean {
  // Chrome reports opaque responses with status 0 and a blocked mark
  // distinct from rule-blocks. When the mime-type is present but the
  // body is empty we have a clearer signal: chrome emitted headers
  // for an opaque response but withheld the body.
  const status = request.statusCode ?? 0;
  if (status !== 0) return false;
  const statusText = (request.statusText ?? '').toLowerCase();
  // CORS/opaque frequently has no statusText + no response headers.
  const s = classifyRequestState(request);
  return s.kind !== 'blocked' && s.kind !== 'failed' && statusText === '';
}

function contentLengthZero(request: InspectorRequest): boolean {
  const bodySize = request.harEntry.response?.bodySize;
  const contentSize = request.harEntry.response?.content?.size;
  if (bodySize === 0 && (contentSize === 0 || contentSize == null)) return true;
  // Content-Length header is the authoritative signal when bodySize
  // / content.size are both `-1` (Chrome's "unknown size" sentinel).
  const header = request.harEntry.response?.headers?.find((h) => h.name.toLowerCase() === 'content-length');
  return header?.value === '0';
}

function servedFromCache(request: InspectorRequest): boolean {
  const { _fromCache, _servedFromCache } = request.harEntry;
  return _fromCache === 'disk' || _fromCache === 'memory' || _servedFromCache === true;
}

/**
 * Classify the current state of an entry's response body. Views should
 * render exactly the branch they're given — no fallbacks, no "if body
 * is empty but actually..." branches around the result.
 */
export function classifyBodyState(request: InspectorRequest): BodyState {
  const method = request.method.toUpperCase();
  const status = request.statusCode;
  const resourceType = (request.resourceType ?? '').toLowerCase();

  // ── Per-protocol "no body" workbench ─────────────────────────
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
  const reqState = classifyRequestState(request);
  if (reqState.kind === 'blocked') {
    return { kind: 'unavailable', reason: 'blocked', message: UNAVAILABLE_COPY.blocked };
  }
  if (reqState.kind === 'failed') {
    return { kind: 'unavailable', reason: 'failed', message: UNAVAILABLE_COPY.failed };
  }

  // ── In-flight ────────────────────────────────────────────
  // `responseBody === undefined` means har-body hasn't arrived yet.
  // Once the body message arrives, even an empty string flips to the
  // "empty/unavailable" branch below, so the skeleton never hangs.
  if (request.responseBody === undefined) {
    return { kind: 'loading' };
  }

  // ── Empty body ───────────────────────────────────────────
  if (request.responseBody === '') {
    if (contentLengthZero(request)) return { kind: 'empty' };
    if (isCorsLikelyOpaque(request)) {
      return { kind: 'unavailable', reason: 'opaque', message: UNAVAILABLE_COPY.opaque };
    }
    if (servedFromCache(request)) {
      return { kind: 'unavailable', reason: 'cache', message: UNAVAILABLE_COPY.cache };
    }
    return { kind: 'unavailable', reason: 'unknown', message: UNAVAILABLE_COPY.unknown };
  }

  // ── Has content ──────────────────────────────────────────
  if (request.responseBodyEncoding === 'base64') {
    return { kind: 'binary', base64: request.responseBody };
  }
  return { kind: 'text', content: request.responseBody };
}
