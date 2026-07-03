/**
 * Per-row metadata for the Initiator chain.
 *
 * Pulls resource type, initiator type, transferred size, duration,
 * status, third-party classification, and failure flag off a
 * `RequestLifecycle`. The view consumes the result and renders a
 * chip-strip — no view-side HAR plucking, no string-comparison logic
 * scattered across components.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry, lifecycleTransferredBytes } from '../inspector-row-projection';
import { classifyRequestState } from '../request-state';

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
  /** Coarse label for how the host attributed the load (`_initiator.type`). */
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

function pickSizeBytes(lifecycle: RequestLifecycle): number | null {
  const t = lifecycleTransferredBytes(lifecycle);
  if (t != null && t > 0) return t;
  const cs = currentHarEntry(lifecycle)?.response?.content?.size;
  return typeof cs === 'number' && cs > 0 ? cs : null;
}

function lifecycleDurationMs(lifecycle: RequestLifecycle): number | null {
  const harTime = currentHarEntry(lifecycle)?.time;
  if (typeof harTime === 'number' && harTime > 0) return harTime;
  if (lifecycle.completedAtMs != null) {
    const d = lifecycle.completedAtMs - lifecycle.startedAtMs;
    if (d > 0) return d;
  }
  return null;
}

/**
 * Cascade-context failure predicate. Differs from `classifyRequestState`
 * in that it also treats HTTP 4xx/5xx as failures — for the user
 * scanning a cascade tree for "what went wrong", an `HTTP 500` is just
 * as red-flag as a wire abort. Centralized here so row-meta and cascade
 * summary stay in sync.
 */
export function isCascadeFailure(lifecycle: RequestLifecycle): boolean {
  const s = classifyRequestState(lifecycle);
  if (s.kind === 'failed' || s.kind === 'blocked') return true;
  const code = lifecycle.statusCode ?? currentHarEntry(lifecycle)?.response?.status ?? 0;
  return code >= 400;
}

export function computeInitiatorRowMeta(lifecycle: RequestLifecycle, pageOrigin: string | null): InitiatorRowMeta {
  const initiator = currentHarEntry(lifecycle)?._initiator as Initiator | undefined;
  const entryOrigin = originOf(lifecycle.url);
  const rawType = lifecycle.resourceType;
  return {
    resourceType: rawType ? rawType.toLowerCase() : null,
    initiatorType: normalizeInitiatorType(initiator?.type),
    sizeBytes: pickSizeBytes(lifecycle),
    durationMs: lifecycleDurationMs(lifecycle),
    statusCode: lifecycle.statusCode ?? null,
    isThirdParty: pageOrigin != null && entryOrigin != null && entryOrigin !== pageOrigin,
    isFailed: isCascadeFailure(lifecycle),
  };
}
