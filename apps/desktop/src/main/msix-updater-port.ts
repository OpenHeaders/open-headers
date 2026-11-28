/**
 * {@link UpdaterPort} for a Windows package. Windows updates a package
 * itself: the app only tells it where the newer one is.
 *
 * `check()` reads our own pointer — the channel's
 * `desktop/<channel>/windows-package.json`, written by the release
 * workflow — and downloads nothing. Asking Windows for a package stages
 * it at once, and a staged package is the app at its next start with no
 * way to withdraw it. So that ask is `download()`, reached only through
 * the user's Update & Restart (the service's `onRequest` capability),
 * and `quitAndInstall()` follows it in the same motion.
 *
 * Both asks go through the package-update addon, which hears the
 * percentage Windows reports while it fetches. Where the addon did not
 * load, Electron's package updater makes the same two asks: it tells
 * nobody how far a fetch is, so the port then declares that it has no
 * progress to give. One of the two makes both asks — Electron's updater
 * installs only what it staged itself.
 *
 * Windows registers a staged package once the app's process is gone, and
 * starts the app again; it closes nothing itself. So after the install
 * request the port ends the app — a moment later, since the request
 * reaches Windows on another thread and nothing says when it is there.
 *
 * Everything outside this file is injected — the fetch, the addon,
 * Electron's updater, the facts of this install — so the port is pinned
 * with fakes.
 */

import { fetchPackagePointer } from './package-pointer';
import { releaseNotesUrl, type UpdateChannel } from './update-feed';
import type { AvailableUpdate, UpdaterPort } from './update-service';
import { compareCalVer } from './versions-manifest';

type PackageUpdaterEvent = 'update-downloaded' | 'update-not-available' | 'error';

/**
 * How long the app stays after the install request before it ends
 * itself: the time for the request to reach Windows and for Windows to
 * find the app running, which is what makes it start the app again.
 * Windows has the request within a few hundredths of a second.
 */
export const PACKAGE_INSTALL_HAND_OVER_MS = 1_000;

/** The slice of the package-update addon the port drives. */
export interface PackageUpdateAddon {
  /**
   * Asks Windows to stage the package at the link, telling `onPercent`
   * every percentage Windows reports. Rejects with Windows' own words.
   */
  stage(link: string, onPercent: (percent: number) => void): Promise<void>;
  /**
   * Asks Windows to register the staged version and to start the app
   * again. Settles when Windows' operation ends: rejected with Windows'
   * own words when Windows refused.
   */
  register(): Promise<void>;
}

/** The slice of Electron's updater the port drives where the addon did not load. */
export interface PackageUpdater {
  setFeedURL(options: { url: string }): void;
  /** In a package: hands Windows the feed's link and stages what it fetches. */
  checkForUpdates(): void | Promise<void>;
  /**
   * In a package: asks Windows to register the staged version and to
   * start the app again. Settles when Windows' operation ends, whatever
   * its outcome; a request that never reached Windows is an `error`.
   */
  quitAndInstall(): void | Promise<void>;
  on(event: PackageUpdaterEvent, listener: (...args: unknown[]) => void): unknown;
  removeListener(event: PackageUpdaterEvent, listener: (...args: unknown[]) => void): unknown;
}

export interface MsixUpdaterPortDeps {
  /** Null where the addon is not built or did not load. */
  readonly addon: PackageUpdateAddon | null;
  readonly updater: PackageUpdater;
  readonly fetch: typeof fetch;
  /**
   * Whether this process carries the package's identity. One the app
   * started itself may not, and Windows updates a package by that
   * identity alone.
   */
  readonly hasPackageIdentity: () => boolean;
  /** `process.arch` — which of the pointer's packages is this install's. */
  readonly arch: string;
  readonly currentVersion: string;
  readonly getChannel: () => UpdateChannel;
  /** The app's own quit: its teardown first, `finish` as the last act. */
  readonly quitThen: (finish: () => void) => void;
  /** Ends the process, once the app is torn down. */
  readonly exit: () => void;
  readonly setTimer: (fn: () => void, ms: number) => unknown;
  readonly log: { info(msg: string): void; warn(msg: string, err?: unknown): void };
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** Stages the package at the link through Electron's updater, which reports no progress. */
function stageThroughUpdater(updater: PackageUpdater, url: string): Promise<void> {
  updater.setFeedURL({ url });
  return new Promise<void>((resolve, reject) => {
    const settle = (outcome: () => void): void => {
      updater.removeListener('update-downloaded', onDownloaded);
      updater.removeListener('update-not-available', onNotAvailable);
      updater.removeListener('error', onError);
      outcome();
    };
    const onDownloaded = (): void => settle(resolve);
    const onNotAvailable = (): void => settle(() => reject(new Error('Windows found no package at the offered link')));
    const onError = (...args: unknown[]): void => settle(() => reject(asError(args[0])));
    updater.on('update-downloaded', onDownloaded);
    updater.on('update-not-available', onNotAvailable);
    updater.on('error', onError);
    try {
      void Promise.resolve(updater.checkForUpdates()).catch(onError);
    } catch (err) {
      onError(err);
    }
  });
}

export function createMsixUpdaterPort(deps: MsixUpdaterPortDeps): UpdaterPort {
  const { addon, updater } = deps;
  // The last check's offer: the link `download()` hands to Windows.
  let offered: { version: string; url: string } | null = null;

  return {
    reportsDownloadProgress: addon !== null,

    async check(): Promise<AvailableUpdate | null> {
      offered = null;
      // No pointer: the channel has published no package. Any other
      // failure throws — a check must never report "up to date" for a
      // feed it could not read.
      const pointer = await fetchPackagePointer(deps.fetch, deps.getChannel(), deps.arch);
      if (pointer === null) return null;
      if (pointer.stop) return null;
      if (compareCalVer(pointer.version, deps.currentVersion) <= 0) return null;
      if (pointer.url === null) {
        deps.log.warn(`the package pointer offers ${pointer.version} but names no ${deps.arch} package`);
        return null;
      }
      offered = { version: pointer.version, url: pointer.url };
      return { version: pointer.version, releaseNotesUrl: releaseNotesUrl(pointer.version) };
    },

    async download(onProgressPercent: (percent: number) => void): Promise<void> {
      const target = offered;
      if (target === null) throw new Error('no package update is on offer');
      if (!deps.hasPackageIdentity()) {
        throw new Error('this process does not carry the package identity Windows updates a package by');
      }
      if (addon !== null) await addon.stage(target.url, onProgressPercent);
      else await stageThroughUpdater(updater, target.url);
      deps.log.info(`package ${target.version} staged by Windows`);
    },

    quitAndInstall(): void {
      deps.quitThen(() => {
        let ended = false;
        const end = (): void => {
          if (ended) return;
          ended = true;
          deps.exit();
        };
        const onRefused = (...args: unknown[]): void => {
          if (ended) return;
          deps.log.warn('Windows did not take the package install', args[0]);
          end();
        };
        // Windows' operation waits for this process to go, so one that
        // ends while the app still runs did not install.
        const onEndedEarly = (): void => {
          if (ended) return;
          deps.log.warn("Windows' package install ended with the app still running");
          end();
        };
        // Electron's updater says a request that never reached Windows
        // as an `error`; the addon says every refusal by rejecting.
        const install =
          addon !== null
            ? () => addon.register()
            : () => {
                updater.on('error', onRefused);
                return updater.quitAndInstall();
              };
        try {
          void Promise.resolve(install()).then(onEndedEarly, onRefused);
        } catch (err) {
          onRefused(err);
        }
        deps.setTimer(() => {
          if (ended) return;
          deps.log.info('package install left to Windows — exiting');
          end();
        }, PACKAGE_INSTALL_HAND_OVER_MS);
      });
    },

    setInstallOnQuit(enabled: boolean): void {
      // Nothing to gate: a staged package is the app at its next start.
      if (!enabled) deps.log.warn('a staged package cannot be withdrawn — it applies at the next start');
    },
  };
}
