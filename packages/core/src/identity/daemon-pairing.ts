/**
 * In-memory pairing-code service for the daemon device-flow UX (U3.3,
 * the unified-oracle model §4.2 step 3 + the data-plane topologies design
 * §11.4 hybrid improvement).
 *
 * Owns the short-lived `code → PendingPair` table the daemon admin
 * surface fills (when "Pair a device" is clicked) and the HTTP confirm
 * page consumes (when a peer opens the pairing URL). On confirm, mints
 * a real {@link mintDaemonAuthToken} row and returns its raw secret
 * once — same one-shot semantics as the manual generate flow, just
 * reached through a different gesture.
 *
 * Deliberately not persisted: a daemon restart invalidates every
 * pending code, which is the correct semantics (a half-typed pairing
 * shouldn't survive a process bounce). Confirmed pairings live on as
 * normal `DaemonAuthToken` rows in `hostStorage`.
 *
 * The service is host-neutral — it makes no assumption about whether
 * the transport is HTTP, IPC, or anything else. Callers wire it into
 * whatever surface they own.
 *
 * Brute-force floor. A 6-digit code is ~20 bits; on loopback an attacker
 * can fire thousands of guesses/sec, so the 5-min window is long enough
 * to sweep the space without a limiter. The guard lives here — not in any
 * one transport — so every surface (HTTP, future IPC) inherits it, and it
 * covers BOTH lookups: `confirm` (POST) *and* `peek` (the GET confirm
 * page, which is the cheaper enumeration oracle since a pending code
 * answers differently from an unknown one). It is a single GLOBAL budget
 * on *failed* (unknown-code) lookups, not per-code — a sweep varies the
 * code, so per-code counting never trips — and not per-IP, since loopback
 * collapses every attacker to `127.0.0.1`. Counting only unknown-code
 * lookups keeps a legitimate human (one valid GET + one valid POST) off
 * the meter entirely; once the budget trips, the whole surface fails
 * closed for a short cooldown (uniform "unknown" — no oracle leak).
 */

import { mintDaemonAuthToken } from './daemon-auth-tokens';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes — matches §11.4 hybrid pattern
const DEFAULT_CODE_LENGTH = 6;
const CODE_DIGITS = '0123456789';
// Cap concurrent pending pairs so a misbehaving caller can't exhaust
// the 6-digit space (1M codes) and lock out legitimate pairings.
const MAX_PENDING = 32;
// Brute-force budget: how many unknown-code lookups inside the rolling
// window trip the lockout. ~1 pending code in 1M means each guess lands
// with p ≈ 1e-6; capping bursts at 50/min and locking 60s caps a sweep
// at ~150 guesses across a 5-min code lifetime (p_hit ≈ 1.5e-4) while a
// real human (valid GET + valid POST) never registers a failure.
const DEFAULT_MAX_FAILED_LOOKUPS = 50;
const DEFAULT_FAILURE_WINDOW_MS = 60 * 1000;
const DEFAULT_LOCKOUT_MS = 60 * 1000;

export type PendingPairStatus = 'pending' | 'confirmed' | 'expired' | 'consumed';

export interface PendingPair {
  readonly code: string;
  readonly deviceLabel?: string;
  /** Directory user the confirmed token will bind to; absent → unbound. */
  readonly userId?: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly status: PendingPairStatus;
}

export interface StartPairInput {
  /** Optional admin-supplied hint for which device this code is for. */
  deviceLabel?: string;
  /**
   * Directory user (`OH.daemonUsers`) the minted token binds to on
   * confirm. Omitted → an unbound token that acts as the daemon
   * operator (the solo tier's every pairing).
   */
  userId?: string;
}

export interface StartPairResult {
  readonly code: string;
  readonly expiresAt: number;
}

export type ConfirmPairResult =
  | { readonly ok: true; readonly secret: string; readonly tokenId: string }
  | { readonly ok: false; readonly reason: 'unknown' | 'expired' | 'consumed' };

export interface DaemonPairingServiceOptions {
  /** TTL for an unconfirmed pair. Defaults to 5 minutes. */
  ttlMs?: number;
  /** Length of the generated numeric code. Defaults to 6. */
  codeLength?: number;
  /**
   * Unknown-code lookups (across `peek` + `confirm`) inside
   * {@link failureWindowMs} before the surface locks out. Defaults to 50.
   */
  maxFailedLookups?: number;
  /** Rolling window over which failed lookups accumulate. Defaults to 60s. */
  failureWindowMs?: number;
  /** How long the surface stays locked once the budget trips. Defaults to 60s. */
  lockoutMs?: number;
  /** Test seam — defaults to `Date.now()`. */
  now?: () => number;
  /**
   * Test seam — defaults to crypto-random 6-digit string. Overrides
   * MUST return a non-empty string of digits.
   */
  generateCode?: () => string;
  /**
   * Test seam — defaults to {@link mintDaemonAuthToken}. The pairing
   * flow MUST go through the same persistence path as manual mint so
   * the resulting token is indistinguishable from any other on the
   * daemon-side ledger.
   */
  mintToken?: typeof mintDaemonAuthToken;
}

export interface DaemonPairingService {
  /**
   * Register a fresh pending pair. The returned `code` is what the
   * admin displays + reads aloud; `expiresAt` drives the modal's
   * countdown.
   */
  startPair(input?: StartPairInput): StartPairResult;
  /**
   * Read the current pending state for a code without consuming it —
   * used by the HTTP confirm page on GET. Returns null on
   * unknown/garbage-collected codes.
   */
  peek(code: string): PendingPair | null;
  /**
   * Confirm a pairing — mints a fresh `DaemonAuthToken` and returns
   * the raw secret once. After a successful confirm the code can never
   * confirm again; further calls return `reason: 'consumed'`.
   */
  confirm(code: string, input?: StartPairInput): Promise<ConfirmPairResult>;
  /** Drop a pending pair without minting — for an admin "Cancel" gesture. */
  cancel(code: string): void;
  /** Snapshot of in-flight pairs — for status RPCs / tests. */
  list(): readonly PendingPair[];
  /** Stop the GC timer and release all entries. Idempotent. */
  dispose(): void;
}

/**
 * Exported for tests. Rejection-samples so every digit is uniform:
 * a bare `byte % 10` favors 0–5 (26/256) over 6–9 (25/256); skipping
 * bytes ≥ 250 (the largest multiple of 10 below 256) removes the bias.
 */
export function defaultGenerateCode(length: number): string {
  // Cryptographic randomness so codes can't be guessed from a clock
  // value or a per-process counter. 6 digits = 20 bits of entropy; the
  // TTL plus the failed-lookup limiter (see the service's module doc) are
  // what bound the brute-force surface, not the entropy alone.
  const bytes = new Uint8Array(length);
  let out = '';
  while (out.length < length) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && out.length < length; i++) {
      if (bytes[i] < 250) out += CODE_DIGITS[bytes[i] % 10];
    }
  }
  return out;
}

export function createDaemonPairingService(options: DaemonPairingServiceOptions = {}): DaemonPairingService {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const codeLength = options.codeLength ?? DEFAULT_CODE_LENGTH;
  const now = options.now ?? Date.now;
  const generateCode = options.generateCode ?? (() => defaultGenerateCode(codeLength));
  const mintToken = options.mintToken ?? mintDaemonAuthToken;
  const maxFailedLookups = options.maxFailedLookups ?? DEFAULT_MAX_FAILED_LOOKUPS;
  const failureWindowMs = options.failureWindowMs ?? DEFAULT_FAILURE_WINDOW_MS;
  const lockoutMs = options.lockoutMs ?? DEFAULT_LOCKOUT_MS;

  const pending = new Map<string, PendingPair>();
  // Brute-force guard state (see module doc). `failureTimes` holds the
  // timestamps of recent unknown-code lookups within the rolling window;
  // `lockedUntil` is the cooldown deadline once the budget trips.
  const failureTimes: number[] = [];
  let lockedUntil = 0;
  let disposed = false;

  function isLocked(t: number): boolean {
    return t < lockedUntil;
  }

  // Record one unknown-code lookup and trip the lockout if the rolling
  // window is now over budget. Shared by `peek` and `confirm` so a
  // GET-then-POST sweep draws from a single budget.
  function recordFailedLookup(t: number): void {
    const cutoff = t - failureWindowMs;
    while (failureTimes.length > 0 && failureTimes[0] <= cutoff) failureTimes.shift();
    failureTimes.push(t);
    if (failureTimes.length >= maxFailedLookups) {
      lockedUntil = t + lockoutMs;
      // The lockout now governs; clear the window so post-cooldown traffic
      // starts from a clean budget rather than re-tripping immediately.
      failureTimes.length = 0;
    }
  }

  function sweep(): void {
    if (disposed) return;
    const t = now();
    for (const [code, entry] of pending) {
      if (entry.status === 'pending' && entry.expiresAt <= t) {
        pending.set(code, { ...entry, status: 'expired' });
      }
    }
  }

  function freshCode(): string {
    // Retry on collision against any non-garbage-collected entry.
    // With 1M codes and capped pending count, the loop terminates
    // almost immediately in practice.
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = generateCode();
      if (!pending.has(candidate)) return candidate;
    }
    throw new Error('createDaemonPairingService: failed to find a non-colliding code after 100 attempts');
  }

  return {
    startPair(input) {
      if (disposed) throw new Error('DaemonPairingService is disposed');
      sweep();
      // Drop entries that are no longer pending so the cap reflects
      // truly in-flight pairs, not historical noise.
      for (const [code, entry] of pending) {
        if (entry.status !== 'pending') pending.delete(code);
      }
      if (pending.size >= MAX_PENDING) {
        throw new Error('Too many pending pair codes; cancel one or wait for them to expire');
      }
      const t = now();
      const code = freshCode();
      const entry: PendingPair = {
        code,
        deviceLabel: input?.deviceLabel,
        ...(input?.userId !== undefined ? { userId: input.userId } : {}),
        createdAt: t,
        expiresAt: t + ttlMs,
        status: 'pending',
      };
      pending.set(code, entry);
      return { code, expiresAt: entry.expiresAt };
    },

    peek(code) {
      const t = now();
      sweep();
      // Fail closed during a lockout: every lookup answers "unknown" so a
      // sweep can't resume probing, and a real code is indistinguishable.
      if (isLocked(t)) return null;
      const entry = pending.get(code);
      if (!entry) {
        recordFailedLookup(t);
        return null;
      }
      return entry;
    },

    async confirm(code, input) {
      const t = now();
      sweep();
      // Fail closed during a lockout — uniform "unknown", same as `peek`,
      // so a sweep gains nothing by switching from GET probes to POSTs.
      if (isLocked(t)) return { ok: false, reason: 'unknown' };
      const entry = pending.get(code);
      if (!entry) {
        recordFailedLookup(t);
        return { ok: false, reason: 'unknown' };
      }
      if (entry.status === 'expired') return { ok: false, reason: 'expired' };
      if (entry.status === 'consumed' || entry.status === 'confirmed') {
        return { ok: false, reason: 'consumed' };
      }
      // Reserve the slot BEFORE we touch persistence so a parallel
      // double-confirm can't race two mint calls onto the same code.
      pending.set(code, { ...entry, status: 'confirmed' });
      try {
        const label = input?.deviceLabel ?? entry.deviceLabel;
        const userId = input?.userId ?? entry.userId;
        const minted = await mintToken({ label, ...(userId !== undefined ? { userId } : {}) });
        // After the token is durably persisted, mark consumed so a
        // late retry from the same browser tab sees "consumed" rather
        // than "unknown" — it gives the admin a clearer log entry.
        pending.set(code, { ...entry, status: 'consumed' });
        return { ok: true, secret: minted.secret, tokenId: minted.record.id };
      } catch (err) {
        // Mint failed (e.g. storage write error) — release the code so
        // the user can retry. Surface the underlying error to the caller.
        pending.set(code, entry);
        throw err;
      }
    },

    cancel(code) {
      pending.delete(code);
    },

    list() {
      sweep();
      return [...pending.values()];
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      pending.clear();
    },
  };
}
