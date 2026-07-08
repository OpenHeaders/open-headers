/**
 * Per-peer brute-force limiter for the daemon's token-bearing entry
 * points (Phase 3, DAEMON_PLAN.md §7): pairing-code guesses, WS HELLO
 * auth failures, and `/mcp` bearer rejections all feed one counter per
 * peer address. Crossing the failure budget inside the sliding window
 * blocks the peer for a fixed cool-down; while blocked, rate-limited
 * routes answer 429 / close the upgrade before any token is evaluated.
 *
 * In-memory by design — a daemon restart clears the table, which is the
 * right trade-off for a single-process host (the ledger itself is the
 * durable defense; this limiter only makes online guessing slow).
 */

interface PeerFailureState {
  /** Failure timestamps inside the current window, oldest first. */
  failures: number[];
  /** Epoch ms until which the peer is blocked; 0 = not blocked. */
  blockedUntil: number;
}

export interface RateLimiterOptions {
  /** Failures inside `windowMs` that trigger a block. */
  maxFailures?: number;
  /** Sliding window the failures are counted over (ms). */
  windowMs?: number;
  /** How long a peer stays blocked once it crosses the budget (ms). */
  blockMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

export interface PeerRateLimiter {
  isBlocked(key: string): boolean;
  /**
   * Record one failed attempt for `key`. Returns `true` exactly when
   * this failure crossed the peer into the blocked state — the caller's
   * cue to emit the one throttle log line.
   */
  recordFailure(key: string): boolean;
  /** Remaining block time in ms; 0 when not blocked. */
  blockedRemainingMs(key: string): number;
  readonly maxFailures: number;
  readonly windowMs: number;
  readonly blockMs: number;
}

export const RATE_LIMIT_DEFAULTS = {
  maxFailures: 10,
  windowMs: 60_000,
  blockMs: 300_000,
} as const;

/** Sweep the whole table once it grows past this many peers. */
const SWEEP_THRESHOLD = 4096;

export function createPeerRateLimiter(options: RateLimiterOptions = {}): PeerRateLimiter {
  const maxFailures = options.maxFailures ?? RATE_LIMIT_DEFAULTS.maxFailures;
  const windowMs = options.windowMs ?? RATE_LIMIT_DEFAULTS.windowMs;
  const blockMs = options.blockMs ?? RATE_LIMIT_DEFAULTS.blockMs;
  const now = options.now ?? Date.now;

  const peers = new Map<string, PeerFailureState>();

  function prune(state: PeerFailureState, at: number): void {
    if (state.blockedUntil !== 0 && state.blockedUntil <= at) state.blockedUntil = 0;
    const cutoff = at - windowMs;
    while (state.failures.length > 0 && state.failures[0] <= cutoff) state.failures.shift();
  }

  function isStateEmpty(state: PeerFailureState): boolean {
    return state.blockedUntil === 0 && state.failures.length === 0;
  }

  /** Drop every fully-expired peer so an address-rotating scanner can't grow the table unbounded. */
  function sweep(at: number): void {
    for (const [key, state] of peers) {
      prune(state, at);
      if (isStateEmpty(state)) peers.delete(key);
    }
  }

  function getState(key: string, at: number): PeerFailureState | undefined {
    const state = peers.get(key);
    if (!state) return undefined;
    prune(state, at);
    if (isStateEmpty(state)) {
      peers.delete(key);
      return undefined;
    }
    return state;
  }

  return {
    maxFailures,
    windowMs,
    blockMs,
    isBlocked(key) {
      const state = getState(key, now());
      return state !== undefined && state.blockedUntil !== 0;
    },
    blockedRemainingMs(key) {
      const at = now();
      const state = getState(key, at);
      if (!state || state.blockedUntil === 0) return 0;
      return state.blockedUntil - at;
    },
    recordFailure(key) {
      const at = now();
      if (peers.size > SWEEP_THRESHOLD) sweep(at);
      let state = peers.get(key);
      if (!state) {
        state = { failures: [], blockedUntil: 0 };
        peers.set(key, state);
      }
      prune(state, at);
      if (state.blockedUntil !== 0) return false; // already blocked — no transition
      state.failures.push(at);
      if (state.failures.length < maxFailures) return false;
      state.failures = [];
      state.blockedUntil = at + blockMs;
      return true;
    },
  };
}
