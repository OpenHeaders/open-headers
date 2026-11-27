/**
 * The way in for data a move to the Windows package brings.
 *
 * The classic app drives a move: it leaves a request note in its data
 * folder, starts the package with {@link FINISH_MOVE_SWITCH} and runs its
 * own uninstaller. The package, before it chooses its data folder, takes
 * the classic folder for its own — when it has none yet, the classic
 * folder carries the request, and the classic install is gone.
 *
 * The request is what tells a folder that was handed over from the live
 * folder of an install this package knows nothing of (an MSI install has
 * no entry of the classic installer's, and never moves). It stays in the
 * folder until the move is made, so a move the first start could not
 * finish is finished by a later one.
 *
 * One rename of the folder — no copy, no merge, no delete. Windows
 * refuses it while any process holds a file inside: that is waited out,
 * and past the wait the package must not start, or it would make an empty
 * folder of its own beside the user's data. A refusal that cannot pass
 * (another volume) is written into the request: the package then starts
 * on its own folder and the data stays where a classic install finds it.
 *
 * The classic folder's name is shared with `oh` and the hosts' config
 * directory (bootstrap/shared-config-files). Their files came along with
 * the rename, and are put back under the classic name, where `oh` reads
 * them.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { errorCode, isAbsent, isPlainDirectory } from './data-folder-return';
import type { InstallKind } from './install-kind';
import { moveSharedConfigFiles, readSharedConfigFiles } from './shared-config-files';

/** The switch the classic app starts the package with, to finish a move. Permanent: an older classic app starts a newer package. */
export const FINISH_MOVE_SWITCH = '--finish-move-to-package';

/** The request note the classic app leaves in its data folder. Permanent, as the switch is. */
export const MOVE_REQUEST_FILE_NAME = 'move-to-package.json';

/**
 * The classic installer's entry among the user's installed programs,
 * named as its builder names it (a name derived from the app's id). It is
 * the last thing the classic uninstaller removes.
 */
export const CLASSIC_UNINSTALL_REGISTRY_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\d8cc37c2-e13b-5d5f-a4c6-c5bf4ce53a9e';

/** How a start that does not carry on as the app ends. Permanent, as the switch is. */
export const FINISH_MOVE_EXIT = { classicStillInstalled: 6, dataHeld: 7 } as const;

const POLL_INTERVAL_MS = 500;
/** One minute for the classic uninstaller to finish. */
const UNINSTALL_WAIT_ATTEMPTS = 120;
/** Fifteen seconds for whatever still holds a file in the data to let go. */
const RENAME_ATTEMPTS = 30;
const WINDOWS_ANSWER_TIMEOUT_MS = 10_000;

/** What Windows answers a rename with while a process holds a file inside the folder. */
const HELD_CODES: ReadonlySet<string> = new Set(['EPERM', 'EBUSY', 'EACCES']);

export interface DataFolderMoveFacts {
  /** Only a Windows package takes the classic folder in. */
  readonly installKind: InstallKind | null;
  /** The package's data folder, about to be chosen. */
  readonly ownDir: string;
  /** The classic install's data folder. */
  readonly classicDir: string;
  /** The start was asked to finish a move: the classic uninstaller may still be running, and is waited for. */
  readonly awaitClassicUninstall: boolean;
}

export interface DataFolderMoveSeams {
  /** Whether the classic install is still registered; null when Windows did not say. Defaults to asking Windows. */
  readonly isClassicInstalled?: () => boolean | null;
  /** Defaults to `fs.renameSync`. */
  readonly rename?: (from: string, to: string) => void;
  /** Defaults to blocking this thread: the data folder is chosen before anything else may run. */
  readonly sleep?: (ms: number) => void;
}

export type DataFolderMove =
  | { readonly outcome: 'nothing-to-move' }
  /** `sharedFilesLeft` names the files of `oh` and the hosts that could not be put back where they are read. */
  | { readonly outcome: 'moved'; readonly from: string; readonly sharedFilesLeft: readonly string[] }
  | { readonly outcome: 'classic-still-installed'; readonly from: string }
  | { readonly outcome: 'held'; readonly from: string; readonly code: string }
  | { readonly outcome: 'ineligible'; readonly from: string; readonly code: string };

const NOTHING_TO_MOVE: DataFolderMove = { outcome: 'nothing-to-move' };

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Asks Windows whether the classic installer's entry is still there. */
function askWindowsForClassicInstall(): boolean | null {
  const reg = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe');
  try {
    execFileSync(reg, ['query', CLASSIC_UNINSTALL_REGISTRY_KEY], {
      stdio: 'ignore',
      timeout: WINDOWS_ANSWER_TIMEOUT_MS,
      windowsHide: true,
    });
    return true;
  } catch (error) {
    // `reg query` ends with 1 for a key that is not there.
    return error instanceof Error && 'status' in error && error.status === 1 ? false : null;
  }
}

type MoveRequest = 'absent' | 'pending' | 'ineligible';

/** The request's presence is the classic app's word; its content only carries a verdict. */
function readMoveRequest(classicDir: string): MoveRequest {
  let text: string;
  try {
    text = fs.readFileSync(path.join(classicDir, MOVE_REQUEST_FILE_NAME), 'utf8');
  } catch {
    return 'absent';
  }
  try {
    const request: unknown = JSON.parse(text);
    const judged =
      typeof request === 'object' && request !== null && 'verdict' in request && request.verdict === 'ineligible';
    return judged ? 'ineligible' : 'pending';
  } catch {
    return 'pending';
  }
}

function recordIneligible(classicDir: string, code: string): void {
  try {
    fs.writeFileSync(
      path.join(classicDir, MOVE_REQUEST_FILE_NAME),
      `${JSON.stringify({ verdict: 'ineligible', code }, null, 2)}\n`,
    );
  } catch {
    // The folder cannot be written either: the next start reaches the same verdict.
  }
}

export function moveDataFolderToPackage(facts: DataFolderMoveFacts, seams: DataFolderMoveSeams = {}): DataFolderMove {
  if (facts.installKind !== 'msix') return NOTHING_TO_MOVE;
  if (!isAbsent(facts.ownDir)) return NOTHING_TO_MOVE;
  const from = facts.classicDir;
  if (!isPlainDirectory(from)) return NOTHING_TO_MOVE;
  if (readMoveRequest(from) !== 'pending') return NOTHING_TO_MOVE;

  const isClassicInstalled = seams.isClassicInstalled ?? askWindowsForClassicInstall;
  const sleep = seams.sleep ?? sleepSync;
  let installed = isClassicInstalled();
  for (
    let attempt = 1;
    facts.awaitClassicUninstall && installed !== false && attempt < UNINSTALL_WAIT_ATTEMPTS;
    attempt++
  ) {
    sleep(POLL_INTERVAL_MS);
    installed = isClassicInstalled();
  }
  if (installed !== false) return { outcome: 'classic-still-installed', from };

  const rename = seams.rename ?? fs.renameSync;
  for (let attempt = 1; ; attempt++) {
    try {
      rename(from, facts.ownDir);
      break;
    } catch (error) {
      const code = errorCode(error);
      if (!HELD_CODES.has(code)) {
        recordIneligible(from, code);
        return { outcome: 'ineligible', from, code };
      }
      if (attempt === RENAME_ATTEMPTS) return { outcome: 'held', from, code };
      sleep(POLL_INTERVAL_MS);
    }
  }
  try {
    fs.rmSync(path.join(facts.ownDir, MOVE_REQUEST_FILE_NAME), { force: true });
  } catch {
    // The request stays in a folder that is the package's now: no start reads it there.
  }
  const shared = readSharedConfigFiles(facts.ownDir);
  const sharedFilesLeft = shared === null ? [] : moveSharedConfigFiles(facts.ownDir, from, shared.names);
  return { outcome: 'moved', from, sharedFilesLeft };
}
