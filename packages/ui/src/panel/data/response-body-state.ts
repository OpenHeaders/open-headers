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

import type { InspectorResponseSnapshot, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { currentHarEntry, currentResponseBody, servedResponseBody } from './inspector-row-projection';
import { classifyRequestState, isRequestFailed } from './request-state';

export type BodyState =
  | { kind: 'loading' }
  | { kind: 'not-applicable'; reason: NotApplicableReason }
  | { kind: 'empty' }
  /** The request never delivered a response body — it was blocked, canceled,
   *  or failed on the wire (with or without a status code). The browser shows
   *  one fixed message here; the Status cell carries the specific reason. */
  | { kind: 'no-response' }
  /** A response arrived but its body can't be shown (opaque cross-origin, or
   *  evicted from cache before it could be read). The browser's "Failed to
   *  load response data" state. */
  | { kind: 'unavailable'; reason: UnavailableReason }
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

export type UnavailableReason = 'opaque' | 'cache' | 'redirect' | 'unknown';

const NOT_APPLICABLE_KEY: Record<NotApplicableReason, MessageKey> = {
  preflight: 'panel.inspector.bodyState.notApplicable.preflight',
  head: 'panel.inspector.bodyState.notApplicable.head',
  connect: 'panel.inspector.bodyState.notApplicable.connect',
  'status-204': 'panel.inspector.bodyState.notApplicable.status204',
  'status-205': 'panel.inspector.bodyState.notApplicable.status205',
  'status-304': 'panel.inspector.bodyState.notApplicable.status304',
  informational: 'panel.inspector.bodyState.notApplicable.informational',
  websocket: 'panel.inspector.bodyState.notApplicable.websocket',
};

const UNAVAILABLE_KEY: Record<UnavailableReason, MessageKey> = {
  opaque: 'panel.inspector.bodyState.unavailable.opaque',
  cache: 'panel.inspector.bodyState.unavailable.cache',
  redirect: 'panel.inspector.bodyState.unavailable.redirect',
  unknown: 'panel.inspector.bodyState.unavailable.unknown',
};

/** Notice detail for a `not-applicable` body — the Response and Preview
 *  tabs render the same sentence under their own titles. */
export function notApplicableMessage(t: Translate, reason: NotApplicableReason): string {
  return t(NOT_APPLICABLE_KEY[reason]);
}

/** Notice detail for an `unavailable` body. */
export function unavailableMessage(t: Translate, reason: UnavailableReason): string {
  return t(UNAVAILABLE_KEY[reason]);
}

function isInformational(status: number | undefined): boolean {
  return status != null && status >= 100 && status < 200 && status !== 101;
}

/**
 * A followed redirect — a 3xx that the host resolved into a new request. Its
 * body was consumed to follow the hop and is never readable; the destination
 * response carries the renderable body. The redirect-hop row surfaces this
 * status with no attached body, so it would otherwise spin on the in-flight
 * skeleton forever. 304 is excluded — it is a cache validator, not a redirect.
 */
function isFollowedRedirectStatus(status: number | undefined): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
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
    return { kind: 'not-applicable', reason: 'preflight' };
  }
  if (method === 'HEAD') {
    return { kind: 'not-applicable', reason: 'head' };
  }
  if (method === 'CONNECT') {
    return { kind: 'not-applicable', reason: 'connect' };
  }
  if (status === 101 || resourceType === 'websocket') {
    return { kind: 'not-applicable', reason: 'websocket' };
  }
  if (status === 204) {
    return { kind: 'not-applicable', reason: 'status-204' };
  }
  if (status === 205) {
    return { kind: 'not-applicable', reason: 'status-205' };
  }
  if (status === 304) {
    return { kind: 'not-applicable', reason: 'status-304' };
  }
  if (isInformational(status)) {
    return { kind: 'not-applicable', reason: 'informational' };
  }

  // ── Request-level failure ────────────────────────────────
  // Blocked / canceled / wire failure — the request produced no response body.
  // The browser keys this on its `request.failed` flag, independent of any
  // status code, so a `200` whose body download was aborted lands here too
  // (rather than spinning on a body that never arrives). `classifyRequestState`
  // catches the status-text-only blocks the bare failed flag misses.
  const reqState = classifyRequestState(lifecycle);
  if (reqState.kind === 'blocked' || reqState.kind === 'failed' || isRequestFailed(lifecycle)) {
    return { kind: 'no-response' };
  }

  // ── Rule-served body ─────────────────────────────────────
  // A response rule modified what the page received in page context; the
  // modifier captured the served body directly. Prefer it over the wire body:
  // the wire carries the unmodified server reply (or, for a page-substituted
  // fetch, a body the devtools HAR never delivers — the skeleton this fixes).
  const served = servedResponseBody(lifecycle);
  if (served != null) {
    if (served.content === '') return { kind: 'empty' };
    if (served.encoding === 'base64') return { kind: 'binary', base64: served.content };
    return { kind: 'text', content: served.content };
  }

  // ── In-flight ────────────────────────────────────────────
  // Body hasn't been attached yet (host hasn't called body-attached).
  const body = currentResponseBody(lifecycle);
  if (body == null) {
    // A redirect hop never delivers a readable body — don't spin forever.
    if (isFollowedRedirectStatus(status)) {
      return { kind: 'unavailable', reason: 'redirect' };
    }
    return { kind: 'loading' };
  }

  // ── Empty body ───────────────────────────────────────────
  if (body.content === '') {
    if (contentLengthZero(lifecycle)) return { kind: 'empty' };
    if (isOpaqueResponse(lifecycle)) {
      return { kind: 'unavailable', reason: 'opaque' };
    }
    if (servedFromCache(lifecycle)) {
      return { kind: 'unavailable', reason: 'cache' };
    }
    return { kind: 'unavailable', reason: 'unknown' };
  }

  // ── Has content ──────────────────────────────────────────
  if (body.encoding === 'base64') {
    return { kind: 'binary', base64: body.content };
  }
  return { kind: 'text', content: body.content };
}

/**
 * Classify one side of a rule-modified exchange ({@link
 * InspectorResponseSnapshot}) for the split Served | Original view. The
 * snapshot was captured by the modifier with its body in hand, so this is a
 * direct body classification — no in-flight / wire-failure states. A snapshot
 * with no body (the modifier withheld one, or the original read failed) is
 * `no-response`; an empty body is `empty`.
 */
export function classifyResponseSnapshot(snapshot: InspectorResponseSnapshot): BodyState {
  const body = snapshot.body;
  if (body == null) return { kind: 'no-response' };
  if (body.content === '') return { kind: 'empty' };
  if (body.encoding === 'base64') return { kind: 'binary', base64: body.content };
  return { kind: 'text', content: body.content };
}

/** MIME for a captured snapshot — its `Content-Type` header value (sans
 *  parameters), or `''` when absent. Drives the body viewer's highlight. */
export function snapshotMime(snapshot: InspectorResponseSnapshot): string {
  const header = snapshot.headers?.find((h) => h.name.toLowerCase() === 'content-type');
  const value = header?.value ?? '';
  const semi = value.indexOf(';');
  return (semi === -1 ? value : value.slice(0, semi)).trim();
}
