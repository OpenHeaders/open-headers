/**
 * NSS trust-store operations (the proxy-security design §4 NSS column) —
 * Firefox keeps its own certificate store, so trusting the system
 * keychain is not enough there. Install/remove/probe run `certutil`
 * (NSS tools) against each discovered profile's `cert9.db`.
 *
 * `certutil` is not part of macOS — when it is missing the probe
 * answers `unavailable` with a detail and install refuses honestly
 * (§5: report the exact partial state, never silently proceed).
 * Per-user stores, no elevation ever (§2.6).
 */

import { readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import type { ProxyTrustStoreState } from '@openheaders/core/types';
import { certFingerprints } from './ca-store';
import type { ExecFn } from './exec';
import { withTempPem } from './temp-pem';
import type { TrustStoreOpResult } from './trust-macos';

/** NSS nickname the CA is filed under — also the removal/probe key. */
export const NSS_CERT_NICKNAME = 'Open Headers Proxy CA';

/** Trust flags: trusted CA for TLS server certs; nothing for email/code. */
const NSS_TRUST_FLAGS = 'C,,';

const CERTUTIL_MISSING_DETAIL = 'certutil (NSS tools) not installed';

function firefoxProfilesRoot(homedir: string, platform: string): string {
  if (platform === 'darwin') return path.join(homedir, 'Library', 'Application Support', 'Firefox', 'Profiles');
  if (platform === 'win32') return path.join(homedir, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
  return path.join(homedir, '.mozilla', 'firefox');
}

/** Profile dirs that hold a `cert9.db` — the stores worth changing. */
export async function discoverFirefoxProfiles(homedir: string, platform: string): Promise<string[]> {
  const root = firefoxProfilesRoot(homedir, platform);
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }
  const profiles: string[] = [];
  for (const entry of entries) {
    const dir = path.join(root, entry);
    try {
      await stat(path.join(dir, 'cert9.db'));
      profiles.push(dir);
    } catch {
      // No cert9.db — not an NSS profile dir.
    }
  }
  return profiles.sort();
}

export async function installCaInNssProfile(
  certPem: string,
  profileDir: string,
  exec: ExecFn,
  tmpdir?: string,
): Promise<TrustStoreOpResult> {
  return withTempPem(
    certPem,
    async (pemPath) => {
      const result = await exec('certutil', [
        '-A',
        '-d',
        `sql:${profileDir}`,
        '-n',
        NSS_CERT_NICKNAME,
        '-t',
        NSS_TRUST_FLAGS,
        '-i',
        pemPath,
      ]);
      if (result.code === 0) return { ok: true };
      if (result.notFound) return { ok: false, error: CERTUTIL_MISSING_DETAIL, toolMissing: true };
      return { ok: false, error: result.stderr.trim() || `certutil exited ${result.code}` };
    },
    tmpdir,
  );
}

export async function removeCaFromNssProfile(profileDir: string, exec: ExecFn): Promise<TrustStoreOpResult> {
  const result = await exec('certutil', ['-D', '-d', `sql:${profileDir}`, '-n', NSS_CERT_NICKNAME]);
  if (result.code === 0) return { ok: true };
  if (result.notFound) return { ok: false, error: CERTUTIL_MISSING_DETAIL, toolMissing: true };
  const stderr = result.stderr.trim();
  // "could not find certificate named …" — already gone; teardown's
  // idempotent success case.
  if (stderr.toLowerCase().includes('could not find certificate')) return { ok: true };
  return { ok: false, error: stderr || `certutil exited ${result.code}` };
}

/**
 * Live probe: export the nicknamed cert as PEM and fingerprint-compare
 * against the stored CA — presence under our nickname with a foreign
 * fingerprint is `mismatch`, never trusted (§5 tamper visibility).
 */
export async function probeNssProfile(
  expectedFingerprintSha256: string | null,
  profileDir: string,
  exec: ExecFn,
): Promise<ProxyTrustStoreState> {
  const store = 'nss-firefox' as const;
  const result = await exec('certutil', ['-L', '-d', `sql:${profileDir}`, '-n', NSS_CERT_NICKNAME, '-a']);
  if (result.notFound) return { store, ref: profileDir, state: 'unavailable', detail: CERTUTIL_MISSING_DETAIL };
  if (result.code !== 0) {
    const stderr = result.stderr.trim().toLowerCase();
    if (stderr.includes('could not find certificate')) return { store, ref: profileDir, state: 'absent' };
    return { store, ref: profileDir, state: 'unavailable', detail: result.stderr.trim() || 'profile not readable' };
  }
  if (expectedFingerprintSha256 === null) {
    return { store, ref: profileDir, state: 'mismatch', detail: 'certificate present but no CA on record' };
  }
  let installedSha256: string;
  try {
    installedSha256 = certFingerprints(result.stdout).sha256;
  } catch {
    return { store, ref: profileDir, state: 'unavailable', detail: 'installed certificate is unparsable' };
  }
  if (installedSha256 !== expectedFingerprintSha256.toLowerCase()) {
    return { store, ref: profileDir, state: 'mismatch', detail: 'certificate fingerprint differs from the stored CA' };
  }
  return { store, ref: profileDir, state: 'trusted' };
}
