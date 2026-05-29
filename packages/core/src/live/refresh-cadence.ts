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

import type { LiveWorkflow } from '../types/live';
import type { CircuitSnapshot } from './circuit-breaker';
import { computePreBreakerDelayMs } from './circuit-breaker';

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
  /**
   * Circuit-breaker snapshot. When provided, the cadence math defers to
   * the circuit for failure-state scheduling: `open` states use the
   * persisted `nextAttemptAt`, pre-breaker `closed` failures use the
   * 5s±5s tier. Absent/undefined circuit falls back to the legacy
   * `60·2^(n-1)` curve (kept for tests + callers without circuit state).
   */
  circuit?: CircuitSnapshot;
  /**
   * The cached value was minted by a recipe that no longer exists — a
   * material request edit, a referenced variable change, or an upstream
   * live value the workflow consumes (the definitional-freshness
   * detectors set this). When true the healthy-path cadence is
   * overridden to "fire as soon as the alarm floor allows" so the
   * wrong-recipe value is not served until natural expiry. The circuit
   * tiers still take precedence — a failing workflow stays on its
   * backoff curve rather than hot-looping.
   */
  definitionallyStale?: boolean;
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
  // 1. Circuit-aware failure scheduling. Three tiers, in precedence:
  //
  //    a) OPEN — the circuit has a persisted `nextAttemptAt` (set by
  //       `onCircuitFailure` at backoff time). Fire at exactly that
  //       moment so the probe happens on schedule; the alarm floor
  //       still clamps if the target is already past.
  //    b) HALF-OPEN — probe window is live. Schedule the next probe
  //       at the MV3 floor so the platform can dispatch as soon as
  //       Chrome allows. Prevents stuck half-open states.
  //    c) CLOSED with `consecutiveFailures > 0` — pre-breaker tier.
  //       Retry at `lastErrorAt + 5s + jitter(0..5s)`. Small + fast so
  //       a transient blip (5xx, VPN re-negotiation) resolves without
  //       the user noticing.
  //
  // Cadence state (success path below) is only consulted when the
  // circuit is CLOSED with zero failures — the healthy branch.
  if (cache?.circuit) {
    const c = cache.circuit;
    if (c.state === 'open') {
      const target = c.nextAttemptAt ?? nowMs + MIN_ALARM_DELAY_MS;
      return Math.max(target, nowMs + MIN_ALARM_DELAY_MS);
    }
    if (c.state === 'half-open') {
      return nowMs + MIN_ALARM_DELAY_MS;
    }
    // c.state === 'closed'
    if (c.consecutiveFailures > 0 && c.lastErrorAt !== null) {
      const target = c.lastErrorAt + computePreBreakerDelayMs();
      return Math.max(target, nowMs + MIN_ALARM_DELAY_MS);
    }
    // Zero-failure closed → fall through to the healthy cadence
    // computation below.
  } else if (cache && cache.consecutiveFailures > 0 && cache.lastErrorAt !== undefined) {
    // Legacy path for callers that haven't started persisting the
    // circuit snapshot yet (tests, future desktop adapter). Same
    // exponential curve as before, capped at MAX_BACKOFF_SECONDS.
    //
    // Once every platform writes `cache.circuit` on every cache put
    // this branch becomes dead code and can be dropped.
    const seconds = Math.min(60 * 2 ** (cache.consecutiveFailures - 1), MAX_BACKOFF_SECONDS);
    const target = cache.lastErrorAt + seconds * 1000;
    return Math.max(target, nowMs + MIN_ALARM_DELAY_MS);
  }

  // 2. Definitional staleness — the cached value's recipe changed.
  //    Once the circuit/backoff tiers above have cleared (a flagged
  //    row that is also failing stays on its backoff curve, never
  //    hot-loops), a flagged row is due as soon as the alarm floor
  //    allows: serving the wrong-recipe value until the policy's
  //    natural expiry is exactly the staleness the detectors exist to
  //    close. Manual workflows are excluded — they return null below;
  //    the flag is a "needs re-run" badge, not an auto-run trigger.
  if (workflow.refresh.kind !== 'manual' && cache?.definitionallyStale) {
    return nowMs + MIN_ALARM_DELAY_MS;
  }

  // 3. Healthy path — per refresh policy.
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

// ── deriveExpiresAt ───────────────────────────────────────────────

/**
 * Wall-clock ms at which a just-extracted capture set goes stale —
 * the absolute expiry a cache row stamps on a successful refresh, which
 * {@link computeNextFireAt} then reads back via `CacheSummary` to plan
 * the next fire. Pure function of the refresh policy + the captures.
 *
 * Returns `null` for a `manual` policy or an unreadable / non-numeric
 * `expires-in` / `expires-at` capture (matches `computeNextFireAt`'s
 * "no schedule" semantics). Unlike `computeNextFireAt` this is the raw
 * expiry — no lead-time subtraction, no alarm floor — because it is the
 * value persisted on the row and synced to peers; the lead-time is the
 * scheduler's concern, not the value's.
 *
 * Both live runners (extension `live-chain-adapter`, desktop
 * `chain-runner`) and the §4 value-propagation write path derive expiry
 * through this one definition.
 */
export function deriveExpiresAt(
  workflow: LiveWorkflow,
  stepCaptures: Record<string, Record<string, string>>,
  extractedAt: number,
): number | null {
  const policy = workflow.refresh;
  switch (policy.kind) {
    case 'manual':
      return null;
    case 'interval':
      return extractedAt + policy.seconds * 1000;
    case 'expires-in': {
      const raw = stepCaptures[policy.stepId]?.[policy.captureName];
      const seconds = Number(raw);
      if (raw === undefined || !Number.isFinite(seconds)) return null;
      return extractedAt + seconds * 1000;
    }
    case 'expires-at': {
      const raw = stepCaptures[policy.stepId]?.[policy.captureName];
      const absoluteMs = Number(raw);
      if (raw === undefined || !Number.isFinite(absoluteMs)) return null;
      return absoluteMs;
    }
  }
}
