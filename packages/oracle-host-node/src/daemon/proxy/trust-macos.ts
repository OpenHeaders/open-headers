/**
 * macOS keychain trust-store operations (PROXY_SECURITY.md §4 row 1) —
 * install, remove, and probe the proxy CA against the login and System
 * keychains via the `security` CLI.
 *
 * Elevation posture (§2.6): the login keychain is the user's own —
 * plain exec. The System keychain is admin territory — every operation
 * on it runs through the caller-supplied elevated exec, which fronts
 * the OS authorization dialog; a denial is reported and never retried.
 *
 * Removal undoes both halves of what install did: the trust settings
 * (`remove-trusted-cert`) and the certificate itself
 * (`delete-certificate`). An already-absent cert reads as removed —
 * teardown is idempotent by law (§2.5).
 */

import * as path from 'node:path';
import type { ProxyTrustStoreState } from '@openheaders/core/types';
import type { ExecFn } from './exec';
import { withTempPem } from './temp-pem';

export const SYSTEM_KEYCHAIN_PATH = '/Library/Keychains/System.keychain';

export function loginKeychainPath(homedir: string): string {
  return path.join(homedir, 'Library', 'Keychains', 'login.keychain-db');
}

export interface KeychainOpDeps {
  exec: ExecFn;
  /** Runs one command behind the OS admin prompt — System keychain only. */
  execElevated: ExecFn;
  tmpdir?: string;
}

export interface TrustStoreOpResult {
  ok: boolean;
  error?: string;
  /** The operation needs admin rights the runner could not obtain. */
  elevationRequired?: boolean;
}

function isSystemKeychain(keychain: string): boolean {
  return keychain === SYSTEM_KEYCHAIN_PATH;
}

/** Heuristic over `security` stderr for a rights refusal (denied dialog, no TTY auth). */
function looksLikeElevationFailure(stderr: string): boolean {
  const text = stderr.toLowerCase();
  return (
    text.includes('authorization') ||
    text.includes('not permitted') ||
    text.includes('permission denied') ||
    text.includes('user canceled') ||
    text.includes('unable to obtain')
  );
}

/**
 * `security add-trusted-cert` — adds the cert to the keychain AND
 * writes a trustRoot trust-settings entry for it. `-d` (admin trust
 * domain) rides only with the System keychain, elevated.
 */
export async function installCaInKeychain(
  certPem: string,
  keychain: string,
  deps: KeychainOpDeps,
): Promise<TrustStoreOpResult> {
  const system = isSystemKeychain(keychain);
  const runner = system ? deps.execElevated : deps.exec;
  return withTempPem(
    certPem,
    async (pemPath) => {
      const args = ['add-trusted-cert', ...(system ? ['-d'] : []), '-r', 'trustRoot', '-k', keychain, pemPath];
      const result = await runner('security', args);
      if (result.code === 0) return { ok: true };
      if (result.notFound) return { ok: false, error: 'security CLI not found' };
      const stderr = result.stderr.trim();
      return {
        ok: false,
        error: stderr || `security exited ${result.code}`,
        ...(looksLikeElevationFailure(stderr) ? { elevationRequired: true } : {}),
      };
    },
    deps.tmpdir,
  );
}

/**
 * Undo an install: drop the trust-settings entry, then delete the
 * certificate by SHA-1. Either half reporting "not found" counts as
 * already done — the end state, not the command exit, is the verdict.
 */
export async function removeCaFromKeychain(
  certPem: string,
  fingerprintSha1: string,
  keychain: string,
  deps: KeychainOpDeps,
): Promise<TrustStoreOpResult> {
  const system = isSystemKeychain(keychain);
  const runner = system ? deps.execElevated : deps.exec;
  const untrust = await withTempPem(
    certPem,
    (pemPath) => runner('security', ['remove-trusted-cert', ...(system ? ['-d'] : []), pemPath]),
    deps.tmpdir,
  );
  if (untrust.notFound) return { ok: false, error: 'security CLI not found' };
  const untrustStderr = untrust.stderr.trim();
  if (untrust.code !== 0 && looksLikeElevationFailure(untrustStderr)) {
    return { ok: false, error: untrustStderr, elevationRequired: true };
  }
  const del = await runner('security', ['delete-certificate', '-Z', fingerprintSha1.toUpperCase(), keychain]);
  if (del.code === 0) return { ok: true };
  const stderr = del.stderr.trim();
  // "Unable to delete certificate matching …" is security's no-such-cert
  // answer — the cert is gone, which is the state teardown wants.
  if (stderr.toLowerCase().includes('unable to delete certificate matching')) return { ok: true };
  return {
    ok: false,
    error: stderr || `security exited ${del.code}`,
    ...(looksLikeElevationFailure(stderr) ? { elevationRequired: true } : {}),
  };
}

/** Hex SHA-256 fingerprints of every cert in `keychain` whose CN matches. */
async function findFingerprints(commonName: string, keychain: string, exec: ExecFn): Promise<string[] | null> {
  const result = await exec('security', ['find-certificate', '-a', '-c', commonName, '-Z', keychain]);
  if (result.notFound) return null;
  // Non-zero with no output = keychain unreadable; "could not be found"
  // on stderr = plain absence.
  if (result.code !== 0 && !result.stderr.toLowerCase().includes('could not be found') && result.stdout === '') {
    return null;
  }
  const matches = result.stdout.matchAll(/SHA-256 hash:\s*([0-9A-Fa-f]+)/g);
  return [...matches].map((m) => m[1].toLowerCase());
}

/** CN entries in the keychain's trust-settings domain (`user` for login, `admin` for System). */
async function trustSettingsContain(commonName: string, system: boolean, exec: ExecFn): Promise<boolean | null> {
  const result = await exec('security', ['dump-trust-settings', ...(system ? ['-d'] : [])]);
  if (result.notFound) return null;
  // "No Trust Settings were found" exits non-zero — an honest empty set.
  if (result.code !== 0 && !result.stderr.toLowerCase().includes('no trust settings')) {
    if (result.stdout === '') return null;
  }
  return result.stdout.includes(commonName);
}

/**
 * Live probe — re-derived on every call, never a remembered flag.
 * `trusted` needs BOTH halves: the cert present with our fingerprint
 * and a trust-settings entry naming it. A matching CN with a foreign
 * fingerprint is `mismatch` (tamper visibility, §5); a fingerprint
 * match without trust settings reads `untrusted` — the cert is
 * physically in the keychain (so it is NOT absent and teardown must
 * still cover it), but the OS would not trust a leaf, so claiming
 * `trusted` would be half-trust.
 */
export async function probeKeychain(
  commonName: string,
  expectedFingerprintSha256: string | null,
  store: 'macos-login-keychain' | 'macos-system-keychain',
  keychain: string,
  exec: ExecFn,
): Promise<ProxyTrustStoreState> {
  const found = await findFingerprints(commonName, keychain, exec);
  if (found === null) return { store, ref: keychain, state: 'unavailable', detail: 'keychain not readable' };
  if (found.length === 0) return { store, ref: keychain, state: 'absent' };
  if (expectedFingerprintSha256 === null) {
    return { store, ref: keychain, state: 'mismatch', detail: 'certificate present but no CA on record' };
  }
  if (!found.includes(expectedFingerprintSha256.toLowerCase())) {
    return { store, ref: keychain, state: 'mismatch', detail: 'certificate fingerprint differs from the stored CA' };
  }
  const trusted = await trustSettingsContain(commonName, store === 'macos-system-keychain', exec);
  if (trusted === null) return { store, ref: keychain, state: 'unavailable', detail: 'trust settings not readable' };
  if (!trusted) {
    return { store, ref: keychain, state: 'untrusted', detail: 'certificate present but not trusted (no trust settings)' };
  }
  return { store, ref: keychain, state: 'trusted' };
}
