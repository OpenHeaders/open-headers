/**
 * electron-updater adapter for the update service's {@link UpdaterPort}
 * seam. All Electron/updater specifics live here; the state machine in
 * `update-service.ts` stays host-free.
 *
 * Posture (docs/UPDATES_PLAN.md): `autoDownload` stays FALSE at the
 * library level — the service decides when to download, so the
 * `updates.autoDownload` preference is enforced in one place.
 * `autoInstallOnAppQuit` stays true: it only ever applies an update the
 * user already consented to download, on a quit that happens anyway.
 */

import { app } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { writeRestartHiddenFlag } from './bootstrap/launch-flags';
import { createLogger } from './bootstrap/logger';
import { markQuitting } from './bootstrap/quit-state';
import { getMainWindow } from './bootstrap/window-manager';
import { desktopFeedUrl, releaseNotesUrl, type UpdateChannel } from './update-feed';
import type { AvailableUpdate, UpdaterPort } from './update-service';

/**
 * If the quit stalls (a stray close-intercept, a hung before-quit
 * handler), force the process down — the staged update then applies on
 * the installer's relaunch.
 */
const INSTALL_EXIT_FAILSAFE_MS = 3_000;

/**
 * Where an updater can actually run: packaged builds on macOS/Windows,
 * or a Linux AppImage. Dev/unpackaged runs and deb/rpm installs are
 * unsupported (package managers own those updates). The env escape
 * hatch keeps test harnesses and CI from ever dialing a release feed.
 */
export function updaterSupported(): boolean {
  if (process.env.OH_DISABLE_UPDATE_CHECKS === '1') return false;
  if (!app.isPackaged) return false;
  if (process.platform === 'darwin' || process.platform === 'win32') return true;
  return typeof process.env.APPIMAGE === 'string' && process.env.APPIMAGE.length > 0;
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
      // window visible.
      const win = getMainWindow();
      if (win && !win.isDestroyed() && !win.isVisible()) writeRestartHiddenFlag();
      // quitAndInstall closes every window BEFORE quitting — and the
      // tray-resident primary intercepts 'close' into a hide unless the
      // quitting flag is up. Without this the close is swallowed, the
      // quit never completes, and "Restart to install" just hides the
      // window.
      markQuitting();
      // isSilent=false, isForceRunAfter=true — run the installer UI as
      // needed and relaunch the app once the update is applied.
      autoUpdater.quitAndInstall(false, true);
      setTimeout(() => app.exit(0), INSTALL_EXIT_FAILSAFE_MS);
    },
  };
}
