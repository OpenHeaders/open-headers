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
 * One rename and nothing else — no copy, no merge, no delete, no retry,
 * no other folder. Windows refuses the rename while any process holds a
 * file inside and when the two folders are on different volumes; the app
 * then starts as it always has. Its own folder exists from that start
 * on, so this runs once in an install's life.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { InstallKind } from './install-kind';

/** The package's data folder, under `%LOCALAPPDATA%`. */
export const PACKAGE_DATA_DIR_NAME = 'OpenHeaders-Data';

/** The package's identity name: what Windows knows an installed package by. */
export const PACKAGE_IDENTITY_NAME = 'OpenHeaders';

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
  | { readonly outcome: 'left'; readonly from: string; readonly why: string };

const NOTHING_TO_RETURN: DataFolderReturn = { outcome: 'nothing-to-return' };

const WINDOWS_ANSWER_TIMEOUT_MS = 30_000;

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';
}

/** A real folder — a link or a junction is not one this app made. */
function isPlainDirectory(target: string): boolean {
  try {
    return fs.lstatSync(target, { throwIfNoEntry: false })?.isDirectory() === true;
  } catch {
    return false;
  }
}

function isAbsent(target: string): boolean {
  try {
    return fs.lstatSync(target, { throwIfNoEntry: false }) === undefined;
  } catch {
    return false;
  }
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
  if (!isAbsent(facts.ownDir)) return NOTHING_TO_RETURN;
  const from = path.join(facts.localAppDataDir, PACKAGE_DATA_DIR_NAME);
  if (isAbsent(from)) return NOTHING_TO_RETURN;
  if (!isPlainDirectory(from)) return { outcome: 'left', from, why: 'it is not a plain folder' };

  const packageFolder = hasPackageFolder(facts.localAppDataDir);
  if (packageFolder === null) return { outcome: 'left', from, why: "the user's Packages folder could not be read" };
  if (packageFolder) return { outcome: 'left', from, why: 'a Windows package of the app is installed' };
  const listed = (seams.isPackageInstalled ?? askWindowsForPackage)();
  if (listed === null) return { outcome: 'left', from, why: 'Windows did not say whether a package is installed' };
  if (listed) return { outcome: 'left', from, why: 'a Windows package of the app is installed' };

  try {
    (seams.rename ?? fs.renameSync)(from, facts.ownDir);
  } catch (error) {
    return { outcome: 'left', from, why: `Windows refused the rename (${errorCode(error)})` };
  }
  return { outcome: 'returned', from };
}
