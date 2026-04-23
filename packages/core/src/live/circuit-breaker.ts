/**
 * Per-workflow circuit-breaker state machine — pure functions over the
 * shape persisted in each `WorkflowRunCache` row.
 *
 * The platform owns persistence + timing (alarms / setTimeout / storage
 * writes); this module owns the transition rules and the backoff math.
 * Keeping it pure means the state machine is identical across every
 * host (extension SW, desktop main, tests) and can be audited without
 * simulating a scheduler.
 *
 * States:
 *   - `closed`     — healthy or in the pre-breaker retry tier. Attempts
 *                    are allowed. `consecutiveFailures` accumulates; on
 *                    reaching `FAILURE_THRESHOLD` the machine transitions
 *                    to `open`.
 *   - `open`       — too many consecutive failures; attempts are
 *                    rejected until `nextAttemptAt`. When the wall clock
 *                    passes `nextAttemptAt`, the first attempt that asks
 *                    `canAttempt` transitions to `half-open`.
 *   - `half-open`  — a probe window. Up to `HALF_OPEN_MAX_ATTEMPTS`
 *                    attempts may run. A single success closes the
 *                    circuit; any failure re-opens it with the next
 *                    backoff tier.
 *
 * Backoff: `BASE_TIMEOUT_MS · BACKOFF_MULTIPLIER^consecutiveOpenings`,
 * capped at `MAX_TIMEOUT_MS`, with ±`TIMEOUT_JITTER` proportional
 * jitter applied at the platform boundary (`computeBackoffMs`).
 *
 * Memory across cycles: `consecutiveOpenings` counts how many times
 * the circuit has transitioned `closed → open` without an aging-out
 * success. If the last success is older than `CONSECUTIVE_OPENINGS_
 * DECAY_MS` at close time we halve the counter; otherwise we decrement
 * by one. This matches v4 AdaptiveCircuitBreaker's adaptive-reset
 * semantics while keeping the math auditable.
 *
 * Manual bypass: `onManualBypassStart` + `onCircuitSuccess` lets the
 * platform force a HALF_OPEN-equivalent probe even when `canAttempt`
 * would otherwise refuse. On success the circuit resets to `closed`
 * with `consecutiveOpenings` decayed; on failure it stays `open` with
 * `nextAttemptAt` preserved so the user can click Retry again.
 */

// ── Constants ─────────────────────────────────────────────────────

/** Consecutive failures in `closed` state before the circuit opens. */
export const FAILURE_THRESHOLD = 3;

/** Probe attempts allowed in `half-open` before re-opening. */
export const HALF_OPEN_MAX_ATTEMPTS = 3;

/** First backoff after the circuit opens — 30 seconds. */
export const BASE_TIMEOUT_MS = 30_000;

/** Backoff cap — 1 hour. Matches v4 AdaptiveCircuitBreaker's ceiling. */
export const MAX_TIMEOUT_MS = 3_600_000;

/** Multiplicative growth per consecutive opening. */
export const BACKOFF_MULTIPLIER = 2;

/** Proportional jitter applied to each backoff window (±10%). */
export const TIMEOUT_JITTER = 0.1;

/**
 * If the last success is older than this at close-time, halve
 * `consecutiveOpenings` instead of decrementing by one. Encodes the
 * heuristic that "this provider was stably healthy for a while" → the
 * machine shouldn't stay punitively backed-off forever.
 */
export const CONSECUTIVE_OPENINGS_DECAY_MS = 300_000; // 5 minutes

/**
 * Pre-breaker tier: after a failure in `closed` state, retry at
 * `lastErrorAt + PRE_BREAKER_BASE_MS + jitter`. Small + jittered so a
 * transient blip (5xx, VPN re-negotiation) resolves without the user
 * noticing.
 */
export const PRE_BREAKER_BASE_MS = 5_000;

/** Jitter applied to the pre-breaker retry delay (uniform 0..N). */
export const PRE_BREAKER_JITTER_MS = 5_000;

// ── Types ──────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'half-open' | 'open';

/**
 * The subset of cache state the circuit-breaker math needs. Platform
 * adapters project their full cache row down to this so the machine
 * stays dependency-light.
 */
export interface CircuitSnapshot {
  state: CircuitState;
  /** Consecutive failures since the last close → open transition OR the last success. */
  consecutiveFailures: number;
  /** Times the circuit has `closed → open` without an aging-out success. Drives backoff. */
  consecutiveOpenings: number;
  /** Wall-clock ms at which the `open → half-open` transition becomes eligible. */
  nextAttemptAt: number | null;
  /** Probe attempts used inside the current `half-open` window. */
  halfOpenAttempts: number;
  /** Wall-clock ms of the last successful attempt. Drives consecutive-openings decay. */
  lastSuccessAt: number | null;
  /** Wall-clock ms of the last failure. Drives pre-breaker retry scheduling. */
  lastErrorAt: number | null;
}

/** The initial (never-attempted) circuit shape. */
export function initialCircuitSnapshot(): CircuitSnapshot {
  return {
    state: 'closed',
    consecutiveFailures: 0,
    consecutiveOpenings: 0,
    nextAttemptAt: null,
    halfOpenAttempts: 0,
    lastSuccessAt: null,
    lastErrorAt: null,
  };
}

// ── Backoff math ───────────────────────────────────────────────────

/**
 * Compute the backoff window for an `open` circuit, in ms, given the
 * current `consecutiveOpenings` count. Jitter is applied so a herd of
 * simultaneously-opened circuits (e.g., entire network dropped for
 * 30s) doesn't all probe at the exact same instant on recovery.
 *
 * Accepts an optional `random` function so tests can pin the jitter
 * deterministically (default `Math.random`).
 */
export function computeBackoffMs(consecutiveOpenings: number, random: () => number = Math.random): number {
  const opening = Math.max(1, consecutiveOpenings); // opening≥1 in any open state
  const base = Math.min(BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER ** (opening - 1), MAX_TIMEOUT_MS);
  // Symmetric ±jitter proportion — `random()` is [0, 1), map to [-0.5, 0.5).
  const jitter = base * TIMEOUT_JITTER * (random() - 0.5);
  return Math.max(0, Math.round(base + jitter));
}

/**
 * Compute the pre-breaker retry delay (for `closed` state failures
 * where `consecutiveFailures < FAILURE_THRESHOLD`). Additive jitter
 * uniform in [0, PRE_BREAKER_JITTER_MS).
 */
export function computePreBreakerDelayMs(random: () => number = Math.random): number {
  return PRE_BREAKER_BASE_MS + Math.floor(random() * PRE_BREAKER_JITTER_MS);
}

// ── Attempt gate ───────────────────────────────────────────────────

/**
 * True when the platform is allowed to run an attempt against this
 * circuit. `open` permits no attempts until `nowMs >= nextAttemptAt`;
 * `half-open` permits up to `HALF_OPEN_MAX_ATTEMPTS` probes; `closed`
 * always permits.
 *
 * Does NOT mutate the snapshot — the caller transitions `open →
 * half-open` via {@link transitionOpenToHalfOpen} if this returns true
 * and the snapshot says `open`.
 */
export function canAttempt(snapshot: CircuitSnapshot, nowMs: number): boolean {
  switch (snapshot.state) {
    case 'closed':
      return true;
    case 'half-open':
      return snapshot.halfOpenAttempts < HALF_OPEN_MAX_ATTEMPTS;
    case 'open':
      return snapshot.nextAttemptAt !== null && nowMs >= snapshot.nextAttemptAt;
  }
}

/**
 * Eager transition from `open` to `half-open` once `nextAttemptAt` is
 * reached. Platforms call this immediately before dispatching the
 * first probe so the persisted state reflects the in-flight probe.
 * No-op when the snapshot isn't `open` or `nowMs < nextAttemptAt`.
 */
export function transitionOpenToHalfOpen(snapshot: CircuitSnapshot, nowMs: number): CircuitSnapshot {
  if (snapshot.state !== 'open') return snapshot;
  if (snapshot.nextAttemptAt === null || nowMs < snapshot.nextAttemptAt) return snapshot;
  return {
    ...snapshot,
    state: 'half-open',
    halfOpenAttempts: 0,
  };
}

// ── Success / failure transitions ─────────────────────────────────

/**
 * Apply a success outcome. Handles:
 *   - `closed` → stays `closed`, resets `consecutiveFailures`, stamps
 *     `lastSuccessAt`, optionally decays `consecutiveOpenings`.
 *   - `half-open` → closes the circuit, resets failure + probe
 *     counters, decays `consecutiveOpenings` based on age of the
 *     previous success.
 *   - `open` → shouldn't happen (platform shouldn't call refresh on
 *     an open circuit), but if it does we close defensively.
 *
 * `lastErrorAt` is cleared so pre-breaker retry math doesn't keep
 * pointing at a stale error timestamp.
 */
export function onCircuitSuccess(snapshot: CircuitSnapshot, nowMs: number): CircuitSnapshot {
  const nextOpenings = decayConsecutiveOpenings(snapshot.consecutiveOpenings, snapshot.lastSuccessAt, nowMs);
  return {
    state: 'closed',
    consecutiveFailures: 0,
    consecutiveOpenings: nextOpenings,
    nextAttemptAt: null,
    halfOpenAttempts: 0,
    lastSuccessAt: nowMs,
    lastErrorAt: null,
  };
}

/**
 * Apply a failure outcome. Handles:
 *   - `closed` → increments `consecutiveFailures`; if it hits
 *     `FAILURE_THRESHOLD` the circuit opens with `consecutiveOpenings`
 *     bumped and `nextAttemptAt = nowMs + backoff`.
 *   - `half-open` → re-opens immediately; `consecutiveOpenings` bumps
 *     only if a probe actually ran (`halfOpenAttempts > 0` after
 *     increment — i.e., the attempt that triggered this failure).
 *     Backoff is recomputed at the new opening level.
 *   - `open` → shouldn't happen (we don't attempt when open), but if
 *     the platform pushed through (manual bypass), we extend
 *     `nextAttemptAt` rather than re-bumping the opening counter.
 *
 * `random` is threaded through `computeBackoffMs` so the scheduler's
 * jitter is testable.
 */
export function onCircuitFailure(
  snapshot: CircuitSnapshot,
  nowMs: number,
  random: () => number = Math.random,
): CircuitSnapshot {
  switch (snapshot.state) {
    case 'closed': {
      const failures = snapshot.consecutiveFailures + 1;
      if (failures >= FAILURE_THRESHOLD) {
        const nextOpenings = snapshot.consecutiveOpenings + 1;
        return {
          state: 'open',
          consecutiveFailures: failures,
          consecutiveOpenings: nextOpenings,
          nextAttemptAt: nowMs + computeBackoffMs(nextOpenings, random),
          halfOpenAttempts: 0,
          lastSuccessAt: snapshot.lastSuccessAt,
          lastErrorAt: nowMs,
        };
      }
      return {
        ...snapshot,
        consecutiveFailures: failures,
        lastErrorAt: nowMs,
      };
    }
    case 'half-open': {
      // Probe failed — bump the opening counter and recompute backoff
      // at the new level. The scheduler will pick up the new
      // `nextAttemptAt` on the next reconcile.
      const nextOpenings = snapshot.consecutiveOpenings + 1;
      return {
        state: 'open',
        consecutiveFailures: snapshot.consecutiveFailures + 1,
        consecutiveOpenings: nextOpenings,
        nextAttemptAt: nowMs + computeBackoffMs(nextOpenings, random),
        halfOpenAttempts: snapshot.halfOpenAttempts + 1,
        lastSuccessAt: snapshot.lastSuccessAt,
        lastErrorAt: nowMs,
      };
    }
    case 'open': {
      // Defensive — we don't expect attempts while open unless a
      // manual bypass forced one. Re-compute `nextAttemptAt` from
      // now so the UI doesn't keep showing a countdown to a past
      // timestamp, but don't re-bump `consecutiveOpenings` (the
      // bypass wasn't a natural retry tick).
      return {
        ...snapshot,
        consecutiveFailures: snapshot.consecutiveFailures + 1,
        nextAttemptAt: nowMs + computeBackoffMs(snapshot.consecutiveOpenings, random),
        lastErrorAt: nowMs,
      };
    }
  }
}

/**
 * Record the start of a manual bypass probe. Used when the user
 * clicks "Retry now" while the circuit is `open`. The platform
 * should run the attempt regardless of `canAttempt`; on success we
 * apply {@link onCircuitSuccess} as usual (closes the circuit), on
 * failure {@link onCircuitFailure} handles the `open`-while-failing
 * branch above.
 *
 * This function itself is a no-op on the snapshot — manual bypass
 * doesn't mutate state before the probe; it just signals the
 * platform to skip the gate. Kept as a named function so platform
 * code that wants to log "bypass used" has a clean hook point.
 */
export function markManualBypass(snapshot: CircuitSnapshot): CircuitSnapshot {
  return snapshot;
}

/**
 * Hard-reset the circuit to `closed` with zero history. Called when
 * the user clicks "Reset circuit" (clears failure count + openings),
 * or when the owning workflow is edited in a way that invalidates
 * the last-known state (e.g., URL changed so the prior failures
 * were against a different target).
 */
export function resetCircuit(): CircuitSnapshot {
  return initialCircuitSnapshot();
}

// ── Internals ──────────────────────────────────────────────────────

/**
 * Decay rule for `consecutiveOpenings` on a successful close:
 *   - Never-had-a-success: treat as "long ago" → halve.
 *   - lastSuccessAt older than DECAY_MS: halve (rounded down).
 *   - lastSuccessAt recent: decrement by one (floor at 0).
 *
 * Rationale: a provider that was stable before (old `lastSuccessAt`)
 * recovering is strong evidence the prior openings were transient;
 * halving quickly drains the penalty. A provider that keeps
 * oscillating (recent `lastSuccessAt`) shouldn't have its backoff
 * fully reset on a single success — decrementing by one keeps the
 * cycle-level memory.
 */
function decayConsecutiveOpenings(current: number, lastSuccessAt: number | null, nowMs: number): number {
  if (current <= 0) return 0;
  const aged = lastSuccessAt === null || nowMs - lastSuccessAt > CONSECUTIVE_OPENINGS_DECAY_MS;
  if (aged) return Math.floor(current / 2);
  return Math.max(0, current - 1);
}
