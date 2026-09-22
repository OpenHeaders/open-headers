/**
 * The brute-force floor every short-code lookup surface on the daemon
 * shares — the pairing service's admin codes and the authorization
 * service's user codes. One GLOBAL budget on *failed* (unknown)
 * lookups inside a rolling window, not per-code (a sweep varies the
 * code, so per-code counting never trips) and not per-peer (loopback
 * collapses every attacker to `127.0.0.1`); once it trips, the whole
 * surface fails closed for a cooldown, answering uniform "unknown" so
 * a real code is indistinguishable from a miss. Counting only unknown
 * lookups keeps a legitimate human and a legitimate client polling
 * its own live handle off the meter entirely.
 */

export interface FailedLookupBudgetOptions {
  /** Unknown lookups inside {@link failureWindowMs} before the surface locks out. Defaults to 50. */
  maxFailedLookups?: number;
  /** Rolling window over which failed lookups accumulate. Defaults to 60s. */
  failureWindowMs?: number;
  /** How long the surface stays locked once the budget trips. Defaults to 60s. */
  lockoutMs?: number;
}

export interface FailedLookupBudget {
  /** Is the surface in its cooldown at `t`? Every lookup answers "unknown" while it is. */
  isLocked(t: number): boolean;
  /** Record one unknown lookup at `t`; trips the lockout when the window is over budget. */
  recordFailure(t: number): void;
}

// ~1 pending code in 1M means each 6-digit guess lands with p ≈ 1e-6;
// capping bursts at 50/min and locking 60s caps a sweep at ~150 guesses
// across a 5-minute code lifetime (p_hit ≈ 1.5e-4) while a real human
// (valid GET + valid POST) never registers a failure.
export const DEFAULT_MAX_FAILED_LOOKUPS = 50;
export const DEFAULT_FAILURE_WINDOW_MS = 60 * 1000;
export const DEFAULT_LOCKOUT_MS = 60 * 1000;

export function createFailedLookupBudget(options: FailedLookupBudgetOptions = {}): FailedLookupBudget {
  const maxFailedLookups = options.maxFailedLookups ?? DEFAULT_MAX_FAILED_LOOKUPS;
  const failureWindowMs = options.failureWindowMs ?? DEFAULT_FAILURE_WINDOW_MS;
  const lockoutMs = options.lockoutMs ?? DEFAULT_LOCKOUT_MS;
  // Timestamps of recent unknown lookups within the rolling window, and
  // the cooldown deadline once the budget trips.
  const failureTimes: number[] = [];
  let lockedUntil = 0;
  return {
    isLocked(t) {
      return t < lockedUntil;
    },
    recordFailure(t) {
      const cutoff = t - failureWindowMs;
      while (failureTimes.length > 0 && failureTimes[0] <= cutoff) failureTimes.shift();
      failureTimes.push(t);
      if (failureTimes.length >= maxFailedLookups) {
        lockedUntil = t + lockoutMs;
        // The lockout now governs; clear the window so post-cooldown
        // traffic starts from a clean budget rather than re-tripping.
        failureTimes.length = 0;
      }
    },
  };
}
