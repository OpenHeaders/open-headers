/**
 * Password verifier for the daemon's local password login (enterprise
 * Phase 3) — `node:crypto` scrypt, no new dependency (the plan's
 * settled call). The verifier is a self-describing string so the cost
 * parameters can be raised later without invalidating stored
 * credentials:
 *
 *   scrypt$<N>$<r>$<p>$<salt-base64url>$<hash-base64url>
 *
 * Verification reads the parameters out of the stored string, so old
 * verifiers keep verifying at the cost they were minted with. Core
 * stores the string opaquely (`DaemonUserRecord.passwordVerifier`);
 * only this module interprets it.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Floor every set-password surface enforces (admin RPC, console modal,
 * offline CLI) — one number so the online and offline twins agree.
 */
export const PASSWORD_MIN_LENGTH = 8;

const SCHEME = 'scrypt';
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/** N·r·128 bytes plus headroom — node refuses the derivation when the work area exceeds `maxmem`. */
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: SCRYPT_MAXMEM }, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await deriveKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [SCHEME, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

/** Constant-time comparison against a stored verifier; malformed verifiers refuse. */
export async function verifyPassword(password: string, verifier: string): Promise<boolean> {
  const parts = verifier.split('$');
  if (parts.length !== 6 || parts[0] !== SCHEME) return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || n < 2 || r < 1 || p < 1) return false;
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  try {
    const derived = await deriveKey(password, salt, n, r, p);
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
