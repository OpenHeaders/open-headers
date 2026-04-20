/**
 * Pure cadence math for Live Workflow refreshes.
 *
 * Given a workflow + its current cache summary + the current wall
 * clock, returns the absolute wall-clock ms at which the scheduler
 * should next fire the workflow's refresh — or `null` when no
 * schedule applies (manual policy, or a cache whose
 * `expires-in` / `expires-at` capture can't be read).
 *
 * Mirrors the OAuth scheduler's pattern: clamp to the MV3 30s alarm
 * floor, honor exponential backoff on failure state, and derive the
 * healthy-path tick from the refresh policy.
 */

import type { LiveWorkflow } from '../types/v5/live';

// ── Cache summary ─────────────────────────────────────────────────

/**
 * The subset of a workflow-run cache the cadence math needs.
 *
 * Platform adapters (extension `live-cache-store`, future desktop
 * adapter) project their full cache shapes down to this so the core
 * function stays dependency-free.
 */
export interface CacheSummary {
  /** Wall-clock ms of the last successful extraction. Unset if the workflow has never refreshed. */
  extractedAt?: number;
  /** Per-step captured values — `stepId → captureName → stringValue`. Powers `expires-in` / `expires-at`. */
  stepCaptures: Record<string, Record<string, string>>;
  /** Consecutive failed refreshes since the last success. Drives backoff. */
  consecutiveFailures: number;
  /** Wall-clock ms of the last failure. Required for backoff math when `consecutiveFailures > 0`. */
  lastErrorAt?: number;
}

// ── Constants ─────────────────────────────────────────────────────

/** Chrome packed MV3 builds clamp alarms to a 30-second floor. */
export const MIN_ALARM_DELAY_MS = 30_000;

/**
 * Healthy-path defaults: refresh this far before the computed expiry
 * to avoid racing a just-expired value against the next request. The
 * user can override via `RefreshPolicy.leadSeconds`; the constant
 * exists so the scheduler has a sensible default in logs when a user
 * picks `0`.
 */
export const DEFAULT_REFRESH_LEAD_MS = 60_000;

/** Cap on exponential backoff in seconds. 60·2^(n-1) grows fast. */
export const MAX_BACKOFF_SECONDS = 3600;

// ── computeNextFireAt ─────────────────────────────────────────────

/**
 * Compute the absolute wall-clock ms to fire the next refresh alarm.
 *
 * Returns `null` when no firing is possible in the current state:
 *   - `refresh.kind === 'manual'`
 *   - `expires-in` / `expires-at` capture is missing or unparseable AND
 *     the workflow has no cache yet (nothing to schedule against).
 *     When a cache exists but the capture is missing, we treat it as
 *     "refresh ASAP" (min-delay clamp) — the next run will populate
 *     the capture or surface its failure.
 *
 * The value is never earlier than `nowMs + MIN_ALARM_DELAY_MS`;
 * `chrome.alarms.create` would clamp to that anyway, but the math is
 * clearer when the caller doesn't have to re-apply the floor.
 */
export function computeNextFireAt(workflow: LiveWorkflow, cache: CacheSummary | null, nowMs: number): number | null {
  // 1. Failure-state backoff wins over everything — never drive the
  //    provider harder while it's erroring.
  if (cache && cache.consecutiveFailures > 0 && cache.lastErrorAt !== undefined) {
    const seconds = Math.min(60 * 2 ** (cache.consecutiveFailures - 1), MAX_BACKOFF_SECONDS);
    const target = cache.lastErrorAt + seconds * 1000;
    return Math.max(target, nowMs + MIN_ALARM_DELAY_MS);
  }

  // 2. Healthy path — per refresh policy.
  const policy = workflow.refresh;
  switch (policy.kind) {
    case 'manual':
      return null;
    case 'interval': {
      if (!cache || cache.extractedAt === undefined) {
        // Never refreshed — fire as soon as allowed.
        return nowMs + MIN_ALARM_DELAY_MS;
      }
      const target = cache.extractedAt + policy.seconds * 1000;
      return Math.max(target, nowMs + MIN_ALARM_DELAY_MS);
    }
    case 'expires-in': {
      if (!cache || cache.extractedAt === undefined) return nowMs + MIN_ALARM_DELAY_MS;
      const raw = cache.stepCaptures[policy.stepId]?.[policy.captureName];
      const seconds = Number(raw);
      if (raw === undefined || !Number.isFinite(seconds)) {
        // Capture missing / non-numeric — kick a fast retry so the
        // next run has a chance to populate it. Never return null
        // here; a silently dormant workflow is worse than a
        // tight-loop of cheap retries.
        return nowMs + MIN_ALARM_DELAY_MS;
      }
      const expiresAt = cache.extractedAt + seconds * 1000;
      const target = expiresAt - policy.leadSeconds * 1000;
      return Math.max(target, nowMs + MIN_ALARM_DELAY_MS);
    }
    case 'expires-at': {
      if (!cache) return nowMs + MIN_ALARM_DELAY_MS;
      const raw = cache.stepCaptures[policy.stepId]?.[policy.captureName];
      const absoluteMs = Number(raw);
      if (raw === undefined || !Number.isFinite(absoluteMs)) {
        return nowMs + MIN_ALARM_DELAY_MS;
      }
      const target = absoluteMs - policy.leadSeconds * 1000;
      return Math.max(target, nowMs + MIN_ALARM_DELAY_MS);
    }
  }
}
