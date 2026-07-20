/**
 * macOS keychain trust-store operations (PROXY_SECURITY.md §4 row 1) —
 * install, remove, and probe the proxy CA against the login and System
 * keychains.
 *
 * Elevation posture (§2.6 amendment): the login keychain is the user's
 * own — plain `security` exec. The System keychain is admin territory —
 * its operations ride the signed SMAppService privileged helper (the
 * only session-preserving path; osascript elevation was proven unable
 * to manage admin-domain trust and app-drawn password prompts are
 * forbidden). The helper is a dumb executor returning raw exit codes;
 * every semantic decision stays here.
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
import type { SystemTrustHelper } from './trust-helper';

export const SYSTEM_KEYCHAIN_PATH = '/Library/Keychains/System.keychain';

export function loginKeychainPath(homedir: string): string {
  return path.join(homedir, 'Library', 'Keychains', 'login.keychain-db');
}

export interface KeychainOpDeps {
  exec: ExecFn;
  tmpdir?: string;
}

export interface TrustStoreOpResult {
  ok: boolean;
  error?: string;
  /** The operation needs admin rights the runner could not obtain. */
  elevationRequired?: boolean;
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
 * `security add-trusted-cert` — adds the cert to the login keychain AND
 * writes a trustRoot trust-settings entry for it. System-keychain
 * installs never come here — they ride {@link installCaViaHelper}.
 */
export async function installCaInKeychain(
  certPem: string,
  keychain: string,
  deps: KeychainOpDeps,
): Promise<TrustStoreOpResult> {
  return withTempPem(
    certPem,
    async (pemPath) => {
      const args = ['add-trusted-cert', '-r', 'trustRoot', '-k', keychain, pemPath];
      const result = await deps.exec('security', args);
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
  const untrust = await withTempPem(
    certPem,
    (pemPath) => deps.exec('security', ['remove-trusted-cert', pemPath]),
    deps.tmpdir,
  );
  if (untrust.notFound) return { ok: false, error: 'security CLI not found' };
  const untrustStderr = untrust.stderr.trim();
  if (untrust.code !== 0 && looksLikeElevationFailure(untrustStderr)) {
    return { ok: false, error: untrustStderr, elevationRequired: true };
  }
  const del = await deps.exec('security', ['delete-certificate', '-Z', fingerprintSha1.toUpperCase(), keychain]);
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

/** authd refusals from the in-session trust verbs: denied, canceled, user-canceled. */
const TRUST_DENIAL_STATUSES = new Set([-60005, -60006, -128]);

/** `errSecItemNotFound` — no trust settings to remove is an honest empty set. */
const TRUST_STATUS_NOT_FOUND = -25300;

/**
 * System-keychain install, split across the helper's two halves: the
 * root daemon imports the cert bytes (`import`), then the in-session
 * client writes the admin-domain trust settings (`trust-set`) behind
 * macOS's own admin authentication. A transport failure before the
 * store changed reads as an elevation problem; an authd denial after
 * the import leaves `untrusted` residue the caller's probe will keep a
 * row for.
 */
export async function installCaViaHelper(certPem: string, helper: SystemTrustHelper): Promise<TrustStoreOpResult> {
  const imported = await helper.importCert(certPem);
  if (!imported.ok) return { ok: false, error: imported.error ?? 'trust helper unavailable', elevationRequired: true };
  const importStderr = (imported.stderr ?? '').trim();
  if (imported.code !== 0 && !importStderr.toLowerCase().includes('already exists')) {
    return { ok: false, error: importStderr || `security exited ${imported.code ?? -1}` };
  }
  const trusted = await helper.trustSet(certPem);
  if (!trusted.ok) return { ok: false, error: trusted.error ?? 'trust helper unavailable' };
  if (trusted.status === 0) return { ok: true };
  return {
    ok: false,
    error: trusted.message ?? `trust settings write failed (${trusted.status ?? '?'})`,
    ...(trusted.status !== undefined && TRUST_DENIAL_STATUSES.has(trusted.status) ? { elevationRequired: true } : {}),
  };
}

/**
 * System-keychain removal — same two-halves semantics as
 * {@link removeCaFromKeychain}: the trust settings come off in-session
 * (`trust-remove`, absent settings count as done), then the root
 * daemon deletes the cert bytes (`delete`, "no such cert" counts as
 * done).
 */
export async function removeCaViaHelper(
  certPem: string,
  fingerprintSha1: string,
  helper: SystemTrustHelper,
): Promise<TrustStoreOpResult> {
  const untrusted = await helper.trustRemove(certPem);
  if (!untrusted.ok)
    return { ok: false, error: untrusted.error ?? 'trust helper unavailable', elevationRequired: true };
  if (untrusted.status !== 0 && untrusted.status !== TRUST_STATUS_NOT_FOUND) {
    return {
      ok: false,
      error: untrusted.message ?? `trust settings removal failed (${untrusted.status ?? '?'})`,
      ...(untrusted.status !== undefined && TRUST_DENIAL_STATUSES.has(untrusted.status)
        ? { elevationRequired: true }
        : {}),
    };
  }
  const deleted = await helper.deleteCert(certPem, fingerprintSha1.toUpperCase());
  if (!deleted.ok) return { ok: false, error: deleted.error ?? 'trust helper unavailable', elevationRequired: true };
  if (deleted.code === 0) return { ok: true };
  const stderr = (deleted.stderr ?? '').trim();
  if (stderr.toLowerCase().includes('unable to delete certificate matching')) return { ok: true };
  return { ok: false, error: stderr || `security exited ${deleted.code ?? -1}` };
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
    return {
      store,
      ref: keychain,
      state: 'untrusted',
      detail: 'certificate present but not trusted (no trust settings)',
    };
  }
  return { store, ref: keychain, state: 'trusted' };
}
