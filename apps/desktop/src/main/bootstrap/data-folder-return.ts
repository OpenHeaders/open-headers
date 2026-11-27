/**
 * The way home for data a move to the Windows package took.
 *
 * The package keeps its data in a folder of its own, and a move renames
 * the classic install's folder into it. Someone who later removes the
 * package and installs the classic app again would start on an empty
 * folder beside their data. So the classic app, before it chooses its
 * data folder, takes the package's folder back — when its own does not
 * exist, the package's does, and no package of ours is installed.
 *
 * "No package installed" takes two answers that must agree: Windows
 * keeps a folder per installed package under the user's `Packages`, and
 * Windows is asked by the package's name. An answer that cannot be had
 * counts as "installed": the data stays where a package may be using it.
 *
 * One rename of the folder — no copy, no merge, no delete of data, no
 * retry, no other folder. Windows refuses the rename while any process
 * holds a file inside and when the two folders are on different volumes.
 *
 * The classic folder's name is shared with `oh` and the hosts' config
 * directory (bootstrap/shared-config-files): a folder of that name
 * holding their files alone holds no data of the app's, and counts as
 * none. Their files step into the package's folder for the rename and
 * come back with it under the classic name.
 *
 * A classic app that has no data of its own never makes a fresh folder by
 * itself while the user's data may sit with a package: its own data
 * would exist from that start on, and this would never run again. While a
 * package is installed the start is handed over to it; when the package's
 * folder was left behind and cannot be taken back, the caller asks the
 * person. An app that has its own data reads nothing here.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { InstallKind } from './install-kind';
import { moveSharedConfigFiles, readSharedConfigFiles } from './shared-config-files';

/** The package's data folder, under `%LOCALAPPDATA%`. */
export const PACKAGE_DATA_DIR_NAME = 'OpenHeaders-Data';

/** The package's identity name: what Windows knows an installed package by. */
export const PACKAGE_IDENTITY_NAME = 'OpenHeaders';

/** A folder of the app's own inside its data folder: the first thing any start makes there. */
const OWN_DATA_MARK_DIR_NAME = 'logs';

export interface DataFolderReturnFacts {
  /**
   * Only an installed classic app takes the folder back: a Windows package
   * never takes its own folder away, and a development run has a folder of
   * its own name.
   */
  readonly installKind: InstallKind | null;
  /** The classic app's data folder, about to be chosen. */
  readonly ownDir: string;
  /** `%LOCALAPPDATA%`; without it nothing is looked for. */
  readonly localAppDataDir: string | undefined;
}

export interface DataFolderReturnSeams {
  /** Whether Windows lists a package of ours for this user; null when it did not say. Defaults to asking Windows. */
  readonly isPackageInstalled?: () => boolean | null;
  /** Defaults to `fs.renameSync`. */
  readonly rename?: (from: string, to: string) => void;
}

export type DataFolderReturn =
  | { readonly outcome: 'nothing-to-return' }
  | { readonly outcome: 'returned'; readonly from: string }
  /** A package of ours is installed: it is the app on this account. */
  | { readonly outcome: 'package-installed' }
  /** `why` is for the log; `reason` is the short token a person is shown. */
  | { readonly outcome: 'left'; readonly from: string; readonly why: string; readonly reason: string };

const NOTHING_TO_RETURN: DataFolderReturn = { outcome: 'nothing-to-return' };
const PACKAGE_INSTALLED: DataFolderReturn = { outcome: 'package-installed' };

const WINDOWS_ANSWER_TIMEOUT_MS = 30_000;

export function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';
}

/** A real folder — a link or a junction is not one this app made. */
export function isPlainDirectory(target: string): boolean {
  try {
    return fs.lstatSync(target, { throwIfNoEntry: false })?.isDirectory() === true;
  } catch {
    return false;
  }
}

export function isAbsent(target: string): boolean {
  try {
    return fs.lstatSync(target, { throwIfNoEntry: false }) === undefined;
  } catch {
    return false;
  }
}

/**
 * The shared files a classic folder holds when it holds nothing else;
 * null when it holds anything of the app's, is empty, or cannot be read.
 */
function sharedFilesStandingAlone(ownDir: string): readonly string[] | null {
  if (!isPlainDirectory(ownDir)) return null;
  const shared = readSharedConfigFiles(ownDir);
  return shared?.alone && shared.names.length > 0 ? shared.names : null;
}

/**
 * Moves the shared files into the package's folder and removes the
 * classic folder they emptied. Returns the code of what refused, with
 * every file back where it was; null when the classic name is free.
 */
function freeClassicName(ownDir: string, packageDir: string, sharedFiles: readonly string[]): string | null {
  const stayed = moveSharedConfigFiles(ownDir, packageDir, sharedFiles);
  let code: string | null = stayed.length > 0 ? 'EBUSY' : null;
  if (code === null) {
    try {
      fs.rmdirSync(ownDir);
    } catch (error) {
      code = errorCode(error);
    }
  }
  if (code !== null) {
    moveSharedConfigFiles(
      packageDir,
      ownDir,
      sharedFiles.filter((name) => !stayed.includes(name)),
    );
  }
  return code;
}

/**
 * Makes the classic folder the app's own, with something of the app's in
 * it: no later start then reads it as holding none of the app's data.
 */
export function claimDataFolder(ownDir: string): void {
  fs.mkdirSync(path.join(ownDir, OWN_DATA_MARK_DIR_NAME), { recursive: true });
}

/**
 * Whether Windows keeps a folder for a package of ours: one per package
 * family, named `<identity name>_<publisher id>`. Null when the listing
 * cannot be read.
 */
function hasPackageFolder(localAppDataDir: string): boolean | null {
  const prefix = `${PACKAGE_IDENTITY_NAME}_`.toLowerCase();
  try {
    return fs.readdirSync(path.join(localAppDataDir, 'Packages')).some((name) => name.toLowerCase().startsWith(prefix));
  } catch (error) {
    return errorCode(error) === 'ENOENT' ? false : null;
  }
}

/** Asks Windows for the packages of our name installed for this user. */
function askWindowsForPackage(): boolean | null {
  const powershell = path.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  // A failed query must end the command, not print a count of nothing.
  const command = `$ErrorActionPreference = 'Stop'; @(Get-AppxPackage -Name '${PACKAGE_IDENTITY_NAME}').Count`;
  try {
    const answer = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: WINDOWS_ANSWER_TIMEOUT_MS,
      windowsHide: true,
    }).trim();
    return /^\d+$/.test(answer) ? Number(answer) > 0 : null;
  } catch {
    return null;
  }
}

export function returnDataFolderFromPackage(
  facts: DataFolderReturnFacts,
  seams: DataFolderReturnSeams = {},
): DataFolderReturn {
  const isClassicInstall = facts.installKind === 'nsis' || facts.installKind === 'msi';
  if (!isClassicInstall || !facts.localAppDataDir) return NOTHING_TO_RETURN;
  const sharedFiles = isAbsent(facts.ownDir) ? [] : sharedFilesStandingAlone(facts.ownDir);
  if (sharedFiles === null) return NOTHING_TO_RETURN;
  const packageFolder = hasPackageFolder(facts.localAppDataDir);
  if (packageFolder) return PACKAGE_INSTALLED;
  const from = path.join(facts.localAppDataDir, PACKAGE_DATA_DIR_NAME);
  if (isAbsent(from)) return NOTHING_TO_RETURN;
  if (!isPlainDirectory(from)) {
    return { outcome: 'left', from, why: 'it is not a plain folder', reason: 'not-a-folder' };
  }
  if (packageFolder === null) {
    return { outcome: 'left', from, why: "the user's Packages folder could not be read", reason: 'unreadable' };
  }
  const listed = (seams.isPackageInstalled ?? askWindowsForPackage)();
  if (listed === null) {
    return { outcome: 'left', from, why: 'Windows did not say whether a package is installed', reason: 'no-answer' };
  }
  if (listed) return PACKAGE_INSTALLED;

  // The shared files step into the package's folder, so that the classic
  // name is free for the rename; they are back under it either way.
  if (sharedFiles.length > 0) {
    const code = freeClassicName(facts.ownDir, from, sharedFiles);
    if (code !== null) {
      return { outcome: 'left', from, why: `the classic folder could not be cleared (${code})`, reason: code };
    }
  }
  try {
    (seams.rename ?? fs.renameSync)(from, facts.ownDir);
  } catch (error) {
    moveSharedConfigFiles(from, facts.ownDir, sharedFiles);
    const code = errorCode(error);
    return { outcome: 'left', from, why: `Windows refused the rename (${code})`, reason: code };
  }
  return { outcome: 'returned', from };
}
