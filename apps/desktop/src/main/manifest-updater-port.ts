/**
 * Notify-only {@link UpdaterPort} for installs the package manager owns
 * (Linux deb/rpm — the distribution plan §5). electron-updater never
 * runs here: `check()` is a plain static GET of the channel's
 * `versions/<channel>.json` pointer file — the same file, parse, and
 * ordering the severity fetch already uses (`versions-manifest.ts`), so
 * client and pipeline can never disagree on what "newer" means.
 *
 * The action verbs are structurally inert: the update service refuses
 * download/install under the `notify` capability before ever reaching
 * the port, and `download` rejects as a second wall so a future wiring
 * mistake fails loudly instead of self-applying.
 */

import { releaseNotesUrl, type UpdateChannel, versionsManifestUrl } from './update-feed';
import type { AvailableUpdate, UpdaterPort } from './update-service';
import { compareCalVer, parseDesktopSeverity } from './versions-manifest';

export function createManifestUpdaterPort(
  currentVersion: string,
  getChannel: () => UpdateChannel,
  fetchFn: typeof fetch = fetch,
): UpdaterPort {
  return {
    async check(): Promise<AvailableUpdate | null> {
      // Unlike the severity fetch (absent manifest = severity unknown,
      // non-fatal), a check must distinguish "up to date" from "feed
      // unreachable" — a manual check that swallowed a network failure
      // would report "you're up to date" untruthfully. So: throw.
      const response = await fetchFn(versionsManifestUrl(getChannel()), { cache: 'no-store', redirect: 'follow' });
      if (!response.ok) throw new Error(`update feed returned ${response.status}`);
      const info = parseDesktopSeverity(await response.json());
      if (info === null) throw new Error('update feed returned an unreadable manifest');
      if (compareCalVer(info.latest, currentVersion) <= 0) return null;
      return { version: info.latest, releaseNotesUrl: releaseNotesUrl(info.latest) };
    },

    download(): Promise<void> {
      return Promise.reject(new Error('package-manager installs never download in-app'));
    },

    quitAndInstall(): void {
      // Unreachable: install() refuses before the port under `notify`.
    },

    setInstallOnQuit(): void {
      // Nothing is ever staged here — there is nothing to gate.
    },
  };
}
