/**
 * {@link UpdaterPort} for a Windows package. Windows updates a package
 * itself: the app only tells it where the newer one is.
 *
 * `check()` reads our own pointer — the channel's
 * `desktop/<channel>/windows-package.json`, written by the release
 * workflow — and downloads nothing. Electron's package updater has no
 * such look: its one call stages at once, and a staged package is the
 * app at its next start with no way to withdraw it. So that call is
 * `download()`, reached only through the user's Update & Restart (the
 * service's `onRequest` capability), and `quitAndInstall()` follows it
 * in the same motion.
 *
 * Windows fetches the bytes and reports nothing on the way, so the port
 * declares that it has no progress to give.
 *
 * Windows registers a staged package once the app's process is gone, and
 * starts the app again; it closes nothing itself. So after the install
 * request the port ends the app — a moment later, since Electron hands
 * the request to Windows on another thread and says nothing when it is
 * there.
 *
 * Everything outside this file is injected — the fetch, Electron's
 * updater, the facts of this install — so the port is pinned with fakes.
 */

import { releaseNotesUrl, type UpdateChannel, windowsPackagePointerUrl } from './update-feed';
import type { AvailableUpdate, UpdaterPort } from './update-service';
import { compareCalVer, isVersionString } from './versions-manifest';

type PackageUpdaterEvent = 'update-downloaded' | 'update-not-available' | 'error';

/**
 * How long the app stays after the install request before it ends
 * itself: the time for the request to reach Windows and for Windows to
 * find the app running, which is what makes it start the app again.
 */
export const PACKAGE_INSTALL_HAND_OVER_MS = 4_000;

/** The slice of Electron's updater the port drives. */
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

interface PointerReading {
  version: string;
  stop: boolean;
  /** This arch's link; null when the pointer names no package for it. */
  url: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What this install reads from a fetched pointer. Null on a shape it
 * cannot act on. Fields it does not read are passed by: the pointer is a
 * wire contract, and an older package reads newer ones.
 */
function readPointer(raw: unknown, arch: string): PointerReading | null {
  if (!isRecord(raw)) return null;
  const { version, stop, packages } = raw;
  if (!isVersionString(version) || typeof stop !== 'boolean' || !isRecord(packages)) return null;
  const entry = packages[arch];
  if (entry === undefined) return { version, stop, url: null };
  if (!isRecord(entry) || typeof entry.url !== 'string' || !entry.url.startsWith('https://')) return null;
  return { version, stop, url: entry.url };
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function createMsixUpdaterPort(deps: MsixUpdaterPortDeps): UpdaterPort {
  // The last check's offer: the link `download()` hands to Windows.
  let offered: { version: string; url: string } | null = null;

  return {
    reportsDownloadProgress: false,

    async check(): Promise<AvailableUpdate | null> {
      offered = null;
      const response = await deps.fetch(windowsPackagePointerUrl(deps.getChannel()), {
        cache: 'no-store',
        redirect: 'follow',
      });
      // No pointer: the channel has published no package. Any other
      // failure throws — a check must never report "up to date" for a
      // feed it could not read.
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`update feed returned ${response.status}`);
      const pointer = readPointer(await response.json(), deps.arch);
      if (pointer === null) throw new Error('update feed returned an unreadable package pointer');
      if (pointer.stop) return null;
      if (compareCalVer(pointer.version, deps.currentVersion) <= 0) return null;
      if (pointer.url === null) {
        deps.log.warn(`the package pointer offers ${pointer.version} but names no ${deps.arch} package`);
        return null;
      }
      offered = { version: pointer.version, url: pointer.url };
      return { version: pointer.version, releaseNotesUrl: releaseNotesUrl(pointer.version) };
    },

    async download(): Promise<void> {
      const target = offered;
      if (target === null) throw new Error('no package update is on offer');
      if (!deps.hasPackageIdentity()) {
        throw new Error('this process does not carry the package identity Windows updates a package by');
      }
      deps.updater.setFeedURL({ url: target.url });
      await new Promise<void>((resolve, reject) => {
        const settle = (outcome: () => void): void => {
          deps.updater.removeListener('update-downloaded', onDownloaded);
          deps.updater.removeListener('update-not-available', onNotAvailable);
          deps.updater.removeListener('error', onError);
          outcome();
        };
        const onDownloaded = (): void => settle(resolve);
        const onNotAvailable = (): void =>
          settle(() => reject(new Error('Windows found no package at the offered link')));
        const onError = (...args: unknown[]): void => settle(() => reject(asError(args[0])));
        deps.updater.on('update-downloaded', onDownloaded);
        deps.updater.on('update-not-available', onNotAvailable);
        deps.updater.on('error', onError);
        try {
          void Promise.resolve(deps.updater.checkForUpdates()).catch(onError);
        } catch (err) {
          onError(err);
        }
      });
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
        deps.updater.on('error', onRefused);
        try {
          void Promise.resolve(deps.updater.quitAndInstall()).then(onEndedEarly, onRefused);
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
