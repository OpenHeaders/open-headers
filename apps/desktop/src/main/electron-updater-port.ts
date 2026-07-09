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
import type { AvailableUpdate, UpdaterPort } from './update-service';

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
    // The feed's releaseNotes is inline HTML/markdown, not a URL; the
    // release page link joins with the severity manifest (Phase 3).
    releaseNotesUrl: null,
  };
}

export function createElectronUpdaterPort(): UpdaterPort {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  return {
    check(): Promise<AvailableUpdate | null> {
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
      autoUpdater.quitAndInstall();
    },
  };
}
