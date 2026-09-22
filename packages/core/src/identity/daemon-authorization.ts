/**
 * The authorization service of the daemon's person sign-in — the
 * pending-authorization table behind the OAuth 2.0 authorization server
 * the daemon runs for its own native clients (the client sign-in plan
 * §14.3). Host-neutral like the pairing service beside it: no transport
 * assumption, the HTTP handler in the node host is one caller.
 *
 * One in-memory, TTL-bounded table serves two standard grants:
 *
 *   - the **authorization code grant with PKCE** (RFC 6749 §4.1, RFC
 *     7636): `beginCode` parks a validated authorize request under an
 *     opaque id; the person approves it on the consent rendering;
 *     `approve` mints the ONE-SHOT authorization code (60 s, bound to
 *     the record) and answers the redirect target; `redeemCode` verifies
 *     `base64url(sha256(code_verifier)) === code_challenge` (RFC 7636
 *     §4.6, an ASCII comparison in constant time), the client and the
 *     redirect against the record, and mints the credential.
 *   - the **device authorization grant** (RFC 8628): `beginDevice`
 *     answers the device code the client holds (stored HASHED — never
 *     the code) and the user code the person types; `pollDevice`
 *     answers `authorization_pending` / `slow_down` per §3.5 until the
 *     record settles, then mints ONCE.
 *
 * MINT AT REDEMPTION: nothing is minted at approve — the token endpoint
 * mints when the client redeems the code with its verifier or polls
 * with its device code, and the record settles `consumed`. Nothing is
 * minted that nobody receives; a daemon restart invalidates every
 * pending authorization and orphans no ledger row. The code alone
 * yields nothing: the verifier / the device code binds the client.
 *
 * The caps (32 pending, 4 per peer) bound an anonymous flood of starts;
 * the shared failed-lookup budget (`lookup-budget.ts`) covers every
 * lookup that answers differently for a live entry than for an unknown
 * one — the user code (20 bits), an unknown device code, an unknown
 * authorization code — and fails the surface closed on a sweep. A
 * settled record stays answerable through a retire grace so its client
 * reads the verdict instead of an "unknown" that would count.
 */

import { computeCodeChallenge } from '../oauth/index';
import { bytesToBase64Url, mintDaemonAuthToken, sha256Hex } from './daemon-auth-tokens';
import {
  type DaemonAuthorizationClient,
  type DaemonAuthorizationClientKind,
  type DaemonAuthorizationGrant,
  findDaemonAuthorizationClient,
  isRegisteredRedirect,
} from './daemon-authorization-clients';
import { createFailedLookupBudget, type FailedLookupBudgetOptions } from './lookup-budget';

/** A parked authorize request lives as long as the OIDC pending login. */
const DEFAULT_CODE_GRANT_TTL_MS = 10 * 60 * 1000;
/** A device authorization lives as long as a pairing code did. */
const DEFAULT_DEVICE_GRANT_TTL_MS = 5 * 60 * 1000;
/** The one-shot authorization code (RFC 6749 §4.1.2 recommends ≤ 10 min; a client redeems at once). */
const DEFAULT_AUTHORIZATION_CODE_TTL_MS = 60 * 1000;
/** RFC 8628 §3.2 `interval` and §3.5's `slow_down` growth. */
export const DEVICE_POLL_INTERVAL_SECONDS = 5;
const DEVICE_SLOW_DOWN_INCREMENT_SECONDS = 5;
const MAX_PENDING = 32;
const MAX_PENDING_PER_PEER = 4;
/** A settled record stays answerable this long past its expiry. */
const RETIRE_GRACE_MS = DEFAULT_DEVICE_GRANT_TTL_MS;
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const ID_BYTES = 16;
const DEVICE_CODE_BYTES = 32;
const AUTHORIZATION_CODE_BYTES = 32;
/** RFC 8628 §6.1's example alphabet — 20 consonants, no vowels, no look-alikes. */
export const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
export const USER_CODE_LENGTH = 8;
/** S256 challenges are base64url of 32 bytes — 43 characters, no padding. */
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * `minting` is the mint-in-flight reservation between reserving the
 * slot and the ledger write landing; `approved` awaits redemption.
 */
export type PendingAuthorizationStatus = 'pending' | 'approved' | 'denied' | 'minting' | 'consumed' | 'expired';

export interface PendingAuthorization {
  readonly id: string;
  readonly clientId: string;
  readonly grant: DaemonAuthorizationGrant;
  /** Code grant: the validated redirect the approval sends the browser to. */
  readonly redirectUri?: string;
  /** Code grant: the client's `state`, echoed on the redirect. */
  readonly state?: string;
  /** Code grant: the S256 challenge the redemption's verifier must hash to. */
  readonly codeChallenge?: string;
  /** Code grant, after approval: SHA-256 of the one-shot authorization code — never the code. */
  readonly authorizationCodeHash?: string;
  readonly authorizationCodeExpiresAt?: number;
  /** Device grant: SHA-256 of the device code — never the code. */
  readonly deviceCodeHash?: string;
  /** Device grant: the user code as displayed (with its hyphen). */
  readonly userCode?: string;
  /** Device grant: the poll cadence, grown by every `slow_down`. */
  readonly intervalSeconds?: number;
  readonly lastPolledAt?: number;
  readonly deviceLabel?: string;
  /** The admission-resolved address the start came from — what the consent rendering compares. */
  readonly peer: string;
  readonly approvedUserId?: string;
  readonly status: PendingAuthorizationStatus;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface BeginCodeInput {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  peer: string;
  deviceLabel?: string;
}

/** Why an authorize request is refused ON THE PAGE — never redirected to an unverified `redirect_uri`. */
export type BeginCodeRefusalReason =
  | 'unknown-client'
  | 'unsupported-grant'
  | 'invalid-redirect'
  | 'invalid-state'
  | 'invalid-challenge'
  | 'too-many-pending';

export type BeginCodeResult =
  | { readonly ok: true; readonly id: string; readonly expiresAt: number }
  | { readonly ok: false; readonly reason: BeginCodeRefusalReason };

export interface BeginDeviceInput {
  clientId: string;
  peer: string;
  deviceLabel?: string;
}

export type BeginDeviceRefusalReason = 'unknown-client' | 'unsupported-grant' | 'too-many-pending';

export type BeginDeviceResult =
  | {
      readonly ok: true;
      readonly id: string;
      /** Surfaced exactly once; only its hash is stored. */
      readonly deviceCode: string;
      readonly userCode: string;
      readonly expiresAt: number;
      readonly intervalSeconds: number;
    }
  | { readonly ok: false; readonly reason: BeginDeviceRefusalReason };

/** What a consent rendering may know — never the challenge, the codes or a token. */
export interface AuthorizationFacts {
  readonly id: string;
  readonly clientId: string;
  readonly clientKind: DaemonAuthorizationClientKind;
  readonly clientName: string;
  readonly grant: DaemonAuthorizationGrant;
  readonly deviceLabel?: string;
  readonly userCode?: string;
  readonly peer: string;
  readonly status: 'pending' | 'approved' | 'denied' | 'consumed' | 'expired';
  readonly expiresAt: number;
}

export type LookupByUserCodeResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly reason: 'unknown' };

export type DecisionRefusalReason = 'unknown' | 'expired' | 'denied' | 'consumed';

export type ApproveAuthorizationResult =
  | {
      readonly ok: true;
      readonly grant: 'code';
      readonly redirectUri: string;
      /** The one-shot authorization code — surfaced exactly once, to the redirect. */
      readonly code: string;
      readonly state: string;
    }
  | { readonly ok: true; readonly grant: 'device' }
  | { readonly ok: false; readonly reason: DecisionRefusalReason };

export type DenyAuthorizationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: DecisionRefusalReason };

export interface RedeemCodeInput {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}

export interface MintedAuthorization {
  readonly secret: string;
  readonly tokenId: string;
  readonly userId: string;
  readonly expiresAt: number;
}

/**
 * Every refusal is `invalid_grant` on the wire (RFC 6749 §5.2, RFC 7636
 * §4.6); the reason tells the caller whether the code was UNKNOWN (a
 * guess the limiter counts) or a live code presented wrongly.
 */
export type RedeemCodeRefusalReason = 'unknown' | 'mismatch' | 'expired' | 'consumed';

export type RedeemCodeResult =
  | ({ readonly ok: true } & MintedAuthorization)
  | { readonly ok: false; readonly reason: RedeemCodeRefusalReason };

export interface PollDeviceInput {
  deviceCode: string;
  clientId: string;
}

/** RFC 8628 §3.5's vocabulary; `unknown` is the guess the limiter counts. */
export type PollDeviceResult =
  | { readonly status: 'pending'; readonly intervalSeconds: number }
  | { readonly status: 'slow_down'; readonly intervalSeconds: number }
  | ({ readonly status: 'approved' } & MintedAuthorization)
  | { readonly status: 'denied' }
  | { readonly status: 'expired' }
  | { readonly status: 'unknown' };

export interface DaemonAuthorizationServiceOptions extends FailedLookupBudgetOptions {
  /** TTL of a parked authorize request. Defaults to 10 minutes. */
  codeGrantTtlMs?: number;
  /** TTL of a device authorization. Defaults to 5 minutes. */
  deviceGrantTtlMs?: number;
  /** TTL of the one-shot authorization code minted at approve. Defaults to 60 seconds. */
  authorizationCodeTtlMs?: number;
  /** Lifetime of the minted credential — the host's one session TTL policy. Defaults to 30 days. */
  sessionTtlMs?: number;
  /** Test seam — defaults to `Date.now()`. */
  now?: () => number;
  /** Test seam — defaults to 16 crypto-random bytes as base64url. */
  generateId?: () => string;
  /** Test seam — defaults to 32 crypto-random bytes as base64url. */
  generateDeviceCode?: () => string;
  /** Test seam — defaults to {@link defaultGenerateUserCode}. */
  generateUserCode?: () => string;
  /** Test seam — defaults to 32 crypto-random bytes as base64url. */
  generateAuthorizationCode?: () => string;
  /** Test seam — defaults to {@link mintDaemonAuthToken}; the credential rides the same ledger as every mint. */
  mintToken?: typeof mintDaemonAuthToken;
}

export interface DaemonAuthorizationService {
  /** Park a validated authorize request; a refusal names the reason for the page. */
  beginCode(input: BeginCodeInput): BeginCodeResult;
  /** Start a device authorization (RFC 8628 §3.2's answer). */
  beginDevice(input: BeginDeviceInput): Promise<BeginDeviceResult>;
  /** The public facts of a record, for the consent rendering; null when unknown. */
  facts(id: string): AuthorizationFacts | null;
  /** The verify page's lookup — case-folded, the hyphen optional; an unknown code draws the budget. */
  lookupByUserCode(userCode: string): LookupByUserCodeResult;
  /** Bind the record to the person who approved it; the code grant mints its one-shot code here. */
  approve(id: string, userId: string): Promise<ApproveAuthorizationResult>;
  /** "Not me": the record settles denied and can never be approved. */
  deny(id: string): DenyAuthorizationResult;
  /** The token endpoint's `authorization_code` grant: verify, mint ONCE, settle. */
  redeemCode(input: RedeemCodeInput): Promise<RedeemCodeResult>;
  /** The token endpoint's device grant: the §3.5 answers; `approved` mints ONCE and settles. */
  pollDevice(input: PollDeviceInput): Promise<PollDeviceResult>;
  /** Drop a record without minting. */
  cancel(id: string): void;
  /** Snapshot of the table — for tests and status surfaces. */
  list(): readonly PendingAuthorization[];
  /** Release every entry. Idempotent. */
  dispose(): void;
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

/**
 * Exported for tests. Eight letters of the §6.1 alphabet with a hyphen
 * after four (`BCDF-GHJK`). Rejection-samples so every letter is
 * uniform: 240 is the largest multiple of 20 below 256.
 */
export function defaultGenerateUserCode(): string {
  const bytes = new Uint8Array(USER_CODE_LENGTH);
  let out = '';
  while (out.length < USER_CODE_LENGTH) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && out.length < USER_CODE_LENGTH; i++) {
      if (bytes[i] < 240) out += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
    }
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** The lookup key of a user code: upper-cased, the hyphen and whitespace dropped. */
export function normalizeUserCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/** Constant-time equality over two ASCII strings of equal length. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

function isInFlight(entry: PendingAuthorization): boolean {
  return entry.status === 'pending' || entry.status === 'approved' || entry.status === 'minting';
}

function factsStatus(status: PendingAuthorizationStatus): AuthorizationFacts['status'] {
  return status === 'minting' ? 'approved' : status;
}

function decisionRefusal(entry: PendingAuthorization): DecisionRefusalReason | null {
  switch (entry.status) {
    case 'pending':
      return null;
    case 'expired':
      return 'expired';
    case 'denied':
      return 'denied';
    default:
      return 'consumed';
  }
}

export function createDaemonAuthorizationService(
  options: DaemonAuthorizationServiceOptions = {},
): DaemonAuthorizationService {
  const codeGrantTtlMs = options.codeGrantTtlMs ?? DEFAULT_CODE_GRANT_TTL_MS;
  const deviceGrantTtlMs = options.deviceGrantTtlMs ?? DEFAULT_DEVICE_GRANT_TTL_MS;
  const authorizationCodeTtlMs = options.authorizationCodeTtlMs ?? DEFAULT_AUTHORIZATION_CODE_TTL_MS;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = options.now ?? Date.now;
  const generateId = options.generateId ?? (() => randomBase64Url(ID_BYTES));
  const generateDeviceCode = options.generateDeviceCode ?? (() => randomBase64Url(DEVICE_CODE_BYTES));
  const generateUserCode = options.generateUserCode ?? defaultGenerateUserCode;
  const generateAuthorizationCode =
    options.generateAuthorizationCode ?? (() => randomBase64Url(AUTHORIZATION_CODE_BYTES));
  const mintToken = options.mintToken ?? mintDaemonAuthToken;
  const budget = createFailedLookupBudget(options);

  const pending = new Map<string, PendingAuthorization>();
  const idByUserCode = new Map<string, string>();
  const idByDeviceCodeHash = new Map<string, string>();
  const idByAuthorizationCodeHash = new Map<string, string>();
  let disposed = false;

  function setEntry(entry: PendingAuthorization): void {
    pending.set(entry.id, entry);
  }

  function dropEntry(id: string): void {
    const entry = pending.get(id);
    if (!entry) return;
    if (entry.userCode !== undefined) idByUserCode.delete(normalizeUserCode(entry.userCode));
    if (entry.deviceCodeHash !== undefined) idByDeviceCodeHash.delete(entry.deviceCodeHash);
    if (entry.authorizationCodeHash !== undefined) idByAuthorizationCodeHash.delete(entry.authorizationCodeHash);
    pending.delete(id);
  }

  function sweep(t: number): void {
    if (disposed) return;
    for (const entry of pending.values()) {
      // An approval nobody redeemed expires with its record: the client
      // that asked is gone, and nothing was minted for it.
      if ((entry.status === 'pending' || entry.status === 'approved') && entry.expiresAt <= t) {
        setEntry({ ...entry, status: 'expired' });
      }
      if (!isInFlight(entry) && entry.expiresAt + RETIRE_GRACE_MS <= t) dropEntry(entry.id);
    }
  }

  function admit(client: DaemonAuthorizationClient | null, grant: DaemonAuthorizationGrant, peer: string) {
    if (client === null) return 'unknown-client' as const;
    if (!client.grants.includes(grant)) return 'unsupported-grant' as const;
    let inFlight = 0;
    let peerInFlight = 0;
    for (const entry of pending.values()) {
      if (!isInFlight(entry)) continue;
      inFlight++;
      if (entry.peer === peer) peerInFlight++;
    }
    if (inFlight >= MAX_PENDING || peerInFlight >= MAX_PENDING_PER_PEER) return 'too-many-pending' as const;
    return null;
  }

  function freshId(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = generateId();
      if (!pending.has(candidate)) return candidate;
    }
    throw new Error('createDaemonAuthorizationService: failed to find a non-colliding id after 100 attempts');
  }

  function freshUserCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = generateUserCode();
      if (!idByUserCode.has(normalizeUserCode(candidate))) return candidate;
    }
    throw new Error('createDaemonAuthorizationService: failed to find a non-colliding user code after 100 attempts');
  }

  function labelFor(entry: PendingAuthorization, client: DaemonAuthorizationClient): string {
    return entry.deviceLabel ? `device:${client.kind}:${entry.deviceLabel}` : `device:${client.kind}`;
  }

  /**
   * The one mint both grants share: reserve the slot BEFORE the ledger
   * write so two concurrent redemptions mint exactly one token; settle
   * consumed after it lands; release the approval on a failed write so
   * the client's retry needs no second approval.
   */
  async function mintFor(entry: PendingAuthorization, t: number): Promise<MintedAuthorization> {
    const client = findDaemonAuthorizationClient(entry.clientId);
    if (client === null || entry.approvedUserId === undefined) {
      throw new Error('createDaemonAuthorizationService: mint reached an unapproved record');
    }
    setEntry({ ...entry, status: 'minting' });
    try {
      const expiresAt = t + sessionTtlMs;
      const minted = await mintToken({
        label: labelFor(entry, client),
        userId: entry.approvedUserId,
        kind: 'session',
        expiresAt,
      });
      setEntry({ ...entry, status: 'consumed' });
      return { secret: minted.secret, tokenId: minted.record.id, userId: entry.approvedUserId, expiresAt };
    } catch (err) {
      setEntry(entry);
      throw err;
    }
  }

  return {
    beginCode(input) {
      if (disposed) throw new Error('DaemonAuthorizationService is disposed');
      const t = now();
      sweep(t);
      const client = findDaemonAuthorizationClient(input.clientId);
      const refused = admit(client, 'code', input.peer);
      if (refused === 'unknown-client' || refused === 'unsupported-grant') return { ok: false, reason: refused };
      if (!isRegisteredRedirect(input.clientId, input.redirectUri)) return { ok: false, reason: 'invalid-redirect' };
      if (!input.state) return { ok: false, reason: 'invalid-state' };
      if (input.codeChallengeMethod !== 'S256' || !CODE_CHALLENGE_PATTERN.test(input.codeChallenge)) {
        return { ok: false, reason: 'invalid-challenge' };
      }
      if (refused !== null) return { ok: false, reason: refused };
      const label = input.deviceLabel?.trim();
      const entry: PendingAuthorization = {
        id: freshId(),
        clientId: input.clientId,
        grant: 'code',
        redirectUri: input.redirectUri,
        state: input.state,
        codeChallenge: input.codeChallenge,
        ...(label ? { deviceLabel: label } : {}),
        peer: input.peer,
        status: 'pending',
        createdAt: t,
        expiresAt: t + codeGrantTtlMs,
      };
      setEntry(entry);
      return { ok: true, id: entry.id, expiresAt: entry.expiresAt };
    },

    async beginDevice(input) {
      if (disposed) throw new Error('DaemonAuthorizationService is disposed');
      const t = now();
      sweep(t);
      const refused = admit(findDaemonAuthorizationClient(input.clientId), 'device', input.peer);
      if (refused !== null) return { ok: false, reason: refused };
      const deviceCode = generateDeviceCode();
      const deviceCodeHash = await sha256Hex(deviceCode);
      const userCode = freshUserCode();
      const label = input.deviceLabel?.trim();
      const entry: PendingAuthorization = {
        id: freshId(),
        clientId: input.clientId,
        grant: 'device',
        deviceCodeHash,
        userCode,
        intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
        ...(label ? { deviceLabel: label } : {}),
        peer: input.peer,
        status: 'pending',
        createdAt: t,
        expiresAt: t + deviceGrantTtlMs,
      };
      setEntry(entry);
      idByUserCode.set(normalizeUserCode(userCode), entry.id);
      idByDeviceCodeHash.set(deviceCodeHash, entry.id);
      return {
        ok: true,
        id: entry.id,
        deviceCode,
        userCode,
        expiresAt: entry.expiresAt,
        intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
      };
    },

    facts(id) {
      sweep(now());
      const entry = pending.get(id);
      const client = entry === undefined ? null : findDaemonAuthorizationClient(entry.clientId);
      if (entry === undefined || client === null) return null;
      return {
        id: entry.id,
        clientId: entry.clientId,
        clientKind: client.kind,
        clientName: client.name,
        grant: entry.grant,
        ...(entry.deviceLabel !== undefined ? { deviceLabel: entry.deviceLabel } : {}),
        ...(entry.userCode !== undefined ? { userCode: entry.userCode } : {}),
        peer: entry.peer,
        status: factsStatus(entry.status),
        expiresAt: entry.expiresAt,
      };
    },

    lookupByUserCode(userCode) {
      const t = now();
      sweep(t);
      // Fail closed during a lockout: every code reads unknown, so a
      // sweep cannot resume probing and a real code is indistinguishable.
      if (budget.isLocked(t)) return { ok: false, reason: 'unknown' };
      const id = idByUserCode.get(normalizeUserCode(userCode));
      if (id === undefined) {
        budget.recordFailure(t);
        return { ok: false, reason: 'unknown' };
      }
      return { ok: true, id };
    },

    async approve(id, userId) {
      const t = now();
      sweep(t);
      const entry = pending.get(id);
      if (!entry) return { ok: false, reason: 'unknown' };
      const refused = decisionRefusal(entry);
      if (refused !== null) return { ok: false, reason: refused };
      if (entry.grant === 'device') {
        setEntry({ ...entry, status: 'approved', approvedUserId: userId });
        return { ok: true, grant: 'device' };
      }
      // The code grant: the one-shot code is minted here and handed to
      // the redirect once; only its hash stays with the record.
      const code = generateAuthorizationCode();
      const authorizationCodeHash = await sha256Hex(code);
      const current = pending.get(id);
      if (current?.status !== 'pending') return { ok: false, reason: 'consumed' };
      setEntry({
        ...current,
        status: 'approved',
        approvedUserId: userId,
        authorizationCodeHash,
        authorizationCodeExpiresAt: t + authorizationCodeTtlMs,
      });
      idByAuthorizationCodeHash.set(authorizationCodeHash, entry.id);
      return { ok: true, grant: 'code', redirectUri: entry.redirectUri ?? '', code, state: entry.state ?? '' };
    },

    deny(id) {
      const t = now();
      sweep(t);
      const entry = pending.get(id);
      if (!entry) return { ok: false, reason: 'unknown' };
      const refused = decisionRefusal(entry);
      if (refused !== null) return { ok: false, reason: refused };
      setEntry({ ...entry, status: 'denied' });
      return { ok: true };
    },

    async redeemCode(input) {
      const t = now();
      sweep(t);
      if (budget.isLocked(t)) return { ok: false, reason: 'unknown' };
      const id = idByAuthorizationCodeHash.get(await sha256Hex(input.code));
      const entry = id === undefined ? undefined : pending.get(id);
      if (entry?.grant !== 'code') {
        budget.recordFailure(t);
        return { ok: false, reason: 'unknown' };
      }
      if (entry.status === 'expired') return { ok: false, reason: 'expired' };
      if (entry.status !== 'approved') return { ok: false, reason: 'consumed' };
      if (entry.authorizationCodeExpiresAt !== undefined && entry.authorizationCodeExpiresAt <= t) {
        return { ok: false, reason: 'expired' };
      }
      // RFC 6749 §4.1.3: the code was issued to this client for this
      // redirect; RFC 7636 §4.6: the verifier hashes to the challenge.
      // One refusal for all three — the wire says `invalid_grant`.
      const challenge = await computeCodeChallenge(input.codeVerifier, sha256Bytes);
      if (
        entry.clientId !== input.clientId ||
        entry.redirectUri !== input.redirectUri ||
        !constantTimeEqual(challenge, entry.codeChallenge ?? '')
      ) {
        return { ok: false, reason: 'mismatch' };
      }
      // Re-read: the verifier hash awaited, a concurrent redemption may
      // have reserved the slot meanwhile — exactly one mints.
      const current = pending.get(entry.id);
      if (current?.status !== 'approved') return { ok: false, reason: 'consumed' };
      const minted = await mintFor(current, t);
      idByAuthorizationCodeHash.delete(current.authorizationCodeHash ?? '');
      return { ok: true, ...minted };
    },

    async pollDevice(input) {
      const t = now();
      sweep(t);
      if (budget.isLocked(t)) return { status: 'unknown' };
      const id = idByDeviceCodeHash.get(await sha256Hex(input.deviceCode));
      const entry = id === undefined ? undefined : pending.get(id);
      if (entry?.grant !== 'device' || entry.clientId !== input.clientId) {
        budget.recordFailure(t);
        return { status: 'unknown' };
      }
      // RFC 8628 §3.5: a poll faster than the interval answers
      // `slow_down`, and the interval grows by five seconds for this and
      // every later poll.
      const intervalSeconds = entry.intervalSeconds ?? DEVICE_POLL_INTERVAL_SECONDS;
      if (entry.lastPolledAt !== undefined && t - entry.lastPolledAt < intervalSeconds * 1000) {
        const grown = intervalSeconds + DEVICE_SLOW_DOWN_INCREMENT_SECONDS;
        setEntry({ ...entry, intervalSeconds: grown, lastPolledAt: t });
        return { status: 'slow_down', intervalSeconds: grown };
      }
      const polled: PendingAuthorization = { ...entry, lastPolledAt: t };
      setEntry(polled);
      switch (polled.status) {
        case 'pending':
        case 'minting':
          // `minting` = a parallel poll is minting right now; this one
          // simply waits its interval.
          return { status: 'pending', intervalSeconds };
        case 'expired':
          return { status: 'expired' };
        case 'denied':
          return { status: 'denied' };
        case 'consumed':
          return { status: 'unknown' };
        case 'approved': {
          const minted = await mintFor(polled, t);
          // The secret is answered exactly once: the device code leaves
          // the index with the mint.
          idByDeviceCodeHash.delete(polled.deviceCodeHash ?? '');
          return { status: 'approved', ...minted };
        }
      }
    },

    cancel(id) {
      dropEntry(id);
    },

    list() {
      sweep(now());
      return [...pending.values()];
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      pending.clear();
      idByUserCode.clear();
      idByDeviceCodeHash.clear();
      idByAuthorizationCodeHash.clear();
    },
  };
}
