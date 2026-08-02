/**
 * The retained record — PRIVATE to this module. `index.ts` deliberately
 * does not export it: everything past the store boundary is a
 * `TrafficRecordProjection` (AGENT_TRAFFIC_PLAN.md §2, §4), so a
 * consumer that wants raw traffic has no type to import. Derivation
 * strips bodies structurally — no code path ever copies HAR
 * `content.text` / `postData` or a `body-attached` payload into a
 * record, which is the "bodies are pulled, never retained" law
 * enforced by construction rather than by filtering.
 */

import type {
  LifecycleSource,
  RequestLifecycle,
  RequestLifecyclePatch,
  RequestPhase,
} from '@openheaders/core/request-lifecycle';
import {
  normalizeTrafficResourceType,
  redactHeaders,
  redactUrl,
  type TrafficRecordProjection,
} from '@openheaders/core/traffic';
import type { InspectorHarEntry } from '@openheaders/core/types';

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
  requestHeaders?: readonly { name: string; value: string }[];
  responseHeaders?: readonly { name: string; value: string }[];
  bodyBytes?: number;
  transferBytes?: number;
  mimeType?: string;
  provenance: LifecycleSource;
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
  // A replayed lifecycle may already carry terminal HARs — fold the size
  // facts in through the same body-stripping path live updates use.
  for (const har of lifecycle.har) {
    if (har !== null) applyHarToRecord(record, har);
  }
  return record;
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
}

/** Project one record for consumers — the ONLY read shape the store
 *  emits. Redaction happens here, at the boundary (S2): sensitive
 *  header values and token-shaped URL query values become stable
 *  `[redacted:<sha256-prefix>]` markers unless an active per-source
 *  reveal escalation passes `revealSecrets`. */
export function projectRecord(record: RetainedTrafficRecord, options?: ProjectRecordOptions): TrafficRecordProjection {
  const reveal = options?.revealSecrets === true;
  const url = reveal ? record.url : redactUrl(record.url);
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
    ...(requestHeaders !== undefined ? { requestHeaders } : {}),
    ...(responseHeaders !== undefined ? { responseHeaders } : {}),
    ...(record.bodyBytes !== undefined ? { bodyBytes: record.bodyBytes } : {}),
    ...(record.transferBytes !== undefined ? { transferBytes: record.transferBytes } : {}),
    ...(record.mimeType !== undefined ? { mimeType: record.mimeType } : {}),
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
