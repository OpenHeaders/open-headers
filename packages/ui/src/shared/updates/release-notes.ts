/**
 * Version-ignore persistence + release-page fallback shared by the
 * update dialog, the corner toast, and the gear menu.
 *
 * "Ignore This Update" is a notification preference, not updater state:
 * the ignored version stays visible in Settings and the native menus,
 * but the toast stays quiet and the gear drops its dot. A newer offer
 * (different version) speaks again; a security-floor release always
 * ignores the ignore.
 */

const IGNORE_KEY = 'oh.updateIgnoreVersion';

export function readIgnoredVersion(): string | null {
  try {
    return window.localStorage.getItem(IGNORE_KEY);
  } catch {
    return null;
  }
}

export function writeIgnoredVersion(version: string): void {
  try {
    window.localStorage.setItem(IGNORE_KEY, version);
  } catch {
    // Storage unavailable — the ignore simply doesn't persist.
  }
}

/**
 * Release page for a version — the notes fallback when the update feed
 * doesn't carry a notes URL. The public releases repo is the same feed
 * the updater checks, so the tag always exists for any version that
 * reached a user.
 */
export function releasePageUrl(version: string): string {
  return `https://github.com/OpenHeaders/open-headers/releases/tag/v${version}`;
}
