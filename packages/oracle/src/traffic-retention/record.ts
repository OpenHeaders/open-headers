/**
 * The retained record — PRIVATE to this module. `index.ts` deliberately
 * does not export it: everything past the store boundary is a
 * `TrafficRecordProjection` (AGENT_TRAFFIC_PLAN.md §2, §4), so a
 * consumer that wants raw traffic has no type to import. Derivation
 * strips bodies structurally — no code path ever copies HAR
 * `content.text` / `postData` or a `body-attached` payload into a
 * record, which is the "bodies are pulled, never retained" law
 * enforced by construction rather than by filtering. The ONE carve-out
 * (PLAN §3, slice S3) is `failureBody`: when a record classifies as an
 * HTTP failure, the tap pulls its body eagerly and the ring retains it
 * capped — attached through the ring's `attachFailureBody`, never
 * through derivation, and only onto a record the consumer stamped
 * `failureBodyRequested`.
 */

import type {
  LifecycleSource,
  RedirectHop,
  RequestLifecycle,
  RequestLifecyclePatch,
  RequestPhase,
} from '@openheaders/core/request-lifecycle';
import {
  normalizeTrafficResourceType,
  redactHeaders,
  redactUrl,
  type TrafficRecordProjection,
  type TrafficRedirectHopProjection,
} from '@openheaders/core/traffic';
import type { InspectorHarEntry } from '@openheaders/core/types';

import { projectBody, type RetainedTrafficBody } from './body';

/** Bound on the retained hop-URL trail. Browsers cap a redirect chain
 *  around 20 hops, so a longer trail is a loop the browser is about to
 *  kill — the earliest hops (the chain's origin) are the ones kept,
 *  `redirectHopCount` keeps the honest total. */
export const MAX_REDIRECT_TRAIL_HOPS = 20;

export interface RetainedTrafficRecord {
  tabId: number;
  requestId: string;
  url: string;
  method: string;
  /** Raw correlator token — normalized at projection, never compared raw. */
  rawResourceType: string;
  initiator?: string;
  phase: RequestPhase;
  statusCode?: number;
  statusText?: string;
  fromCache?: boolean;
  error?: { code: string; reason: string };
  startedAtMs: number;
  completedAtMs?: number;
  redirectHopCount: number;
  /** Per-hop URL trail (S5 — `traffic_graph`): each 3xx hop's URL and
   *  status, oldest first, bounded by {@link MAX_REDIRECT_TRAIL_HOPS};
   *  `url` holds the chain's final stop. Seeded from a replayed
   *  lifecycle's `redirectHops`, appended per live `redirect` update. */
  redirectTrail?: { url: string; statusCode?: number }[];
  requestHeaders?: readonly { name: string; value: string }[];
  responseHeaders?: readonly { name: string; value: string }[];
  bodyBytes?: number;
  transferBytes?: number;
  mimeType?: string;
  provenance: LifecycleSource;
  /** The eagerly-captured failure body (PLAN §3 carve-out) — capped at
   *  capture, redacted at projection like every other content plane. */
  failureBody?: RetainedTrafficBody;
  /** Set by the consumer when it fires the eager-pull seam, exactly
   *  once per record — the dedup stamp AND the ring's admission gate
   *  for `attachFailureBody` (an unrequested body is never retained). */
  failureBodyRequested?: boolean;
}

/**
 * Failure classification (PLAN §5 — `traffic_failures`): an HTTP error
 * status or a request that never completed (network error, CORS block,
 * timeout, abort — all fold to phase `failed` with a `net::ERR_*` /
 * `oh:*` code). Redirect hops fold into one lifecycle, so a 3xx final
 * status is not a failure.
 */
export function isFailureRecord(record: RetainedTrafficRecord): boolean {
  return record.phase === 'failed' || (record.statusCode !== undefined && record.statusCode >= 400);
}

/**
 * Whether the eager failure-body pull applies: an HTTP failure that ran
 * to completion has a response body worth capturing; a network-level
 * failure (`failed` without an error status) has none to pull.
 */
export function isBodyBearingFailure(record: RetainedTrafficRecord): boolean {
  return record.phase === 'completed' && record.statusCode !== undefined && record.statusCode >= 400;
}

/** Identity key inside one source's ring. */
export function recordKey(tabId: number, requestId: string): string {
  return `${tabId} ${requestId}`;
}

/** Mint a record from a `started` lifecycle (live and replay share this
 *  path — replay frames are synthetic `started` updates by contract). */
export function recordFromLifecycle(lifecycle: RequestLifecycle, provenance: LifecycleSource): RetainedTrafficRecord {
  const record: RetainedTrafficRecord = {
    tabId: lifecycle.tabId,
    requestId: lifecycle.requestId,
    url: lifecycle.url,
    method: lifecycle.method,
    rawResourceType: lifecycle.resourceType,
    phase: lifecycle.phase,
    startedAtMs: lifecycle.startedAtMs,
    redirectHopCount: lifecycle.redirectHopCount,
    provenance,
  };
  if (lifecycle.initiator !== undefined) record.initiator = lifecycle.initiator;
  if (lifecycle.statusCode !== undefined) record.statusCode = lifecycle.statusCode;
  if (lifecycle.statusText !== undefined) record.statusText = lifecycle.statusText;
  if (lifecycle.fromCache !== undefined) record.fromCache = lifecycle.fromCache;
  if (lifecycle.error !== undefined) record.error = { code: lifecycle.error.code, reason: lifecycle.error.reason };
  if (lifecycle.completedAtMs !== undefined) record.completedAtMs = lifecycle.completedAtMs;
  if (lifecycle.requestHeaders !== undefined) record.requestHeaders = lifecycle.requestHeaders;
  if (lifecycle.responseHeaders !== undefined) record.responseHeaders = lifecycle.responseHeaders;
  // A replayed lifecycle arrives terminal with its whole chain — seed
  // the trail here; live records grow it hop by hop instead.
  if (lifecycle.redirectHops.length > 0) {
    record.redirectTrail = lifecycle.redirectHops
      .slice(0, MAX_REDIRECT_TRAIL_HOPS)
      .map((hop) => ({ url: hop.sourceUrl, statusCode: hop.statusCode }));
  }
  // A replayed lifecycle may already carry terminal HARs — fold the size
  // facts in through the same body-stripping path live updates use.
  for (const har of lifecycle.har) {
    if (har !== null) applyHarToRecord(record, har);
  }
  return record;
}

/** Fold one redirect hop: count it, retain the hop URL (bounded), and
 *  move the record's URL cursor to the hop's target. */
export function applyRedirectToRecord(record: RetainedTrafficRecord, hop: RedirectHop, nextUrl: string): void {
  record.redirectHopCount += 1;
  if (record.redirectTrail === undefined) record.redirectTrail = [];
  const trail = record.redirectTrail;
  if (trail.length < MAX_REDIRECT_TRAIL_HOPS) {
    trail.push({ url: hop.sourceUrl, ...(hop.statusCode > 0 ? { statusCode: hop.statusCode } : {}) });
  }
  record.url = nextUrl;
}

/** Fold a sparse `phase` patch into the record (invariant 5 — every
 *  present field is a refinement). */
export function applyPatchToRecord(record: RetainedTrafficRecord, patch: RequestLifecyclePatch): void {
  if (patch.phase !== undefined) record.phase = patch.phase;
  if (patch.statusCode !== undefined) record.statusCode = patch.statusCode;
  if (patch.statusText !== undefined) record.statusText = patch.statusText;
  if (patch.fromCache !== undefined) record.fromCache = patch.fromCache;
  if (patch.error !== undefined) record.error = { code: patch.error.code, reason: patch.error.reason };
  if (patch.completedAtMs !== undefined) record.completedAtMs = patch.completedAtMs;
  if (patch.requestHeaders !== undefined) record.requestHeaders = patch.requestHeaders;
  if (patch.responseHeaders !== undefined) record.responseHeaders = patch.responseHeaders;
}

/**
 * Fold one hop's HAR facts into the record: sizes, mime type, status,
 * and (only when the lifecycle fields never carried them) the header
 * sets. The entry's body slots (`content.text`, `postData`) are never
 * read — the size facts are the entire retained surface of a body.
 */
export function applyHarToRecord(record: RetainedTrafficRecord, har: InspectorHarEntry): void {
  const response = har.response;
  if (response !== undefined) {
    if (response.content.size >= 0) record.bodyBytes = response.content.size;
    if (response._transferSize !== undefined && response._transferSize >= 0) {
      record.transferBytes = response._transferSize;
    }
    if (response.content.mimeType) record.mimeType = response.content.mimeType;
    if (record.statusCode === undefined && response.status > 0) {
      record.statusCode = response.status;
      record.statusText = response.statusText;
    }
    if (record.responseHeaders === undefined && response.headers.length > 0) {
      record.responseHeaders = response.headers.map((h) => ({ name: h.name, value: h.value }));
    }
  }
  const request = har.request;
  if (request !== undefined && record.requestHeaders === undefined && request.headers.length > 0) {
    record.requestHeaders = request.headers.map((h) => ({ name: h.name, value: h.value }));
  }
}

/**
 * Reveal escalation (AGENT_TRAFFIC_PLAN.md §4): unredacted projection
 * is a separate, deliberate, per-source, TIME-BOXED grant the tap owns —
 * never a tool-layer choice. Default is always redacted.
 */
export interface ProjectRecordOptions {
  readonly revealSecrets?: boolean;
  /** Surface the retained failure body (PLAN §3 carve-out). Off by
   *  default so list-shaped reads stay lean and body-free. */
  readonly includeFailureBody?: boolean;
}

/** Project one record for consumers — the ONLY read shape the store
 *  emits. Redaction happens here, at the boundary (S2): sensitive
 *  header values and token-shaped URL query values become stable
 *  `[redacted:<sha256-prefix>]` markers unless an active per-source
 *  reveal escalation passes `revealSecrets`. */
export function projectRecord(record: RetainedTrafficRecord, options?: ProjectRecordOptions): TrafficRecordProjection {
  const reveal = options?.revealSecrets === true;
  const url = reveal ? record.url : redactUrl(record.url);
  const redirectTrail: readonly TrafficRedirectHopProjection[] | undefined =
    record.redirectTrail === undefined || record.redirectTrail.length === 0
      ? undefined
      : record.redirectTrail.map((hop) => ({
          url: reveal ? hop.url : redactUrl(hop.url),
          ...(hop.statusCode !== undefined ? { statusCode: hop.statusCode } : {}),
        }));
  const initiator =
    record.initiator === undefined ? undefined : reveal ? record.initiator : redactUrl(record.initiator);
  const requestHeaders =
    record.requestHeaders === undefined
      ? undefined
      : reveal
        ? record.requestHeaders
        : redactHeaders(record.requestHeaders);
  const responseHeaders =
    record.responseHeaders === undefined
      ? undefined
      : reveal
        ? record.responseHeaders
        : redactHeaders(record.responseHeaders);
  return {
    tabId: record.tabId,
    requestId: record.requestId,
    url,
    method: record.method,
    resourceType: normalizeTrafficResourceType(record.rawResourceType),
    ...(initiator !== undefined ? { initiator } : {}),
    phase: record.phase,
    ...(record.statusCode !== undefined ? { statusCode: record.statusCode } : {}),
    ...(record.statusText !== undefined ? { statusText: record.statusText } : {}),
    ...(record.fromCache !== undefined ? { fromCache: record.fromCache } : {}),
    ...(record.error !== undefined ? { error: { code: record.error.code, reason: record.error.reason } } : {}),
    startedAtMs: record.startedAtMs,
    ...(record.completedAtMs !== undefined ? { completedAtMs: record.completedAtMs } : {}),
    redirectHopCount: record.redirectHopCount,
    ...(redirectTrail !== undefined ? { redirectTrail } : {}),
    ...(requestHeaders !== undefined ? { requestHeaders } : {}),
    ...(responseHeaders !== undefined ? { responseHeaders } : {}),
    ...(record.bodyBytes !== undefined ? { bodyBytes: record.bodyBytes } : {}),
    ...(record.transferBytes !== undefined ? { transferBytes: record.transferBytes } : {}),
    ...(record.mimeType !== undefined ? { mimeType: record.mimeType } : {}),
    ...(options?.includeFailureBody === true && record.failureBody !== undefined
      ? { failureBody: projectBody(record.failureBody, options) }
      : {}),
    provenance: record.provenance,
  };
}

/**
 * Byte accounting for the ring's ceiling — the record's JSON size. A
 * measured approximation (UTF-16 units ≈ bytes for header-dominated
 * ASCII), recomputed whenever the record mutates so the ceiling tracks
 * growth from patches and HAR facts, not just admission size.
 */
export function measureRecordBytes(record: RetainedTrafficRecord): number {
  return JSON.stringify(record).length;
}
