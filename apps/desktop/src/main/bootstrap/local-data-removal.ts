/**
 * A Windows package removes its own data and capture trust.
 *
 * A package has no uninstall hook: what the app keeps outside its package
 * stays when Windows removes it — the data folder with every stored
 * secret and the capture authority's key, a certificate a browser may
 * still trust, the browsers' keys. Removing them is the person's own act,
 * from Settings, and it takes two processes.
 *
 * The running app undoes what lies outside the folder while it still can
 * (the record of where trust was installed is inside it): trust first,
 * then the browsers' keys. It deletes nothing of its own folder — a
 * process cannot delete files it holds. It leaves a request note in the
 * folder, quits through its lifecycle and starts itself again through
 * its launch alias with {@link REMOVE_LOCAL_DATA_SWITCH}.
 *
 * That start is not an app instance: a scratch profile, no lock, no
 * engine. It deletes one folder — the package's own, found by its own
 * derivation, never a path it was handed — and only when the request
 * note is there, so the switch typed in a shell removes nothing. Windows
 * refuses a delete while the old process still holds a file inside: that
 * is waited out, as a move's rename is.
 *
 * The names are not permanent: the app starts itself, the same version on
 * both ends.
 */

import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import type { BridgeRpcResponse, LocalDataRemovalResult } from '@openheaders/core/bridge';
import { app, dialog } from 'electron';
import { packageDataDir } from './data-dir';
import { errorCode, isPlainDirectory } from './data-folder-return';
import { type InstallKind, installKind } from './install-kind';
import { initMainLocale, mainTranslator } from './locale';
import { startOnScratchProfile } from './scratch-profile';

/** The switch the app starts itself with, to delete its data folder. */
export const REMOVE_LOCAL_DATA_SWITCH = '--remove-local-data';

/** The request note the running app leaves in its data folder. */
export const REMOVAL_REQUEST_FILE_NAME = 'remove-local-data.json';

/** How the removal start ends. */
export const LOCAL_DATA_REMOVAL_EXIT = { removed: 0, notRequested: 8, left: 9 } as const;

const POLL_INTERVAL_MS = 500;
/** Fifteen seconds for the process that asked to let go of its files. */
const REMOVE_ATTEMPTS = 30;

/**
 * What Windows answers a delete with while a process holds a file inside
 * the folder: the file's own delete is refused, or the file goes only
 * once its last handle closes and its folder reads as not yet empty.
 */
const HELD_CODES: ReadonlySet<string> = new Set(['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY']);

export interface LocalDataRemovalTargetFacts {
  readonly installKind: InstallKind | null;
  /** `OPENHEADERS_USER_DATA_DIR`: a data folder named from outside. */
  readonly userDataOverride: string | undefined;
  /** `%LOCALAPPDATA%`. */
  readonly localAppDataDir: string | undefined;
  /** `os.homedir()` — where Local AppData is looked for when the variable is unset. */
  readonly homeDir: string;
}

/**
 * The one folder a removal deletes: the Windows package's own data
 * folder. Null where there is no removal — outside a package, and in a
 * package running on a folder named from outside, where the app's data
 * and this folder are two different places.
 */
export function localDataRemovalTarget(facts: LocalDataRemovalTargetFacts): string | null {
  if (facts.installKind !== 'msix' || facts.userDataOverride) return null;
  return packageDataDir(facts);
}

function requestPath(target: string): string {
  return path.join(target, REMOVAL_REQUEST_FILE_NAME);
}

function writeRemovalRequest(target: string): void {
  fs.writeFileSync(requestPath(target), `${JSON.stringify({ requestedAt: new Date().toISOString() }, null, 2)}\n`);
}

/**
 * Takes a request out of the folder. A request no removal start took up
 * must not wait there: every ordinary start of a package withdraws it, so
 * the switch alone never deletes anything.
 */
export function withdrawRemovalRequest(target: string): void {
  try {
    fs.rmSync(requestPath(target), { force: true });
  } catch {
    // Unwritable: the folder's own trouble, and the next start asks again.
  }
}

// ── The running app's half ───────────────────────────────────────────

export interface LocalDataRemovalRequestFacts {
  /** {@link localDataRemovalTarget}. */
  readonly target: string | null;
  /** The person's second word: go on past a store that kept its trust. */
  readonly force: boolean;
}

export interface LocalDataRemovalRequestSeams {
  /** The app's launch alias as Windows keeps it now. */
  readonly appAlias: () => { readonly on: boolean; readonly name: string };
  /** The capture trust teardown, with the authority's key dropped once every store is clean. */
  readonly undoTrust: () => Promise<BridgeRpcResponse<'oh.daemon.proxy.trust.remove'>>;
  /** Removes the browsers' keys that name a manifest in that folder. Never throws. */
  readonly removeBrowserKeys: (dataDir: string) => Promise<void>;
  /** Quits the app through its lifecycle and starts the removal once it has wound down. */
  readonly quitToRemove: (target: string) => void;
  /** Defaults to writing the note. */
  readonly writeRequest?: (target: string) => void;
}

/**
 * Everything the running app does for a removal, in the one order that
 * leaves nothing orphaned: the alias it will start itself through, trust
 * (a store that keeps it stops everything unless forced), the browsers'
 * keys, the request, the quit.
 */
export async function requestLocalDataRemoval(
  facts: LocalDataRemovalRequestFacts,
  seams: LocalDataRemovalRequestSeams,
): Promise<LocalDataRemovalResult> {
  const { target } = facts;
  if (target === null) return { outcome: 'failed', reason: 'unavailable' };
  const alias = seams.appAlias();
  if (!alias.on) return { outcome: 'alias-off', name: alias.name };

  let teardown: BridgeRpcResponse<'oh.daemon.proxy.trust.remove'>;
  try {
    teardown = await seams.undoTrust();
  } catch (error) {
    teardown = { ok: false, results: [], error: error instanceof Error ? error.message : String(error) };
  }
  if (!teardown.ok && !facts.force) {
    return {
      outcome: 'trust-refused',
      stores: teardown.results
        .filter((result) => !result.ok)
        .map(({ store, ref, error }) => ({ store, ref, ...(error !== undefined ? { error } : {}) })),
      ...(teardown.error !== undefined ? { error: teardown.error } : {}),
    };
  }

  await seams.removeBrowserKeys(target);
  try {
    (seams.writeRequest ?? writeRemovalRequest)(target);
  } catch (error) {
    return { outcome: 'failed', reason: errorCode(error) };
  }
  seams.quitToRemove(target);
  return { outcome: 'restarting' };
}

// ── The removal start ────────────────────────────────────────────────

export interface LocalDataRemovalFacts {
  /** {@link localDataRemovalTarget}, by this start's own derivation. */
  readonly target: string | null;
}

export interface LocalDataRemovalSeams {
  /** Deletes the folder with everything in it. Defaults to `fs.rmSync`. */
  readonly remove?: (target: string) => void;
  /** Defaults to blocking this thread: the start does nothing else. */
  readonly sleep?: (ms: number) => void;
}

export type LocalDataRemoval =
  /** `why` is for whoever started it from a shell. */
  | { readonly outcome: 'not-requested'; readonly why: string }
  | { readonly outcome: 'removed'; readonly target: string }
  | { readonly outcome: 'left'; readonly target: string; readonly code: string };

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeFolder(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
}

function isFile(target: string): boolean {
  try {
    return fs.lstatSync(target, { throwIfNoEntry: false })?.isFile() === true;
  } catch {
    return false;
  }
}

export function removeLocalData(facts: LocalDataRemovalFacts, seams: LocalDataRemovalSeams = {}): LocalDataRemoval {
  const { target } = facts;
  if (target === null) return { outcome: 'not-requested', why: 'this install has no data folder of its own to remove' };
  if (!isPlainDirectory(target)) return { outcome: 'not-requested', why: `${target} is not a folder` };
  if (!isFile(requestPath(target))) {
    return { outcome: 'not-requested', why: `${target} carries no removal request` };
  }

  const remove = seams.remove ?? removeFolder;
  const sleep = seams.sleep ?? sleepSync;
  for (let attempt = 1; ; attempt++) {
    try {
      remove(target);
      return { outcome: 'removed', target };
    } catch (error) {
      const code = errorCode(error);
      if (!HELD_CODES.has(code) || attempt === REMOVE_ATTEMPTS) return { outcome: 'left', target, code };
      sleep(POLL_INTERVAL_MS);
    }
  }
}

/** Runs the removal INSTEAD of the app. Ends the process itself. */
export function runLocalDataRemoval(dialogTitle: string): void {
  startOnScratchProfile();
  void app.whenReady().then(() => {
    const removal = removeLocalData({
      target: localDataRemovalTarget({
        installKind: installKind(),
        userDataOverride: process.env.OPENHEADERS_USER_DATA_DIR,
        localAppDataDir: process.env.LOCALAPPDATA,
        homeDir: homedir(),
      }),
    });
    if (removal.outcome === 'not-requested') {
      process.stderr.write(`${removal.why}\n`);
      app.exit(LOCAL_DATA_REMOVAL_EXIT.notRequested);
      return;
    }
    initMainLocale();
    const t = mainTranslator();
    if (removal.outcome === 'removed') {
      dialog.showMessageBoxSync({ type: 'info', title: dialogTitle, message: t('desktop.dialog.dataRemoval.done') });
      app.exit(LOCAL_DATA_REMOVAL_EXIT.removed);
      return;
    }
    dialog.showMessageBoxSync({
      type: 'error',
      title: dialogTitle,
      message: t('desktop.dialog.dataRemoval.left', { path: removal.target, reason: removal.code }),
    });
    app.exit(LOCAL_DATA_REMOVAL_EXIT.left);
  });
}
