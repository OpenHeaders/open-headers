/**
 * In-memory pairing-code service for the daemon device-flow UX (U3.3,
 * `UNIFIED_ORACLE_MODEL.md` §4.2 step 3 + `DATA_PLANE_TOPOLOGIES.md`
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
 */

import { mintDaemonAuthToken } from './daemon-auth-tokens';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes — matches §11.4 hybrid pattern
const DEFAULT_CODE_LENGTH = 6;
const CODE_DIGITS = '0123456789';
// Cap concurrent pending pairs so a misbehaving caller can't exhaust
// the 6-digit space (1M codes) and lock out legitimate pairings.
const MAX_PENDING = 32;

export type PendingPairStatus = 'pending' | 'confirmed' | 'expired' | 'consumed';

export interface PendingPair {
  readonly code: string;
  readonly deviceLabel?: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly status: PendingPairStatus;
}

export interface StartPairInput {
  /** Optional admin-supplied hint for which device this code is for. */
  deviceLabel?: string;
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

function defaultGenerateCode(length: number): string {
  // Cryptographic randomness so codes can't be guessed from a clock
  // value or a per-process counter. 6 digits = 20 bits of entropy; the
  // TTL + per-code lookup-only HTTP route is what bounds the brute-force
  // surface, not the entropy.
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_DIGITS[bytes[i] % 10];
  }
  return out;
}

export function createDaemonPairingService(options: DaemonPairingServiceOptions = {}): DaemonPairingService {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const codeLength = options.codeLength ?? DEFAULT_CODE_LENGTH;
  const now = options.now ?? Date.now;
  const generateCode = options.generateCode ?? (() => defaultGenerateCode(codeLength));
  const mintToken = options.mintToken ?? mintDaemonAuthToken;

  const pending = new Map<string, PendingPair>();
  let disposed = false;

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
        createdAt: t,
        expiresAt: t + ttlMs,
        status: 'pending',
      };
      pending.set(code, entry);
      return { code, expiresAt: entry.expiresAt };
    },

    peek(code) {
      sweep();
      return pending.get(code) ?? null;
    },

    async confirm(code, input) {
      sweep();
      const entry = pending.get(code);
      if (!entry) return { ok: false, reason: 'unknown' };
      if (entry.status === 'expired') return { ok: false, reason: 'expired' };
      if (entry.status === 'consumed' || entry.status === 'confirmed') {
        return { ok: false, reason: 'consumed' };
      }
      // Reserve the slot BEFORE we touch persistence so a parallel
      // double-confirm can't race two mint calls onto the same code.
      pending.set(code, { ...entry, status: 'confirmed' });
      try {
        const label = input?.deviceLabel ?? entry.deviceLabel;
        const minted = await mintToken({ label });
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
