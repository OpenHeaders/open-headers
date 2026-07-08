/**
 * Per-peer brute-force limiter (Phase 3) — sliding-window counting,
 * the block transition (signalled exactly once), cool-down expiry,
 * window pruning, and per-peer isolation. Clock injected; no timers.
 */

import { describe, expect, it } from 'vitest';
import { createPeerRateLimiter, RATE_LIMIT_DEFAULTS } from '../../../src/daemon/rate-limiter';

function makeLimiter(overrides: { maxFailures?: number; windowMs?: number; blockMs?: number } = {}) {
  let at = 1_000_000;
  const limiter = createPeerRateLimiter({
    maxFailures: overrides.maxFailures ?? 3,
    windowMs: overrides.windowMs ?? 60_000,
    blockMs: overrides.blockMs ?? 300_000,
    now: () => at,
  });
  return { limiter, advance: (ms: number) => (at += ms) };
}

describe('createPeerRateLimiter', () => {
  it('blocks after maxFailures inside the window and reports the transition once', () => {
    const { limiter } = makeLimiter();
    expect(limiter.recordFailure('10.0.0.9')).toBe(false);
    expect(limiter.recordFailure('10.0.0.9')).toBe(false);
    expect(limiter.isBlocked('10.0.0.9')).toBe(false);
    expect(limiter.recordFailure('10.0.0.9')).toBe(true);
    expect(limiter.isBlocked('10.0.0.9')).toBe(true);
    // Further failures while blocked are not a new transition.
    expect(limiter.recordFailure('10.0.0.9')).toBe(false);
  });

  it('failures outside the window do not count', () => {
    const { limiter, advance } = makeLimiter();
    limiter.recordFailure('10.0.0.9');
    limiter.recordFailure('10.0.0.9');
    advance(61_000);
    expect(limiter.recordFailure('10.0.0.9')).toBe(false);
    expect(limiter.isBlocked('10.0.0.9')).toBe(false);
  });

  it('unblocks after the cool-down and reports remaining time while blocked', () => {
    const { limiter, advance } = makeLimiter();
    limiter.recordFailure('10.0.0.9');
    limiter.recordFailure('10.0.0.9');
    limiter.recordFailure('10.0.0.9');
    expect(limiter.blockedRemainingMs('10.0.0.9')).toBe(300_000);
    advance(299_999);
    expect(limiter.isBlocked('10.0.0.9')).toBe(true);
    advance(1);
    expect(limiter.isBlocked('10.0.0.9')).toBe(false);
    expect(limiter.blockedRemainingMs('10.0.0.9')).toBe(0);
  });

  it('keys peers independently', () => {
    const { limiter } = makeLimiter();
    limiter.recordFailure('10.0.0.9');
    limiter.recordFailure('10.0.0.9');
    limiter.recordFailure('10.0.0.9');
    expect(limiter.isBlocked('10.0.0.9')).toBe(true);
    expect(limiter.isBlocked('10.0.0.10')).toBe(false);
  });

  it('exposes the effective tuning and sensible defaults', () => {
    const { limiter } = makeLimiter({ maxFailures: 7 });
    expect(limiter.maxFailures).toBe(7);
    const defaulted = createPeerRateLimiter();
    expect(defaulted.maxFailures).toBe(RATE_LIMIT_DEFAULTS.maxFailures);
    expect(defaulted.windowMs).toBe(RATE_LIMIT_DEFAULTS.windowMs);
    expect(defaulted.blockMs).toBe(RATE_LIMIT_DEFAULTS.blockMs);
  });
});
