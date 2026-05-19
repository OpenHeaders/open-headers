/**
 * Daemon auth-token persistence + helpers (U3.2,
 * `UNIFIED_ORACLE_MODEL.md` §4.2 + `DATA_PLANE_TOPOLOGIES.md` §11.4).
 *
 * Host-neutral surface — all storage flows through {@link hostStorage}
 * so the desktop main process and the headless-daemon binary share one
 * implementation. The extension SW won't reach this module in practice
 * (no socket bind, no token-issuance path), but the code is host-free
 * by construction.
 *
 * The persisted record only carries the SHA-256 hash of the raw secret.
 * The secret is returned to the caller exactly once (at mint time) so
 * the admin can copy + paste it into the peer's BackendPane; from that
 * point forward, validation hashes the inbound HELLO's `authToken` and
 * constant-time-compares against every non-revoked stored hash.
 *
 * Revoke is a soft delete (`revokedAt`) so the on-disk ledger keeps
 * its forensic shape — list views can show "this token, revoked at X"
 * without disturbing earlier audit-log entries that reference the id.
 */

import { hostStorage, OH } from '../storage';
import type { DaemonAuthToken } from '../types';
import { uuidv7 } from '../utils/uuidv7';

const SECRET_BYTES = 32; // 256 bits of entropy; rendered as base64url
const SECRET_PREFIX = 'oh_'; // distinguishable in user-pasted strings + logs
const HASH_ALGORITHM = 'SHA-256';

export interface MintDaemonAuthTokenInput {
  /** Optional admin-supplied label (e.g. "alice's phone", "CI runner"). */
  label?: string;
  /** Test seam — defaults to `Date.now()`. */
  now?: () => number;
}

export interface MintDaemonAuthTokenResult {
  /** The persisted record (minus the raw secret). */
  readonly record: DaemonAuthToken;
  /** Raw secret — surfaced exactly once. */
  readonly secret: string;
}

export interface ValidateDaemonAuthTokenSuccess {
  readonly ok: true;
  readonly tokenId: string;
  readonly label?: string;
}

export interface ValidateDaemonAuthTokenFailure {
  readonly ok: false;
  readonly reason: 'no-token' | 'unknown' | 'revoked';
}

export type ValidateDaemonAuthTokenResult =
  | ValidateDaemonAuthTokenSuccess
  | ValidateDaemonAuthTokenFailure;

async function readTokens(): Promise<DaemonAuthToken[]> {
  return (await hostStorage.get(OH.daemonAuthTokens)) ?? [];
}

async function writeTokens(tokens: DaemonAuthToken[]): Promise<void> {
  await hostStorage.set(OH.daemonAuthTokens, tokens);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // btoa is universally available on the targets we care about
  // (browsers, SW, Electron renderer, Node 16+ as a global).
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, data);
  return bytesToHex(new Uint8Array(digest));
}

function mintRawSecret(): string {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return `${SECRET_PREFIX}${bytesToBase64Url(bytes)}`;
}

/**
 * Constant-time string compare. Avoids early-exit timing leaks on hash
 * mismatch. Both inputs must be ASCII (hex strings are).
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Mint a new daemon auth token. Persists the hash; returns the raw
 * secret exactly once.
 */
export async function mintDaemonAuthToken(
  input: MintDaemonAuthTokenInput = {},
): Promise<MintDaemonAuthTokenResult> {
  const now = (input.now ?? Date.now)();
  const secret = mintRawSecret();
  const tokenHash = await sha256Hex(secret);
  const record: DaemonAuthToken = {
    id: uuidv7(),
    tokenHash,
    label: input.label,
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
  };
  const current = await readTokens();
  await writeTokens([...current, record]);
  return { record, secret };
}

/**
 * List every persisted token (including revoked ones). Callers that
 * only want active tokens filter on `revokedAt === null`.
 */
export async function listDaemonAuthTokens(): Promise<readonly DaemonAuthToken[]> {
  return readTokens();
}

/** Mark a token revoked. No-op if the id is unknown or already revoked. */
export async function revokeDaemonAuthToken(
  tokenId: string,
  now: () => number = Date.now,
): Promise<void> {
  const current = await readTokens();
  let dirty = false;
  const next = current.map((t) => {
    if (t.id !== tokenId || t.revokedAt !== null) return t;
    dirty = true;
    return { ...t, revokedAt: now() };
  });
  if (dirty) await writeTokens(next);
}

/**
 * Validate a peer-presented secret. Hashes the inbound string, scans
 * every non-revoked token for a constant-time hash match, updates
 * `lastUsedAt` on hit. Returns a discriminated result so the caller can
 * shape its audit log entry (success carries `tokenId`; failure carries
 * the reason — useful for `auth-required` reject `detail`).
 */
export async function validateDaemonAuthToken(
  presented: string | undefined,
  now: () => number = Date.now,
): Promise<ValidateDaemonAuthTokenResult> {
  if (!presented) return { ok: false, reason: 'no-token' };
  const presentedHash = await sha256Hex(presented);
  const current = await readTokens();
  let matchIdx = -1;
  let sawRevokedMatch = false;
  for (let i = 0; i < current.length; i++) {
    const candidate = current[i];
    if (!constantTimeEqual(candidate.tokenHash, presentedHash)) continue;
    if (candidate.revokedAt !== null) {
      sawRevokedMatch = true;
      continue;
    }
    matchIdx = i;
    break;
  }
  if (matchIdx === -1) {
    return { ok: false, reason: sawRevokedMatch ? 'revoked' : 'unknown' };
  }
  const match = current[matchIdx];
  // Persist the lastUsedAt bump; tolerate write failures so a transient
  // storage hiccup doesn't reject an otherwise-valid peer.
  const next = current.slice();
  next[matchIdx] = { ...match, lastUsedAt: now() };
  await writeTokens(next).catch(() => undefined);
  return { ok: true, tokenId: match.id, label: match.label };
}
