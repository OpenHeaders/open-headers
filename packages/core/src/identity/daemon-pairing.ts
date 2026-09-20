/**
 * In-memory pairing-code service for the daemon device-flow UX (U3.3,
 * the unified-oracle model §4.2 step 3 + the data-plane topologies design
 * §11.4 hybrid improvement; the client initiative from the client
 * sign-in plan §6.1).
 *
 * Owns the short-lived `code → PendingPair` table two initiatives fill:
 *
 *   - **admin** — the daemon admin surface starts a pair ("Pair a
 *     device"), a peer opens the pairing URL and confirms; `confirm`
 *     mints a real {@link mintDaemonAuthToken} row and returns its raw
 *     secret once TO THE CONFIRMER — same one-shot semantics as the
 *     manual generate flow, just reached through a different gesture.
 *   - **client** — a native client (the extension, the desktop app, the
 *     CLI) starts a pair and receives two things: a short user code it
 *     shows, and a long poll handle it holds. The person approves the
 *     code on the server's own page by signing in; `poll` then mints the
 *     device credential and answers the secret ONCE to the holder of the
 *     handle. The code alone never yields a secret, so a person who was
 *     tricked into approving a stranger's code hands them nothing the
 *     stranger did not already hold — the secret rides the poll handle
 *     only. Minting happens at poll, not at approve: nothing is minted
 *     that nobody receives, and a restart mid-flow orphans no ledger row.
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
 * covers EVERY lookup that answers differently for a live entry than for
 * an unknown one: `confirm` (POST), `peek` (the GET confirm page, the
 * cheaper enumeration oracle), `approve` / `deny` (the device page's
 * forms), and `poll` (an unknown handle). It is a single GLOBAL budget
 * on *failed* (unknown) lookups, not per-code — a sweep varies the code,
 * so per-code counting never trips — and not per-IP, since loopback
 * collapses every attacker to `127.0.0.1`. Counting only unknown lookups
 * keeps a legitimate human (one valid GET + one valid POST) and a
 * legitimate client (polling its own live handle) off the meter
 * entirely; once the budget trips, the whole surface fails closed for a
 * short cooldown (uniform "unknown" — no oracle leak).
 *
 * Pending caps. Admin pairs and client pairs draw on SEPARATE caps so an
 * anonymous flood of client starts can never starve the admin's own
 * pairing, plus a per-peer concurrent cap on client pairs so one
 * address cannot fill the client cap alone (the plan's §11 starvation
 * hazard).
 */

import { bytesToBase64Url, mintDaemonAuthToken, sha256Hex } from './daemon-auth-tokens';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes — matches §11.4 hybrid pattern
const DEFAULT_CODE_LENGTH = 6;
const CODE_DIGITS = '0123456789';
// Cap concurrent pending pairs so a misbehaving caller can't exhaust
// the 6-digit space (1M codes) and lock out legitimate pairings.
const MAX_PENDING = 32;
// The client initiative's own cap, beside the admin cap, and its
// per-peer share of it — an anonymous start needs no credential, so the
// bound is what keeps a flood from denying pairing to everyone.
const MAX_CLIENT_PENDING = 32;
const MAX_CLIENT_PENDING_PER_PEER = 4;
// Brute-force budget: how many unknown-code lookups inside the rolling
// window trip the lockout. ~1 pending code in 1M means each guess lands
// with p ≈ 1e-6; capping bursts at 50/min and locking 60s caps a sweep
// at ~150 guesses across a 5-min code lifetime (p_hit ≈ 1.5e-4) while a
// real human (valid GET + valid POST) never registers a failure.
const DEFAULT_MAX_FAILED_LOOKUPS = 50;
const DEFAULT_FAILURE_WINDOW_MS = 60 * 1000;
const DEFAULT_LOCKOUT_MS = 60 * 1000;
// A settled client pair (denied, expired, consumed) stays answerable to
// its poll handle for this long past its expiry so the client learns the
// verdict instead of an "unknown" that would count against the budget.
const CLIENT_RETIRE_GRACE_MS = DEFAULT_TTL_MS;
// The device credential's lifetime when the host injects no policy —
// the same 30 days every session-kind mint defaults to.
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const POLL_TOKEN_BYTES = 32;

/**
 * `confirmed` is the mint-in-flight reservation both initiatives hold
 * between reserving the slot and the ledger write landing; `approved`
 * and `denied` are client-initiative verdicts awaiting the poll.
 */
export type PendingPairStatus = 'pending' | 'confirmed' | 'expired' | 'consumed' | 'approved' | 'denied';

export type PendingPairInitiative = 'admin' | 'client';

/** The native client a client-initiated pair speaks for. */
export type DaemonPairingClientKind = 'extension' | 'desktop' | 'cli';

export const DAEMON_PAIRING_CLIENT_KINDS: readonly DaemonPairingClientKind[] = ['extension', 'desktop', 'cli'];

export interface PendingPair {
  readonly code: string;
  readonly initiative: PendingPairInitiative;
  readonly deviceLabel?: string;
  /** Admin initiative: directory user the confirmed token will bind to; absent → unbound. */
  readonly userId?: string;
  /** Client initiative: which client asked. */
  readonly client?: DaemonPairingClientKind;
  /** Client initiative: the admission-resolved address the start came from — what the page names. */
  readonly peer?: string;
  /** Client initiative: the person who approved the code; set by `approve`. */
  readonly approvedUserId?: string;
  /** Client initiative: SHA-256 of the poll handle — never the handle. */
  readonly pollTokenHash?: string;
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

export interface StartClientPairInput {
  /** The client's own name for this device, shown on the approval page. */
  deviceLabel?: string;
  client: DaemonPairingClientKind;
  /** The admission-resolved address the start came from. */
  peer: string;
}

export interface StartClientPairResult {
  readonly code: string;
  /** The poll handle — surfaced exactly once; only its hash is stored. */
  readonly pollToken: string;
  readonly expiresAt: number;
}

export type ConfirmPairResult =
  | { readonly ok: true; readonly secret: string; readonly tokenId: string }
  | { readonly ok: false; readonly reason: 'unknown' | 'expired' | 'consumed' };

/** `not-client` = an admin-initiated pair reached a client-initiative verb (or the reverse). */
export type ApprovePairFailureReason = 'unknown' | 'expired' | 'consumed' | 'denied' | 'not-client';

export type ApprovePairResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ApprovePairFailureReason };

export type PollPairResult =
  | { readonly status: 'pending'; readonly expiresAt: number }
  | { readonly status: 'approved'; readonly secret: string; readonly tokenId: string; readonly userId: string }
  | { readonly status: 'denied' }
  | { readonly status: 'expired' }
  | { readonly status: 'unknown' };

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
  /**
   * Lifetime of the device credential a client pair's poll mints — the
   * host's one session TTL policy. Defaults to 30 days.
   */
  sessionTtlMs?: number;
  /** Test seam — defaults to `Date.now()`. */
  now?: () => number;
  /**
   * Test seam — defaults to crypto-random 6-digit string. Overrides
   * MUST return a non-empty string of digits.
   */
  generateCode?: () => string;
  /** Test seam — defaults to 32 crypto-random bytes as base64url. */
  generatePollToken?: () => string;
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
   * Register a fresh admin-initiated pair. The returned `code` is what
   * the admin displays + reads aloud; `expiresAt` drives the modal's
   * countdown.
   */
  startPair(input?: StartPairInput): StartPairResult;
  /**
   * Register a fresh client-initiated pair. The `code` is what the
   * client shows the person; the `pollToken` is what the client holds
   * and presents to `poll` — the only thing the secret ever rides.
   */
  startClientPair(input: StartClientPairInput): Promise<StartClientPairResult>;
  /**
   * Read the current pending state for a code without consuming it —
   * used by the HTTP confirm page on GET. Returns null on
   * unknown/garbage-collected codes.
   */
  peek(code: string): PendingPair | null;
  /**
   * Confirm an admin-initiated pairing — mints a fresh `DaemonAuthToken`
   * and returns the raw secret once. After a successful confirm the code
   * can never confirm again; further calls return `reason: 'consumed'`.
   * A client-initiated pair answers `consumed` here: its secret is the
   * poll's to hand out, never the confirmer's.
   */
  confirm(code: string, input?: StartPairInput): Promise<ConfirmPairResult>;
  /**
   * Bind a client-initiated pair to the person who signed in on the
   * device page. Mints nothing — the next `poll` does.
   */
  approve(code: string, userId: string): ApprovePairResult;
  /** The device page's "Not me": the pair settles as denied and can never be approved. */
  deny(code: string): ApprovePairResult;
  /**
   * The client's poll. `approved` mints the device credential ONCE — a
   * `session`-kind token bound to the approver, expiring by the session
   * TTL policy — and settles the pair; the same handle answers `unknown`
   * from then on.
   */
  poll(pollToken: string): Promise<PollPairResult>;
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

function defaultGeneratePollToken(): string {
  const bytes = new Uint8Array(POLL_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function isClientPair(entry: PendingPair): boolean {
  return entry.initiative === 'client';
}

/** A client pair still holding a code slot: not yet settled by the person or the clock. */
function isClientInFlight(entry: PendingPair): boolean {
  return isClientPair(entry) && (entry.status === 'pending' || entry.status === 'approved');
}

export function createDaemonPairingService(options: DaemonPairingServiceOptions = {}): DaemonPairingService {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const codeLength = options.codeLength ?? DEFAULT_CODE_LENGTH;
  const now = options.now ?? Date.now;
  const generateCode = options.generateCode ?? (() => defaultGenerateCode(codeLength));
  const generatePollToken = options.generatePollToken ?? defaultGeneratePollToken;
  const mintToken = options.mintToken ?? mintDaemonAuthToken;
  const maxFailedLookups = options.maxFailedLookups ?? DEFAULT_MAX_FAILED_LOOKUPS;
  const failureWindowMs = options.failureWindowMs ?? DEFAULT_FAILURE_WINDOW_MS;
  const lockoutMs = options.lockoutMs ?? DEFAULT_LOCKOUT_MS;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;

  const pending = new Map<string, PendingPair>();
  // Poll-handle index: hash → code. A settled client pair leaves it the
  // moment its verdict is answered, so a replayed handle reads as unknown.
  const codeByPollHash = new Map<string, string>();
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
  // window is now over budget. Shared by every lookup verb so a
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

  function setEntry(code: string, entry: PendingPair): void {
    pending.set(code, entry);
  }

  function dropEntry(code: string): void {
    const entry = pending.get(code);
    if (entry?.pollTokenHash !== undefined) codeByPollHash.delete(entry.pollTokenHash);
    pending.delete(code);
  }

  function sweep(): void {
    if (disposed) return;
    const t = now();
    for (const [code, entry] of pending) {
      // An approval nobody polled for expires with its code: the client
      // that started the pair is gone, and nothing was minted for it.
      if ((entry.status === 'pending' || entry.status === 'approved') && entry.expiresAt <= t) {
        setEntry(code, { ...entry, status: 'expired' });
      }
      // A settled client pair outlives its expiry by the grace so its
      // poller reads the verdict, then leaves the table.
      if (isClientPair(entry) && !isClientInFlight(entry) && entry.expiresAt + CLIENT_RETIRE_GRACE_MS <= t) {
        dropEntry(code);
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

  /**
   * The client-initiative lookup every verdict verb shares: the lockout
   * and the unknown-code budget first, then the initiative check — an
   * admin pair reached through a client verb is refused without ever
   * touching its state.
   */
  function lookupClientPair(
    code: string,
    t: number,
  ):
    | { readonly ok: true; readonly entry: PendingPair }
    | { readonly ok: false; readonly reason: 'unknown' | 'not-client' } {
    if (isLocked(t)) return { ok: false, reason: 'unknown' };
    const entry = pending.get(code);
    if (!entry) {
      recordFailedLookup(t);
      return { ok: false, reason: 'unknown' };
    }
    if (!isClientPair(entry)) return { ok: false, reason: 'not-client' };
    return { ok: true, entry };
  }

  function settledReason(entry: PendingPair): ApprovePairFailureReason | null {
    if (entry.status === 'expired') return 'expired';
    if (entry.status === 'denied') return 'denied';
    if (entry.status === 'pending') return null;
    // approved | confirmed | consumed — the person already decided.
    return 'consumed';
  }

  return {
    startPair(input) {
      if (disposed) throw new Error('DaemonPairingService is disposed');
      sweep();
      // Drop admin entries that are no longer pending so the cap
      // reflects truly in-flight pairs, not historical noise. Client
      // entries retire on their own schedule (the sweep's grace).
      for (const [code, entry] of pending) {
        if (!isClientPair(entry) && entry.status !== 'pending') dropEntry(code);
      }
      let adminPending = 0;
      for (const entry of pending.values()) {
        if (!isClientPair(entry)) adminPending++;
      }
      if (adminPending >= MAX_PENDING) {
        throw new Error('Too many pending pair codes; cancel one or wait for them to expire');
      }
      const t = now();
      const code = freshCode();
      const entry: PendingPair = {
        code,
        initiative: 'admin',
        deviceLabel: input?.deviceLabel,
        ...(input?.userId !== undefined ? { userId: input.userId } : {}),
        createdAt: t,
        expiresAt: t + ttlMs,
        status: 'pending',
      };
      setEntry(code, entry);
      return { code, expiresAt: entry.expiresAt };
    },

    async startClientPair(input) {
      if (disposed) throw new Error('DaemonPairingService is disposed');
      sweep();
      let clientInFlight = 0;
      let peerInFlight = 0;
      for (const entry of pending.values()) {
        if (!isClientInFlight(entry)) continue;
        clientInFlight++;
        if (entry.peer === input.peer) peerInFlight++;
      }
      if (clientInFlight >= MAX_CLIENT_PENDING) {
        throw new Error('Too many devices are waiting to be approved; wait for one to expire');
      }
      if (peerInFlight >= MAX_CLIENT_PENDING_PER_PEER) {
        throw new Error('Too many devices from this address are waiting to be approved; wait for one to expire');
      }
      const pollToken = generatePollToken();
      const pollTokenHash = await sha256Hex(pollToken);
      const t = now();
      const code = freshCode();
      const label = input.deviceLabel?.trim();
      const entry: PendingPair = {
        code,
        initiative: 'client',
        ...(label ? { deviceLabel: label } : {}),
        client: input.client,
        peer: input.peer,
        pollTokenHash,
        createdAt: t,
        expiresAt: t + ttlMs,
        status: 'pending',
      };
      setEntry(code, entry);
      codeByPollHash.set(pollTokenHash, code);
      return { code, pollToken, expiresAt: entry.expiresAt };
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
      // The code alone never yields a client pair's secret — only its
      // poll handle does. A confirm against one reads as spent.
      if (isClientPair(entry)) return { ok: false, reason: 'consumed' };
      if (entry.status === 'expired') return { ok: false, reason: 'expired' };
      if (entry.status !== 'pending') return { ok: false, reason: 'consumed' };
      // Reserve the slot BEFORE we touch persistence so a parallel
      // double-confirm can't race two mint calls onto the same code.
      setEntry(code, { ...entry, status: 'confirmed' });
      try {
        const label = input?.deviceLabel ?? entry.deviceLabel;
        const userId = input?.userId ?? entry.userId;
        const minted = await mintToken({ label, ...(userId !== undefined ? { userId } : {}) });
        // After the token is durably persisted, mark consumed so a
        // late retry from the same browser tab sees "consumed" rather
        // than "unknown" — it gives the admin a clearer log entry.
        setEntry(code, { ...entry, status: 'consumed' });
        return { ok: true, secret: minted.secret, tokenId: minted.record.id };
      } catch (err) {
        // Mint failed (e.g. storage write error) — release the code so
        // the user can retry. Surface the underlying error to the caller.
        setEntry(code, entry);
        throw err;
      }
    },

    approve(code, userId) {
      const t = now();
      sweep();
      const found = lookupClientPair(code, t);
      if (!found.ok) return found;
      const settled = settledReason(found.entry);
      if (settled !== null) return { ok: false, reason: settled };
      setEntry(code, { ...found.entry, status: 'approved', approvedUserId: userId });
      return { ok: true };
    },

    deny(code) {
      const t = now();
      sweep();
      const found = lookupClientPair(code, t);
      if (!found.ok) return found;
      const settled = settledReason(found.entry);
      if (settled !== null) return { ok: false, reason: settled };
      setEntry(code, { ...found.entry, status: 'denied' });
      return { ok: true };
    },

    async poll(pollToken) {
      const t = now();
      sweep();
      // Same fail-closed posture as the code lookups: a locked surface
      // hides every handle, and an unknown handle draws the budget.
      if (isLocked(t)) return { status: 'unknown' };
      const code = codeByPollHash.get(await sha256Hex(pollToken));
      const entry = code === undefined ? undefined : pending.get(code);
      if (code === undefined || !entry) {
        recordFailedLookup(t);
        return { status: 'unknown' };
      }
      if (entry.status === 'pending') return { status: 'pending', expiresAt: entry.expiresAt };
      if (entry.status === 'expired') return { status: 'expired' };
      if (entry.status === 'denied') return { status: 'denied' };
      if (entry.status !== 'approved' || entry.approvedUserId === undefined) {
        // `confirmed` = a parallel poll is minting right now; `consumed`
        // cannot be reached through the index. Neither hands out a
        // second secret.
        return { status: 'unknown' };
      }
      // Reserve BEFORE the ledger write so two concurrent polls on the
      // same handle mint exactly one token.
      setEntry(code, { ...entry, status: 'confirmed' });
      try {
        const client = entry.client ?? 'cli';
        const minted = await mintToken({
          label: entry.deviceLabel ? `device:${client}:${entry.deviceLabel}` : `device:${client}`,
          userId: entry.approvedUserId,
          kind: 'session',
          expiresAt: t + sessionTtlMs,
        });
        // The secret is answered exactly once: the handle leaves the
        // index with the mint, and the pair settles as consumed.
        codeByPollHash.delete(entry.pollTokenHash ?? '');
        setEntry(code, { ...entry, status: 'consumed' });
        return { status: 'approved', secret: minted.secret, tokenId: minted.record.id, userId: entry.approvedUserId };
      } catch (err) {
        // Mint failed — release the approval so the client's next poll
        // retries; the person need not approve twice.
        setEntry(code, entry);
        throw err;
      }
    },

    cancel(code) {
      dropEntry(code);
    },

    list() {
      sweep();
      return [...pending.values()];
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      pending.clear();
      codeByPollHash.clear();
    },
  };
}
