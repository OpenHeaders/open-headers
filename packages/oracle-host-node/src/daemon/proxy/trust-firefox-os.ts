/**
 * Firefox OS-store coverage (the proxy-security design §4 Firefox row, derived
 * path) — since Firefox 120 the browser trusts TLS roots from the OS
 * store by default (`security.enterprise_roots.enabled`; on macOS it
 * reads the user- and admin-domain trust settings both our keychain
 * cells write). On platforms where that holds, Firefox trust is
 * DERIVED from the keychain cells: nothing is written into any
 * profile, no change-record row exists, and there is nothing to tear
 * down.
 *
 * The derived row keys off the installed app bundle, never the profile
 * folder: macOS guards every other app's data under Application
 * Support, so listing Firefox's profiles from this process is blocked
 * and raises a "Data Access Blocked" notification for nothing. The
 * bundle under Applications is plain to read, and it is all the
 * derived verdict needs — a profile that turned the preference off
 * is that profile's own choice, out of sight here.
 *
 * Linux has no OS store Firefox reads, so the NSS/certutil path stays
 * authoritative there; Windows joins this derived path only once a
 * Windows OS-store cell exists.
 */

import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import type { ProxyTrustStoreState } from '@openheaders/core/types';

/** Bundle names the derived row looks for — every channel shares the OS-store default. */
const FIREFOX_BUNDLES = ['Firefox.app', 'Firefox Developer Edition.app', 'Firefox Nightly.app'] as const;

/**
 * Whether Firefox on this platform inherits trust from OS-store cells
 * this host can write. True only where BOTH halves hold: Firefox reads
 * the OS store there AND a cell exists that fills it (macOS keychains
 * today; Windows once its OS-store cell ships).
 */
export function firefoxFollowsOsStore(platform: string): boolean {
  return platform === 'darwin';
}

/** The Applications folders a bundle can live in — the system one and the user's own. */
export function defaultApplicationsRoots(homedir: string): string[] {
  return ['/Applications', path.join(homedir, 'Applications')];
}

/** Installed Firefox bundles under `roots`, each the ref of one derived row. */
export async function discoverFirefoxInstalls(roots: readonly string[]): Promise<string[]> {
  const installs: string[] = [];
  for (const root of roots) {
    for (const bundle of FIREFOX_BUNDLES) {
      const dir = path.join(root, bundle);
      try {
        if ((await stat(dir)).isDirectory()) installs.push(dir);
      } catch {
        // Not installed here.
      }
    }
  }
  return installs;
}

/**
 * Derived verdict for one install: `covered` when an OS-store cell is
 * trusted; `absent` while none is — coverage arrives with the keychain
 * install, not before.
 */
export function probeFirefoxOsCoverage(ref: string, osStoreTrusted: boolean): ProxyTrustStoreState {
  const store = 'nss-firefox' as const;
  if (!osStoreTrusted) {
    return { store, ref, state: 'absent', detail: 'follows the OS store once a keychain is trusted' };
  }
  return { store, ref, state: 'covered' };
}
