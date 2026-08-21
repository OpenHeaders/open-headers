/**
 * electron-updater adapter for the update service's {@link UpdaterPort}
 * seam. All Electron/updater specifics live here; the state machine in
 * `update-service.ts` stays host-free.
 *
 * Posture (the updates plan): `autoDownload` stays FALSE at the
 * library level — the service decides when to download, so the
 * `updates.autoDownload` preference is enforced in one place.
 * `autoInstallOnAppQuit` starts true (a staged download applies on a
 * quit that happens anyway) but is owned by the service through the
 * setInstallOnQuit seam: it flips false when the feed stops offering
 * the staged version, so a rolled-back or superseded stage can never
 * apply itself.
 */

import { app } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { writeRestartHiddenFlag } from './bootstrap/launch-flags';
import { requestQuit } from './bootstrap/lifecycle';
import { createLogger } from './bootstrap/logger';
import { getMainWindow } from './bootstrap/window-manager';
import { desktopFeedUrl, releaseNotesUrl, type UpdateChannel } from './update-feed';
import type { AvailableUpdate, UpdateCapability, UpdaterPort } from './update-service';

/**
 * What this install lets the update service do. `self` where an
 * updater can actually run: packaged builds on macOS/Windows, or a
 * Linux AppImage. Packaged Linux without an AppImage is a deb/rpm
 * install — the package manager owns updates, so the service only
 * checks and notifies (`notify`, via `manifest-updater-port.ts`).
 * Dev/unpackaged runs get `none`; so does the env escape hatch, which
 * keeps test harnesses and CI from ever dialing a release feed —
 * notify still dials it, so the hatch must cover it too.
 */
export function updateCapability(): UpdateCapability {
  if (process.env.OH_DISABLE_UPDATE_CHECKS === '1') return 'none';
  if (!app.isPackaged) return 'none';
  if (process.platform === 'darwin' || process.platform === 'win32') return 'self';
  if (typeof process.env.APPIMAGE === 'string' && process.env.APPIMAGE.length > 0) return 'self';
  return 'notify';
}

function toAvailableUpdate(info: UpdateInfo): AvailableUpdate {
  return {
    version: info.version,
    // The feed's releaseNotes field is inline HTML/markdown, not a URL.
    // The pointer files name assets on the releases repo, so the
    // offered version's tag page exists by construction.
    releaseNotesUrl: releaseNotesUrl(info.version),
  };
}

export function createElectronUpdaterPort(getChannel: () => UpdateChannel): UpdaterPort {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // Generic provider over the own-domain pointer feed (update-feed.ts).
  // The channel follows the `updates.channel` setting per check —
  // switching changes what the NEXT check offers, never a staged
  // download's consent flow. The pointer files carry absolute GitHub
  // asset URLs; multi-range requests are off because GitHub's asset CDN
  // only honors single ranges (differential downloads still work — one
  // range per chunk run).
  let feedChannel: UpdateChannel | null = null;
  const ensureFeed = (): void => {
    const channel = getChannel();
    if (channel === feedChannel) return;
    feedChannel = channel;
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: desktopFeedUrl(channel),
      useMultipleRangeRequest: false,
    });
  };
  ensureFeed();

  // electron-updater's internals (feed resolution, differential
  // download, signature validation) log through this hook — route them
  // into `<userData>/logs/main.log` where every other subsystem lands.
  const logger = createLogger('electron-updater');
  autoUpdater.logger = {
    info: (message?: unknown) => logger.info(String(message)),
    warn: (message?: unknown) => logger.warn(String(message)),
    error: (message?: unknown) => logger.error(String(message)),
    debug: (message?: unknown) => logger.debug(String(message)),
  };

  return {
    check(): Promise<AvailableUpdate | null> {
      ensureFeed();
      return new Promise((resolve, reject) => {
        const cleanup = (): void => {
          autoUpdater.removeListener('update-available', onAvailable);
          autoUpdater.removeListener('update-not-available', onNotAvailable);
          autoUpdater.removeListener('error', onError);
        };
        const onAvailable = (info: UpdateInfo): void => {
          cleanup();
          resolve(toAvailableUpdate(info));
        };
        const onNotAvailable = (): void => {
          cleanup();
          resolve(null);
        };
        const onError = (err: Error): void => {
          cleanup();
          reject(err);
        };
        autoUpdater.on('update-available', onAvailable);
        autoUpdater.on('update-not-available', onNotAvailable);
        autoUpdater.on('error', onError);
        autoUpdater.checkForUpdates().catch((err: unknown) => {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        });
      });
    },

    async download(onProgressPercent: (percent: number) => void): Promise<void> {
      const onProgress = (progress: { percent: number }): void => {
        onProgressPercent(progress.percent);
      };
      autoUpdater.on('download-progress', onProgress);
      try {
        await autoUpdater.downloadUpdate();
      } finally {
        autoUpdater.removeListener('download-progress', onProgress);
      }
    },

    quitAndInstall(): void {
      // Tray-resident hidden window (e.g. install triggered from the
      // tray menu): keep the relaunch silent instead of flashing the
      // window visible. Checked NOW — the lifecycle teardown destroys
      // windows before the finisher fires.
      const win = getMainWindow();
      const hidden = !win || win.isDestroyed() || !win.isVisible();
      if (hidden) writeRestartHiddenFlag();
      // The install rides the lifecycle machine: engine flush + pty
      // drain first, then the installer swap as the exit finisher.
      // On Windows the file swap takes 10s+ (uninstall + extract +
      // Defender scans), so when the window was visible the installer
      // shows its progress bar instead of leaving dead air; a
      // tray-hidden install stays fully silent (macOS/AppImage swaps
      // are silent either way). isForceRunAfter=true relaunches once
      // the update is applied, so Update & Restart feels like one
      // motion. If the swap ever stalls, the machine's exit-grace
      // rail force-exits and the staged update applies on the next
      // launch.
      requestQuit({
        reason: 'update-install',
        finish: () => autoUpdater.quitAndInstall(hidden, true),
      });
    },

    setInstallOnQuit(enabled: boolean): void {
      autoUpdater.autoInstallOnAppQuit = enabled;
    },
  };
}
