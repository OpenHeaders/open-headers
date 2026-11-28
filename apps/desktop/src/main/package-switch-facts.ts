/**
 * What a classic install reads of this PC and of the feed before it may
 * switch to the Windows package — the facts
 * `bootstrap/package-switch-eligibility` judges. Every edge is handed in,
 * so the readers are pinned with fakes.
 *
 * Two answers say whether a package of ours is installed, as on the way
 * home (`bootstrap/data-folder-return`): the folder Windows keeps per
 * installed package, and Windows asked by the package's name. The folder
 * is read at once; the ask starts a program and is made only when a
 * switch is about to begin.
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { classicDataDir, packageDataDir } from './bootstrap/data-dir';
import {
  hasPackageFolder,
  isAbsent,
  isPlainDirectory,
  packageListedIn,
  windowsPackageQuery,
} from './bootstrap/data-folder-return';
import type { InstallKind } from './bootstrap/install-kind';
import type { PackageOffer, PackageSwitchFacts } from './bootstrap/package-switch-eligibility';
import { fetchPackagePointer } from './package-pointer';
import type { UpdateChannel } from './update-feed';

/** Where a Windows tree keeps the installer program it carries, under `resources` (the pack hook puts it there). */
export const CARRIED_INSTALLER_DIR_NAME = 'installer';

/** The installer program's file, named as it is published. */
export function carriedInstallerFileName(arch: 'x64' | 'arm64'): string {
  return `OpenHeaders-Installer-${arch}.exe`;
}

const WINDOWS_ANSWER_TIMEOUT_MS = 30_000;

/** This install, as its own process knows it. */
export interface PackageSwitchInstall {
  readonly installKind: InstallKind | null;
  /** `os.release()` — `10.0.<build>` on Windows. */
  readonly osRelease: string;
  /** `process.resourcesPath`. */
  readonly resourcesPath: string;
  /** `process.arch` — the arch of this tree, and of the installer it carries. */
  readonly arch: string;
  /** `app.runningUnderARM64Translation` — an x64 tree on an ARM PC. */
  readonly underArm64Translation: boolean;
  /** `app.getPath('userData')` — the folder this run keeps its data in. */
  readonly dataDir: string;
  /** `app.isPackaged`. */
  readonly isPackaged: boolean;
  /** `app.getPath('appData')`. */
  readonly appDataDir: string;
  /** `%LOCALAPPDATA%`. */
  readonly localAppDataDir: string | undefined;
  /** `os.homedir()` — where Local AppData is looked for when the variable is unset. */
  readonly homeDir: string;
  /** `app.getVersion()`. */
  readonly appVersion: string;
}

export interface PackageSwitchAsk {
  /** The update channel this install follows: the pointer a switch installs from. */
  readonly channel: UpdateChannel;
  /** Whether Windows is asked by the package's name too, where its folder says no package is installed. */
  readonly askWindows: boolean;
}

export interface PackageSwitchFactsDeps {
  readonly fetch: typeof fetch;
  readonly log: { warn(message: string): void };
  /** Defaults to `fs.existsSync`. */
  readonly fileExists?: (target: string) => boolean;
  /** Whether Windows keeps a folder for a package of ours; null when the listing cannot be read. Defaults to reading it. */
  readonly hasPackageFolder?: (localAppDataDir: string) => boolean | null;
  /** Whether Windows lists a package of ours; null when it did not say. Defaults to asking Windows. */
  readonly askWindows?: () => Promise<boolean | null>;
}

/** The build number of a Windows release (`10.0.26200` → 26200); null for anything else. */
export function windowsBuildOf(osRelease: string): number | null {
  const build = /^\d+\.\d+\.(\d+)/.exec(osRelease)?.[1];
  return build === undefined ? null : Number(build);
}

/**
 * The installer program this tree carries: one of its own arch. Null for
 * an arch the installer is not built for.
 */
export function carriedInstallerPath(install: Pick<PackageSwitchInstall, 'resourcesPath' | 'arch'>): string | null {
  if (install.arch !== 'x64' && install.arch !== 'arm64') return null;
  return path.join(install.resourcesPath, CARRIED_INSTALLER_DIR_NAME, carriedInstallerFileName(install.arch));
}

/** The arch of the package the installer puts on this PC: the PC's own, whatever the tree's. */
function packageArch(install: Pick<PackageSwitchInstall, 'arch' | 'underArm64Translation'>): string {
  return install.underArm64Translation ? 'arm64' : install.arch;
}

function askWindowsForPackage(): Promise<boolean | null> {
  const { file, args } = windowsPackageQuery();
  return new Promise((resolve) => {
    const asked = execFile(
      file,
      [...args],
      { encoding: 'utf8', timeout: WINDOWS_ANSWER_TIMEOUT_MS, windowsHide: true },
      (error, stdout) => resolve(error ? null : packageListedIn(stdout)),
    );
    // The question takes no input, and must not wait for any.
    asked.stdin?.end();
  });
}

async function readOffer(
  install: PackageSwitchInstall,
  channel: UpdateChannel,
  deps: PackageSwitchFactsDeps,
): Promise<PackageOffer> {
  try {
    const pointer = await fetchPackagePointer(deps.fetch, channel, packageArch(install));
    if (pointer === null) return { state: 'none' };
    return { state: 'read', version: pointer.version, stop: pointer.stop, forThisArch: pointer.url !== null };
  } catch (error) {
    deps.log.warn(
      `the ${channel} package pointer could not be read: ${error instanceof Error ? error.message : error}`,
    );
    return { state: 'unread' };
  }
}

async function readPackageInstalled(
  localAppDataDir: string,
  askWindows: boolean,
  deps: PackageSwitchFactsDeps,
): Promise<boolean | null> {
  const folder = (deps.hasPackageFolder ?? hasPackageFolder)(localAppDataDir);
  if (folder !== false || !askWindows) return folder;
  return (deps.askWindows ?? askWindowsForPackage)();
}

export async function readPackageSwitchFacts(
  install: PackageSwitchInstall,
  ask: PackageSwitchAsk,
  deps: PackageSwitchFactsDeps,
): Promise<PackageSwitchFacts> {
  const localAppDataDir = install.localAppDataDir || path.join(install.homeDir, 'AppData', 'Local');
  const classicDir = classicDataDir(install);
  const packageDir = packageDataDir(install);
  const installer = carriedInstallerPath(install);
  const [packageInstalled, offer] = await Promise.all([
    readPackageInstalled(localAppDataDir, ask.askWindows, deps),
    readOffer(install, ask.channel, deps),
  ]);
  return {
    installKind: install.installKind,
    windowsBuild: windowsBuildOf(install.osRelease),
    hasInstaller: installer !== null && (deps.fileExists ?? fs.existsSync)(installer),
    dataDir: install.dataDir,
    classicDir,
    classicDirIsPlain: isPlainDirectory(classicDir),
    packageDir,
    packageDirIsAbsent: isAbsent(packageDir),
    packageInstalled,
    appVersion: install.appVersion,
    offer,
  };
}
