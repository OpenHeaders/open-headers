/**
 * The update feed's URL contract (the distribution plan §3).
 *
 * Every machine-readable update contract lives behind
 * `updates.openheaders.com` — static pointer files on R2, written by the
 * release workflow (`scripts/generate-update-feed.mjs`). The pointer
 * files carry absolute URLs to the GitHub release assets; clients never
 * resolve GitHub "latest" themselves, so per-app release cadence can
 * never strand this client.
 *
 * Layout, mirrored by the generator:
 *   desktop/{stable,beta}/latest*.yml   — electron-updater generic feed
 *   versions/{stable,beta}.json         — severity manifest, all apps
 */

export const UPDATE_FEED_ORIGIN = 'https://updates.openheaders.com';

/** Channel = path segment, selected by the `updates.channel` setting (default `stable`). */
export type UpdateChannel = 'stable' | 'beta';

/** Base URL electron-updater's generic provider resolves `latest*.yml` against. */
export function desktopFeedUrl(channel: UpdateChannel): string {
  return `${UPDATE_FEED_ORIGIN}/desktop/${channel}`;
}

/** The severity manifest for a channel (`versions-manifest.ts` reads stable). */
export function versionsManifestUrl(channel: UpdateChannel): string {
  return `${UPDATE_FEED_ORIGIN}/versions/${channel}.json`;
}

/**
 * Where release artifacts and their human tag pages live. Data, not a
 * printed URL: release-notes links derive from it because the feed's
 * pointer files name assets on this repo's release pages.
 */
export const RELEASES_REPO = 'OpenHeaders/open-headers';

export function releaseNotesUrl(version: string): string {
  return `https://github.com/${RELEASES_REPO}/releases/tag/v${version}`;
}
