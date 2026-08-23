/**
 * Which native clients the visitor at the pairing gate can install,
 * derived from the browser and OS the tab is running on.
 *
 * Pure over a {@link HostProbe} so the whole mapping is unit-tested
 * without a DOM. Two rules carry it:
 *
 *   - Every Chromium derivative installs from the Chrome Web Store, so
 *     Brave/Opera/Vivaldi/Chromium fold onto the `chrome` listing —
 *     the store is the destination, not the browser's own brand. A
 *     browser with no listing at all (Safari today, anything
 *     unrecognized) gets the full set instead of a wrong single guess.
 *   - The desktop link is the website's install section for every
 *     platform; detection only decides the mark and the name beside it.
 *     Resolving a direct installer would mean fetching the update feed,
 *     and this is a pre-pairing screen on someone else's server — it
 *     makes no outbound request the visitor did not ask for.
 */

import { getHostAssets } from '@openheaders/core/assets';
import type { InstallTargetBrowser } from '@openheaders/core/capabilities';
import {
  type BrowserKind,
  detectBrowser,
  detectPlatform,
  type HostProbe,
  PLATFORM_DISPLAY_NAME,
  type PlatformKind,
} from '@openheaders/core/utils';
import { DESKTOP_DOWNLOAD_URL } from '@openheaders/ui/shared/desktop-teaser';
import { EXTENSION_STORE_URLS, INSTALL_BROWSER_LABELS } from '@openheaders/ui/workbench/data/extension-stores';

export interface GateClientTarget {
  /** Host-relative mark path, for `hostAssets.resolveUrl`. */
  icon: string;
  /** Brand noun beside the row label; null when nothing was detected. */
  name: string | null;
  /** Where the install happens — outside the app, in the store or on the site. */
  url: string;
}

/** Browsers that install from a listing, and which listing that is. */
const STORE_FOR_BROWSER: Partial<Record<BrowserKind, InstallTargetBrowser>> = {
  chrome: 'chrome',
  chromium: 'chrome',
  brave: 'chrome',
  opera: 'chrome',
  vivaldi: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
};

/** Marks per platform; `unknown` falls back to the product logo. */
const PLATFORM_MARK: Record<PlatformKind, string> = {
  macos: 'images/clients/macos.svg',
  windows: 'images/clients/windows.svg',
  ubuntu: 'images/clients/ubuntu.svg',
  debian: 'images/clients/debian.svg',
  fedora: 'images/clients/fedora.svg',
  linux: 'images/clients/linux.svg',
  unknown: 'images/logo-pixel.svg',
};

function storeTarget(browser: InstallTargetBrowser): GateClientTarget {
  return {
    icon: `images/clients/${browser}.svg`,
    name: INSTALL_BROWSER_LABELS[browser],
    url: EXTENSION_STORE_URLS[browser],
  };
}

/**
 * The extension listings to offer. One when the browser maps to a
 * store, all of them when it does not — a Safari visitor still needs
 * to see that the extension exists for the browsers that carry it.
 */
export function resolveExtensionTargets(probe: HostProbe): readonly GateClientTarget[] {
  const store = STORE_FOR_BROWSER[detectBrowser(probe)];
  return store ? [storeTarget(store)] : (['chrome', 'edge', 'firefox'] as const).map(storeTarget);
}

/** The desktop download, named for the platform when one is detected. */
export function resolveDesktopTarget(probe: HostProbe): GateClientTarget {
  const platform = detectPlatform(probe);
  return {
    icon: PLATFORM_MARK[platform],
    name: platform === 'unknown' ? null : PLATFORM_DISPLAY_NAME[platform],
    url: DESKTOP_DOWNLOAD_URL,
  };
}

/** Absolute URL for a target's mark, through the host asset resolver. */
export function markUrl(target: GateClientTarget): string {
  return getHostAssets().resolveUrl(target.icon);
}
