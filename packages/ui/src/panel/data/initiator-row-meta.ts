/**
 * Per-row metadata for the Initiator chain.
 *
 * Pulls resource type, initiator type, transferred size, duration,
 * status, third-party classification, and failure flag off an
 * `InspectorRequest`. The view consumes the result and renders a
 * chip-strip — no view-side HAR plucking, no string-comparison logic
 * scattered across components.
 */

import { classifyRequestState } from './request-state';
import type { InspectorRequest } from './types';

export type InitiatorTypeLabel =
  | 'parser'
  | 'script'
  | 'preload'
  | 'preflight'
  | 'prefetch'
  | 'redirect'
  | 'fetch'
  | 'xhr'
  | 'other';

export interface InitiatorRowMeta {
  /** Normalized lowercase resource type (e.g. `script`, `stylesheet`, `image`). Null when unknown. */
  resourceType: string | null;
  /** Coarse label for how Chrome attributed the load (`_initiator.type`). */
  initiatorType: InitiatorTypeLabel | null;
  /** Bytes transferred over the wire (preferred) or content size as fallback. Null when unknown. */
  sizeBytes: number | null;
  /** Total ms (HAR `time`). Null when unknown. */
  durationMs: number | null;
  statusCode: number | null;
  isThirdParty: boolean;
  isFailed: boolean;
}

interface Initiator {
  type?: string;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function normalizeInitiatorType(raw: string | undefined): InitiatorTypeLabel | null {
  if (!raw) return null;
  switch (raw.toLowerCase()) {
    case 'parser':
      return 'parser';
    case 'script':
      return 'script';
    case 'preload':
      return 'preload';
    case 'preflight':
      return 'preflight';
    case 'prefetch':
      return 'prefetch';
    case 'redirect':
      return 'redirect';
    case 'fetch':
      return 'fetch';
    case 'xhr':
    case 'xmlhttprequest':
      return 'xhr';
    case 'other':
      return 'other';
    default:
      return 'other';
  }
}

function pickSizeBytes(entry: InspectorRequest): number | null {
  const r = entry.harEntry.response;
  if (!r) return null;
  if (typeof r.bodySize === 'number' && r.bodySize > 0) return r.bodySize;
  if (typeof r.content?.size === 'number' && r.content.size > 0) return r.content.size;
  if (typeof entry.responseSize === 'number' && entry.responseSize > 0) return entry.responseSize;
  return null;
}

/**
 * Cascade-context failure predicate. Differs from `classifyRequestState`
 * in that it also treats HTTP 4xx/5xx as failures — for the user
 * scanning a cascade tree for "what went wrong", an `HTTP 500` is just
 * as red-flag as a wire abort. Centralized here so the row-meta and the
 * cascade summary stay in sync.
 */
export function isCascadeFailure(entry: InspectorRequest): boolean {
  const s = classifyRequestState(entry);
  if (s.kind === 'failed' || s.kind === 'blocked') return true;
  const code = entry.statusCode ?? entry.harEntry?.response?.status ?? 0;
  return code >= 400;
}

export function computeInitiatorRowMeta(entry: InspectorRequest, pageOrigin: string | null): InitiatorRowMeta {
  const initiator = entry.harEntry._initiator as Initiator | undefined;
  const entryOrigin = originOf(entry.url);
  return {
    resourceType: entry.resourceType ? entry.resourceType.toLowerCase() : null,
    initiatorType: normalizeInitiatorType(initiator?.type),
    sizeBytes: pickSizeBytes(entry),
    durationMs: typeof entry.duration === 'number' && entry.duration > 0 ? entry.duration : null,
    statusCode: entry.statusCode ?? null,
    isThirdParty: pageOrigin != null && entryOrigin != null && entryOrigin !== pageOrigin,
    isFailed: isCascadeFailure(entry),
  };
}
