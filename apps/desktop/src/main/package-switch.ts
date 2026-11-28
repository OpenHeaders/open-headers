/**
 * A classic install starts its switch to the Windows package.
 *
 * The installer program makes the move (`native/windows-installer`, "A
 * move"): it puts the package on the PC, asks it whether it starts, runs
 * this install's uninstaller and reads how that ended. The app's part is
 * small. It copies the installer out of its tree — the uninstaller
 * empties the install folder — and starts the copy with this install's
 * own program, process, uninstaller and the place of its request note,
 * over a pipe: the installer's standard handles.
 *
 * Three things are heard on that pipe. {@link READY_WORD}: the package is
 * installed and starts; the app writes its request note, answers
 * {@link GO_WORD} and quits through its own lifecycle. `stopped <exit
 * code>`: the move is over and nothing of this install was changed. The
 * pipe closing without either: the installer ended before it could say.
 *
 * The app never waits for the installer's exit, which comes long after
 * its last word. The switches and the words are between one version of
 * the app and the installer it carries, and are not permanent; the note's
 * name is the package's own, and is.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createInterface } from 'node:readline';
import { MOVE_REQUEST_FILE_NAME } from './bootstrap/data-folder-move';
import { errorCode } from './bootstrap/data-folder-return';
import { CLASSIC_UNINSTALLER_FILE_NAME } from './bootstrap/install-kind';
import type { UpdateChannel } from './update-feed';

/** What the installer says once the package passed its start check. */
export const READY_WORD = 'ready';
/** What the app answers once its request note is written, before it quits. */
export const GO_WORD = 'go';
/** What the installer says, with its exit code, when a move stops. */
export const STOPPED_WORD = 'stopped';
/** What the app answers when it cannot give its word: anything but the go calls the move off. */
const NO_WORD = 'no';

/**
 * The folder under the temp folder the installer's copy is started from.
 * Not the installer's own download folder, which it empties at its end;
 * not the data folder, whose rename a program running inside would hold.
 */
export const SWITCH_COPY_DIR_NAME = 'OpenHeaders-Switch';

export interface PackageSwitchPlanFacts {
  /** The installer program this tree carries. */
  readonly installer: string;
  /** `app.getPath('temp')`. */
  readonly tempDir: string;
  /** `process.execPath` — the app's own program, in the install folder. */
  readonly executablePath: string;
  /** `process.pid`. */
  readonly pid: number;
  /** The classic data folder, where the request note is written. */
  readonly classicDir: string;
  /** The channel whose pointer said this install may switch: the installer reads the same one. */
  readonly channel: UpdateChannel;
}

/** Everything the installer is started with. */
export interface PackageSwitchPlan {
  readonly installer: string;
  readonly copyRoot: string;
  readonly app: string;
  readonly appPid: number;
  readonly uninstaller: string;
  readonly note: string;
  readonly channel: UpdateChannel;
}

export function packageSwitchPlan(facts: PackageSwitchPlanFacts): PackageSwitchPlan {
  return {
    installer: facts.installer,
    copyRoot: path.join(facts.tempDir, SWITCH_COPY_DIR_NAME),
    app: facts.executablePath,
    appPid: facts.pid,
    uninstaller: path.join(path.dirname(facts.executablePath), CLASSIC_UNINSTALLER_FILE_NAME),
    note: path.join(facts.classicDir, MOVE_REQUEST_FILE_NAME),
    channel: facts.channel,
  };
}

/** The installer's switches for a move: the four that name this install, and the channel. */
export function moveInstallerArguments(plan: PackageSwitchPlan): string[] {
  return [
    '--channel',
    plan.channel,
    '--move-app',
    plan.app,
    '--move-app-pid',
    String(plan.appPid),
    '--move-uninstaller',
    plan.uninstaller,
    '--move-note',
    plan.note,
  ];
}

/** The started installer, as the app hears it. */
export interface MoveInstaller {
  /** Every line the installer says on the pipe, until the pipe closes. */
  readonly lines: AsyncIterable<string>;
  /** Writes one word on the pipe; settles once the pipe has it, rejects when the pipe is gone. */
  say(word: string): Promise<void>;
}

export interface PackageSwitchSeams {
  /** Quits the app through its lifecycle. */
  readonly quit: () => void;
  readonly log: { info(message: string): void; warn(message: string): void };
  /** Copies the installer out of the tree and returns the copy. Defaults to a fresh folder under the plan's root. */
  readonly copyInstaller?: (installer: string, copyRoot: string) => string;
  /** Starts a program that outlives this one, on a pipe; rejects when Windows refuses. */
  readonly start?: (file: string, args: readonly string[]) => Promise<MoveInstaller>;
  /** Defaults to writing the note. */
  readonly writeNote?: (note: string) => void;
}

export type PackageSwitchEnd =
  /** The installer has the app's go: the app is quitting, and the installer carries on alone. */
  | { readonly outcome: 'handed-over' }
  /** The move is over with this install as it was. `code` is the installer's exit code; null when it ended without saying. */
  | { readonly outcome: 'stopped'; readonly code: number | null };

export type PackageSwitchStart =
  /** `reason` is a short token for the log and the person. */
  | { readonly started: false; readonly reason: string }
  | { readonly started: true; readonly ended: Promise<PackageSwitchEnd> };

/**
 * Copies of earlier starts are taken away first. One whose installer
 * still runs keeps its file — Windows holds a running program's — and so
 * each start copies into a folder of its own.
 */
function copyInstallerOut(installer: string, copyRoot: string): string {
  fs.mkdirSync(copyRoot, { recursive: true });
  for (const earlier of fs.readdirSync(copyRoot)) {
    try {
      fs.rmSync(path.join(copyRoot, earlier), { recursive: true, force: true });
    } catch {
      // Still running: the next start takes it away.
    }
  }
  const copy = path.join(fs.mkdtempSync(path.join(copyRoot, 'run-')), path.basename(installer));
  fs.copyFileSync(installer, copy);
  return copy;
}

/** Starts the installer apart from this process, its standard input and output a pipe to it. */
export function startMoveInstaller(file: string, args: readonly string[]): Promise<MoveInstaller> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, [...args], { detached: true, stdio: ['pipe', 'pipe', 'ignore'] });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      const { stdin, stdout } = child;
      // A write to an installer that has gone is answered where it is made.
      stdin.on('error', () => {});
      const said: string[] = [];
      let closed = false;
      let wake: (() => void) | null = null;
      const heard = createInterface({ input: stdout });
      heard.on('line', (line) => {
        said.push(line);
        wake?.();
      });
      heard.on('close', () => {
        closed = true;
        wake?.();
      });
      async function* lines(): AsyncGenerator<string> {
        for (;;) {
          const line = said.shift();
          if (line !== undefined) {
            yield line;
          } else if (closed) {
            return;
          } else {
            await new Promise<void>((resume) => {
              wake = resume;
            });
            wake = null;
          }
        }
      }
      resolve({
        lines: lines(),
        say: (word) =>
          new Promise<void>((done, failed) => {
            stdin.write(`${word}\n`, (error) => (error ? failed(error) : done()));
          }),
      });
    });
  });
}

function writeMoveNote(note: string): void {
  fs.writeFileSync(note, `${JSON.stringify({ requestedAt: new Date().toISOString() }, null, 2)}\n`);
}

/**
 * The app's word once the installer is ready: the note, then the go.
 * False when it could not be given — the installer is told no, or was
 * gone already, and no note stays behind.
 */
async function giveGo(plan: PackageSwitchPlan, installer: MoveInstaller, seams: PackageSwitchSeams): Promise<boolean> {
  try {
    (seams.writeNote ?? writeMoveNote)(plan.note);
  } catch (error) {
    seams.log.warn(`the request note could not be written (${errorCode(error)}): the switch is called off`);
    await installer.say(NO_WORD).catch(() => undefined);
    return false;
  }
  try {
    await installer.say(GO_WORD);
    return true;
  } catch {
    seams.log.warn('the installer was gone before it could be told to go on');
    try {
      fs.rmSync(plan.note, { force: true });
    } catch {
      // The next classic start takes a left note away.
    }
    return false;
  }
}

async function hearInstaller(
  plan: PackageSwitchPlan,
  installer: MoveInstaller,
  seams: PackageSwitchSeams,
): Promise<PackageSwitchEnd> {
  for await (const line of installer.lines) {
    const said = line.trim();
    if (said === READY_WORD) {
      if (await giveGo(plan, installer, seams)) {
        seams.log.info('the installer has the go: quitting for the switch');
        seams.quit();
        return { outcome: 'handed-over' };
      }
      continue;
    }
    const stopped = new RegExp(`^${STOPPED_WORD} (\\d+)$`).exec(said);
    if (stopped) {
      seams.log.info(`the installer stopped the switch with ${stopped[1]}`);
      return { outcome: 'stopped', code: Number(stopped[1]) };
    }
  }
  seams.log.warn('the installer ended without a word');
  return { outcome: 'stopped', code: null };
}

/**
 * Copies the installer out and starts it for a move. Answers once it is
 * started; `ended` settles with how the app's part of the move ended.
 */
export async function startPackageSwitch(
  plan: PackageSwitchPlan,
  seams: PackageSwitchSeams,
): Promise<PackageSwitchStart> {
  let installer: MoveInstaller;
  try {
    const copy = (seams.copyInstaller ?? copyInstallerOut)(plan.installer, plan.copyRoot);
    installer = await (seams.start ?? startMoveInstaller)(copy, moveInstallerArguments(plan));
    seams.log.info(`the installer was started for a switch: ${copy}`);
  } catch (error) {
    const reason = errorCode(error);
    seams.log.warn(`the installer could not be started for a switch (${reason})`);
    return { started: false, reason };
  }
  return { started: true, ended: hearInstaller(plan, installer, seams) };
}
