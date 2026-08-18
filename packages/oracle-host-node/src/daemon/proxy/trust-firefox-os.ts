/**
 * Firefox OS-store coverage (the proxy-security design §4 Firefox row, derived
 * path) — since Firefox 120 the browser trusts TLS roots from the OS
 * store by default (`security.enterprise_roots.enabled`; on macOS it
 * reads the user- and admin-domain trust settings both our keychain
 * cells write). On platforms where that holds, Firefox trust is
 * DERIVED from the keychain cells: nothing is written into any
 * profile, no change-record row exists, and there is nothing to tear
 * down. The only per-profile fact worth probing is the opt-out — a
 * profile that turned the preference off cannot inherit keychain
 * trust, and the surface must say so instead of claiming coverage.
 *
 * Linux has no OS store Firefox reads, so the NSS/certutil path stays
 * authoritative there; Windows joins this derived path only once a
 * Windows OS-store cell exists.
 */

import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { ProxyTrustStoreState } from '@openheaders/core/types';

/** The Firefox preference gating OS-store trust anchors (default true since 120). */
export const FIREFOX_ENTERPRISE_ROOTS_PREF = 'security.enterprise_roots.enabled';

const OPT_OUT_PATTERN = /user_pref\(\s*"security\.enterprise_roots\.enabled"\s*,\s*false\s*\)/;

/**
 * Whether Firefox on this platform inherits trust from OS-store cells
 * this host can write. True only where BOTH halves hold: Firefox reads
 * the OS store there AND a cell exists that fills it (macOS keychains
 * today; Windows once its OS-store cell ships).
 */
export function firefoxFollowsOsStore(platform: string): boolean {
  return platform === 'darwin';
}

/**
 * A profile opted out when its `prefs.js` pins the preference to
 * false. An unreadable or absent `prefs.js` reads as the default —
 * fresh profiles have no user_pref line for it.
 */
export async function firefoxProfileOptedOut(profileDir: string): Promise<boolean> {
  let prefs: string;
  try {
    prefs = await readFile(path.join(profileDir, 'prefs.js'), 'utf8');
  } catch {
    return false;
  }
  return OPT_OUT_PATTERN.test(prefs);
}

/**
 * Derived per-profile verdict: `covered` when an OS-store cell is
 * trusted and the profile did not opt out; `optedOut` when the profile
 * disabled OS-store trust; `absent` while no OS-store cell is trusted
 * — coverage arrives with the keychain install, not before.
 */
export async function probeFirefoxOsCoverage(
  profileDir: string,
  osStoreTrusted: boolean,
): Promise<ProxyTrustStoreState> {
  const store = 'nss-firefox' as const;
  if (await firefoxProfileOptedOut(profileDir)) {
    return {
      store,
      ref: profileDir,
      state: 'optedOut',
      detail: `${FIREFOX_ENTERPRISE_ROOTS_PREF} is off in this profile`,
    };
  }
  if (!osStoreTrusted) {
    return { store, ref: profileDir, state: 'absent', detail: 'follows the OS store once a keychain is trusted' };
  }
  return { store, ref: profileDir, state: 'covered' };
}
