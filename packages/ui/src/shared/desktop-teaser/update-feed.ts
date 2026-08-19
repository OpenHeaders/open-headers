/**
 * Update-feed client for the desktop teaser — resolves the latest
 * desktop installer for THIS platform from the same static manifest
 * every app reads (the distribution plan §3): the release
 * workflow writes `versions/stable.json` behind
 * `updates.openheaders.com` (CORS-enabled, edge-cached five minutes)
 * with the desktop entry's `latest` version + release `tag`, and
 * asset URLs derive from the pipeline's asset-naming contract on the
 * feed's `dl/<tag>/` paths — the exact computation the website's
 * download section runs.
 *
 * Resolution is best-effort: hosts whose page can't reach the feed
 * (offline, CORS scoped elsewhere) resolve `null` and the teaser CTA
 * falls back to the website's install section.
 */

export const UPDATE_FEED_ORIGIN = 'https://updates.openheaders.com';

/** The website's install section — the CTA fallback when the feed is
 *  unreachable, and the "other platforms" secondary link. */
export const DESKTOP_DOWNLOAD_URL = 'https://openheaders.com/#install-desktop';

export type DesktopPlatform = 'mac' | 'windows' | 'linux';

export interface DesktopInstaller {
  version: string;
  platform: DesktopPlatform;
  /** Direct installer download on the feed's `dl/<tag>/` path. */
  url: string;
}

/** Proper names, deliberately unlocalized. */
export const DESKTOP_PLATFORM_LABELS: Record<DesktopPlatform, string> = {
  mac: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
};

function detectPlatform(): DesktopPlatform {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
  return 'linux';
}

/**
 * Installer asset name per platform — the release pipeline's naming
 * contract, mirrored from the website's download section. macOS
 * resolves to the arm64 build (the website's default for its macOS
 * button too); Intel users reach their build via the fallback link.
 */
function installerAssetName(version: string, platform: DesktopPlatform): string {
  switch (platform) {
    case 'mac':
      return `OpenHeaders-${version}-mac-arm64.dmg`;
    case 'windows':
      return `OpenHeaders-${version}-Setup.exe`;
    case 'linux':
      return `OpenHeaders-${version}-x86_64.AppImage`;
  }
}

interface VersionsManifestDesktopEntry {
  latest?: unknown;
  tag?: unknown;
}

async function resolveLatestDesktopInstaller(): Promise<DesktopInstaller | null> {
  try {
    const res = await fetch(`${UPDATE_FEED_ORIGIN}/versions/stable.json`);
    if (!res.ok) return null;
    const manifest: unknown = await res.json();
    if (typeof manifest !== 'object' || manifest === null) return null;
    const desktop = (manifest as { desktop?: VersionsManifestDesktopEntry }).desktop;
    const version = desktop?.latest;
    const tag = desktop?.tag;
    if (typeof version !== 'string' || version.length === 0) return null;
    if (typeof tag !== 'string' || tag.length === 0) return null;
    const platform = detectPlatform();
    return {
      version,
      platform,
      url: `${UPDATE_FEED_ORIGIN}/dl/${tag}/${installerAssetName(version, platform)}`,
    };
  } catch {
    return null;
  }
}

// One manifest fetch per page load, shared by every mounted teaser —
// the same single-flight shape the website's download section uses.
let installerPromise: Promise<DesktopInstaller | null> | undefined;

export function fetchLatestDesktopInstaller(): Promise<DesktopInstaller | null> {
  installerPromise ??= resolveLatestDesktopInstaller();
  return installerPromise;
}
