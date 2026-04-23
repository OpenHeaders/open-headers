/**
 * Circuit-breaker state machine — pure-function tests.
 *
 * Every transition the platform relies on is pinned here: a passing
 * test is the only evidence the persisted cache row will transition
 * correctly under VPN drops, network restore, manual retries, etc.
 *
 * Jitter is deterministic via an injected `random` — each case picks
 * 0.5 (centerline, no jitter) unless it's specifically testing the
 * jitter distribution.
 */

import { describe, expect, it } from 'vitest';
import {
  BACKOFF_MULTIPLIER,
  BASE_TIMEOUT_MS,
  type CircuitSnapshot,
  CONSECUTIVE_OPENINGS_DECAY_MS,
  canAttempt,
  computeBackoffMs,
  computePreBreakerDelayMs,
  FAILURE_THRESHOLD,
  HALF_OPEN_MAX_ATTEMPTS,
  initialCircuitSnapshot,
  MAX_TIMEOUT_MS,
  onCircuitFailure,
  onCircuitSuccess,
  PRE_BREAKER_BASE_MS,
  PRE_BREAKER_JITTER_MS,
  resetCircuit,
  transitionOpenToHalfOpen,
} from '../../src/live/circuit-breaker';

const NOW = 1_700_000_000_000;
const centerline = (): number => 0.5; // no jitter swing

function make(overrides: Partial<CircuitSnapshot> = {}): CircuitSnapshot {
  return { ...initialCircuitSnapshot(), ...overrides };
}

// ── Initial snapshot ──────────────────────────────────────────────

describe('initialCircuitSnapshot', () => {
  it('starts closed with zeroed counters', () => {
    expect(initialCircuitSnapshot()).toEqual({
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveOpenings: 0,
      nextAttemptAt: null,
      halfOpenAttempts: 0,
      lastSuccessAt: null,
      lastErrorAt: null,
    });
  });
});

// ── Backoff math ──────────────────────────────────────────────────

describe('computeBackoffMs', () => {
  it('first opening uses BASE_TIMEOUT', () => {
    expect(computeBackoffMs(1, centerline)).toBe(BASE_TIMEOUT_MS);
  });

  it('doubles each subsequent opening', () => {
    expect(computeBackoffMs(2, centerline)).toBe(BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER);
    expect(computeBackoffMs(3, centerline)).toBe(BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER ** 2);
    expect(computeBackoffMs(4, centerline)).toBe(BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER ** 3);
  });

  it('caps at MAX_TIMEOUT_MS', () => {
    // opening=20 would be 30s × 2^19 ≈ 15×10^6s — far above the 1h cap.
    expect(computeBackoffMs(20, centerline)).toBe(MAX_TIMEOUT_MS);
  });

  it('applies ±10% jitter symmetrically around the base', () => {
    const rand0 = computeBackoffMs(1, () => 0); // -5% (= random()−0.5 = −0.5)
    const rand1 = computeBackoffMs(1, () => 1); // +5%
    expect(rand0).toBeLessThan(BASE_TIMEOUT_MS);
    expect(rand1).toBeGreaterThan(BASE_TIMEOUT_MS);
    expect(Math.abs(rand0 - BASE_TIMEOUT_MS)).toBeLessThanOrEqual(BASE_TIMEOUT_MS * 0.1);
    expect(Math.abs(rand1 - BASE_TIMEOUT_MS)).toBeLessThanOrEqual(BASE_TIMEOUT_MS * 0.1);
  });

  it('treats opening=0 as opening=1 (defensive — open state implies ≥1 cycle)', () => {
    expect(computeBackoffMs(0, centerline)).toBe(BASE_TIMEOUT_MS);
  });

  it('never returns negative even with extreme jitter', () => {
    // A malicious random() returning 0 always → max negative jitter.
    expect(computeBackoffMs(1, () => 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('computePreBreakerDelayMs', () => {
  it('base floor + jitter window', () => {
    expect(computePreBreakerDelayMs(() => 0)).toBe(PRE_BREAKER_BASE_MS);
    // Math.floor(0.999999 * 5000) = 4999.
    expect(computePreBreakerDelayMs(() => 0.999_999)).toBe(PRE_BREAKER_BASE_MS + PRE_BREAKER_JITTER_MS - 1);
  });
});

// ── canAttempt ────────────────────────────────────────────────────

describe('canAttempt', () => {
  it('closed: always true', () => {
    expect(canAttempt(make({ state: 'closed' }), NOW)).toBe(true);
    expect(canAttempt(make({ state: 'closed', consecutiveFailures: 2 }), NOW)).toBe(true);
  });

  it('half-open: true until HALF_OPEN_MAX_ATTEMPTS probes used', () => {
    expect(canAttempt(make({ state: 'half-open', halfOpenAttempts: 0 }), NOW)).toBe(true);
    expect(canAttempt(make({ state: 'half-open', halfOpenAttempts: HALF_OPEN_MAX_ATTEMPTS - 1 }), NOW)).toBe(true);
    expect(canAttempt(make({ state: 'half-open', halfOpenAttempts: HALF_OPEN_MAX_ATTEMPTS }), NOW)).toBe(false);
  });

  it('open: false until nowMs >= nextAttemptAt', () => {
    expect(canAttempt(make({ state: 'open', nextAttemptAt: NOW + 30_000 }), NOW)).toBe(false);
    expect(canAttempt(make({ state: 'open', nextAttemptAt: NOW }), NOW)).toBe(true);
    expect(canAttempt(make({ state: 'open', nextAttemptAt: NOW - 1000 }), NOW)).toBe(true);
  });

  it('open: false when nextAttemptAt is null (defensive)', () => {
    expect(canAttempt(make({ state: 'open', nextAttemptAt: null }), NOW)).toBe(false);
  });
});

// ── transitionOpenToHalfOpen ──────────────────────────────────────

describe('transitionOpenToHalfOpen', () => {
  it('moves open → half-open when nowMs crosses nextAttemptAt', () => {
    const s = make({ state: 'open', nextAttemptAt: NOW, halfOpenAttempts: 0 });
    const next = transitionOpenToHalfOpen(s, NOW);
    expect(next.state).toBe('half-open');
    expect(next.halfOpenAttempts).toBe(0);
  });

  it('is a no-op when still before nextAttemptAt', () => {
    const s = make({ state: 'open', nextAttemptAt: NOW + 30_000 });
    expect(transitionOpenToHalfOpen(s, NOW)).toBe(s);
  });

  it('is a no-op for non-open states', () => {
    const s1 = make({ state: 'closed' });
    expect(transitionOpenToHalfOpen(s1, NOW)).toBe(s1);
    const s2 = make({ state: 'half-open', halfOpenAttempts: 1 });
    expect(transitionOpenToHalfOpen(s2, NOW)).toBe(s2);
  });

  it('resets halfOpenAttempts to 0 on transition', () => {
    const s = make({ state: 'open', nextAttemptAt: NOW, halfOpenAttempts: 5 });
    const next = transitionOpenToHalfOpen(s, NOW);
    expect(next.halfOpenAttempts).toBe(0);
  });
});

// ── Failure transitions ───────────────────────────────────────────

describe('onCircuitFailure — closed → closed (pre-breaker tier)', () => {
  it('increments consecutiveFailures without opening the circuit', () => {
    let s = initialCircuitSnapshot();
    s = onCircuitFailure(s, NOW, centerline);
    expect(s.state).toBe('closed');
    expect(s.consecutiveFailures).toBe(1);
    expect(s.lastErrorAt).toBe(NOW);

    s = onCircuitFailure(s, NOW + 5_000, centerline);
    expect(s.state).toBe('closed');
    expect(s.consecutiveFailures).toBe(2);
    expect(s.lastErrorAt).toBe(NOW + 5_000);
  });
});

describe('onCircuitFailure — closed → open (threshold hit)', () => {
  it('opens after FAILURE_THRESHOLD consecutive failures', () => {
    let s = initialCircuitSnapshot();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      s = onCircuitFailure(s, NOW + i * 1000, centerline);
    }
    expect(s.state).toBe('open');
    expect(s.consecutiveFailures).toBe(FAILURE_THRESHOLD);
    expect(s.consecutiveOpenings).toBe(1);
    expect(s.nextAttemptAt).toBe(NOW + (FAILURE_THRESHOLD - 1) * 1000 + BASE_TIMEOUT_MS);
    expect(s.halfOpenAttempts).toBe(0);
  });

  it('preserves prior lastSuccessAt across the open transition', () => {
    let s = make({ lastSuccessAt: NOW - 60_000 });
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      s = onCircuitFailure(s, NOW + i, centerline);
    }
    expect(s.lastSuccessAt).toBe(NOW - 60_000);
  });
});

describe('onCircuitFailure — half-open → open (probe failed)', () => {
  it('re-opens with consecutiveOpenings bumped and fresh nextAttemptAt', () => {
    const s = make({
      state: 'half-open',
      consecutiveFailures: FAILURE_THRESHOLD,
      consecutiveOpenings: 1,
      halfOpenAttempts: 0,
      nextAttemptAt: NOW - 1000,
      lastSuccessAt: null,
    });
    const next = onCircuitFailure(s, NOW, centerline);
    expect(next.state).toBe('open');
    expect(next.consecutiveOpenings).toBe(2);
    // opening=2 → BASE × 2^1 = 60_000.
    expect(next.nextAttemptAt).toBe(NOW + BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER);
    expect(next.halfOpenAttempts).toBe(1);
  });

  it('backoff grows exponentially across repeated probe failures', () => {
    let s = make({
      state: 'half-open',
      consecutiveFailures: FAILURE_THRESHOLD,
      consecutiveOpenings: 1,
    });
    const targets: number[] = [];
    // Cycle open → half-open → open three times.
    for (let i = 0; i < 3; i++) {
      s = onCircuitFailure(s, NOW + i * 1000, centerline);
      targets.push(s.nextAttemptAt! - (NOW + i * 1000));
      s = transitionOpenToHalfOpen(s, s.nextAttemptAt!);
    }
    expect(targets[0]).toBe(BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER); // opening=2
    expect(targets[1]).toBe(BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER ** 2); // opening=3
    expect(targets[2]).toBe(BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER ** 3); // opening=4
  });
});

describe('onCircuitFailure — open → open (manual-bypass failure)', () => {
  it('does not re-bump consecutiveOpenings when already open', () => {
    const s = make({
      state: 'open',
      consecutiveOpenings: 3,
      nextAttemptAt: NOW - 1000, // past — bypass forced the attempt
      consecutiveFailures: 5,
    });
    const next = onCircuitFailure(s, NOW, centerline);
    expect(next.state).toBe('open');
    expect(next.consecutiveOpenings).toBe(3); // unchanged
    // `nextAttemptAt` refreshed to now + backoff @ opening=3.
    expect(next.nextAttemptAt).toBe(NOW + BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER ** 2);
    expect(next.consecutiveFailures).toBe(6);
  });
});

// ── Success transitions ───────────────────────────────────────────

describe('onCircuitSuccess', () => {
  it('closed → closed: clears failures + lastErrorAt, stamps lastSuccessAt', () => {
    const s = make({ consecutiveFailures: 2, lastErrorAt: NOW - 1000 });
    const next = onCircuitSuccess(s, NOW);
    expect(next.state).toBe('closed');
    expect(next.consecutiveFailures).toBe(0);
    expect(next.lastErrorAt).toBeNull();
    expect(next.lastSuccessAt).toBe(NOW);
  });

  it('half-open → closed on probe success', () => {
    const s = make({
      state: 'half-open',
      consecutiveFailures: FAILURE_THRESHOLD,
      consecutiveOpenings: 2,
      halfOpenAttempts: 1,
      nextAttemptAt: NOW - 1000,
    });
    const next = onCircuitSuccess(s, NOW);
    expect(next.state).toBe('closed');
    expect(next.nextAttemptAt).toBeNull();
    expect(next.halfOpenAttempts).toBe(0);
  });

  it('open → closed defensively (manual bypass success)', () => {
    const s = make({
      state: 'open',
      consecutiveOpenings: 4,
      nextAttemptAt: NOW + 60_000,
    });
    const next = onCircuitSuccess(s, NOW);
    expect(next.state).toBe('closed');
  });

  it('decays consecutiveOpenings by half when last success is aged', () => {
    const aged = NOW - CONSECUTIVE_OPENINGS_DECAY_MS - 1;
    const s = make({ state: 'half-open', consecutiveOpenings: 4, lastSuccessAt: aged });
    const next = onCircuitSuccess(s, NOW);
    // 4 / 2 = 2
    expect(next.consecutiveOpenings).toBe(2);
  });

  it('decays consecutiveOpenings by one when last success is recent', () => {
    const recent = NOW - 1000;
    const s = make({ state: 'half-open', consecutiveOpenings: 4, lastSuccessAt: recent });
    const next = onCircuitSuccess(s, NOW);
    expect(next.consecutiveOpenings).toBe(3);
  });

  it('decays to 0 with halving when no prior success exists', () => {
    // 1 / 2 = 0 floored.
    const s = make({ state: 'half-open', consecutiveOpenings: 1, lastSuccessAt: null });
    expect(onCircuitSuccess(s, NOW).consecutiveOpenings).toBe(0);
  });

  it('leaves 0 at 0', () => {
    const s = make({ consecutiveOpenings: 0 });
    expect(onCircuitSuccess(s, NOW).consecutiveOpenings).toBe(0);
  });
});

// ── Full lifecycles ───────────────────────────────────────────────

describe('full lifecycle: healthy → degraded → open → probe → closed', () => {
  it('traverses the expected states under a canonical failure/recovery sequence', () => {
    let s = initialCircuitSnapshot();

    // Two pre-breaker failures — still closed.
    s = onCircuitFailure(s, NOW, centerline);
    s = onCircuitFailure(s, NOW + 5_000, centerline);
    expect(s.state).toBe('closed');
    expect(s.consecutiveFailures).toBe(2);

    // Third failure opens the circuit.
    s = onCircuitFailure(s, NOW + 10_000, centerline);
    expect(s.state).toBe('open');
    expect(canAttempt(s, NOW + 10_000)).toBe(false);

    // Chrome alarm fires at nextAttemptAt — scheduler eagerly moves
    // the snapshot to half-open before dispatching the probe.
    const probeAt = s.nextAttemptAt!;
    s = transitionOpenToHalfOpen(s, probeAt);
    expect(s.state).toBe('half-open');
    expect(canAttempt(s, probeAt)).toBe(true);

    // Probe succeeds — circuit closes.
    s = onCircuitSuccess(s, probeAt + 500);
    expect(s.state).toBe('closed');
    expect(s.consecutiveFailures).toBe(0);
    expect(s.lastErrorAt).toBeNull();
    expect(s.lastSuccessAt).toBe(probeAt + 500);
    // consecutiveOpenings decayed: was 1, aged=false (just set lastSuccessAt),
    // so decrement-by-one → 0.
    expect(s.consecutiveOpenings).toBe(0);
  });
});

describe('full lifecycle: repeated provider outage (flap)', () => {
  it('accumulates consecutiveOpenings across back-to-back open cycles', () => {
    let s = initialCircuitSnapshot();
    const openCycle = (base: number): void => {
      for (let i = 0; i < FAILURE_THRESHOLD; i++) s = onCircuitFailure(s, base + i * 1000, centerline);
      const probeAt = s.nextAttemptAt!;
      s = transitionOpenToHalfOpen(s, probeAt);
      s = onCircuitFailure(s, probeAt, centerline); // probe fails → back to open
    };
    openCycle(NOW);
    expect(s.consecutiveOpenings).toBe(2); // 1 from initial open, +1 from probe failure
    // Now probe at the new nextAttemptAt and fail again.
    const probeAt = s.nextAttemptAt!;
    s = transitionOpenToHalfOpen(s, probeAt);
    s = onCircuitFailure(s, probeAt, centerline);
    expect(s.consecutiveOpenings).toBe(3);
    // Backoff should now be BASE × 2^2 = 120s.
    expect(s.nextAttemptAt).toBe(probeAt + BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER ** 2);
  });
});

describe('full lifecycle: provider recovers → openings age out across multiple successes', () => {
  it('halves openings on each "aged" success', () => {
    // Start with a deep history of openings from a prior incident.
    let s = make({
      state: 'half-open',
      consecutiveFailures: FAILURE_THRESHOLD,
      consecutiveOpenings: 8,
      halfOpenAttempts: 0,
      nextAttemptAt: NOW - 1000,
      lastSuccessAt: NOW - CONSECUTIVE_OPENINGS_DECAY_MS - 1,
    });
    // First success closes the circuit; lastSuccessAt=NOW.
    s = onCircuitSuccess(s, NOW);
    expect(s.consecutiveOpenings).toBe(4); // halved (was aged)

    // Now the provider keeps working for a while. Each subsequent
    // success in the recent window decrements by one.
    s = onCircuitSuccess(s, NOW + 10_000);
    expect(s.consecutiveOpenings).toBe(3);
    s = onCircuitSuccess(s, NOW + 20_000);
    expect(s.consecutiveOpenings).toBe(2);

    // Fast-forward past the decay window — next success halves again.
    s = onCircuitSuccess(s, NOW + CONSECUTIVE_OPENINGS_DECAY_MS + 30_000);
    expect(s.consecutiveOpenings).toBe(1);
  });
});

// ── Manual bypass ─────────────────────────────────────────────────

describe('manual bypass', () => {
  it('success via manual bypass closes a currently-open circuit', () => {
    const s = make({
      state: 'open',
      consecutiveOpenings: 3,
      nextAttemptAt: NOW + 60 * 60_000, // 1h — user doesn't want to wait
      lastSuccessAt: null,
    });
    // Platform: markManualBypass is a no-op on state (just a log hook),
    // then the attempt runs, then onCircuitSuccess applies. lastSuccessAt
    // was null → aged branch → halve: Math.floor(3/2) = 1.
    const next = onCircuitSuccess(s, NOW);
    expect(next.state).toBe('closed');
    expect(next.nextAttemptAt).toBeNull();
    expect(next.consecutiveOpenings).toBe(1);
  });

  it('failure via manual bypass refreshes nextAttemptAt but keeps openings stable', () => {
    const s = make({
      state: 'open',
      consecutiveOpenings: 3,
      nextAttemptAt: NOW + 60 * 60_000,
      consecutiveFailures: 5,
    });
    const next = onCircuitFailure(s, NOW, centerline);
    expect(next.state).toBe('open');
    expect(next.consecutiveOpenings).toBe(3); // unchanged
    expect(next.nextAttemptAt).toBe(NOW + BASE_TIMEOUT_MS * BACKOFF_MULTIPLIER ** 2);
  });
});

// ── resetCircuit ──────────────────────────────────────────────────

describe('resetCircuit', () => {
  it('returns a brand-new closed snapshot', () => {
    expect(resetCircuit()).toEqual(initialCircuitSnapshot());
  });
});
