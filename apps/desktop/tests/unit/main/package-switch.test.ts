/**
 * The app's part of a switch to the Windows package: what the installer
 * is started with, where its copy lies, and what the app does with each
 * thing heard on the pipe — against a scripted installer, and once
 * against a real program on a real pipe. The words and the switches are
 * held to the installer's own source.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOVE_REQUEST_FILE_NAME } from '@/main/bootstrap/data-folder-move';
import { CLASSIC_UNINSTALLER_FILE_NAME } from '@/main/bootstrap/install-kind';
import {
  GO_WORD,
  type MoveInstaller,
  moveInstallerArguments,
  type PackageSwitchEnd,
  type PackageSwitchPlan,
  type PackageSwitchSeams,
  packageSwitchPlan,
  READY_WORD,
  STOPPED_WORD,
  SWITCH_COPY_DIR_NAME,
  startMoveInstaller,
  startPackageSwitch,
} from '@/main/package-switch';

const REPO_DIR = path.resolve(__dirname, '../../../../..');
const INSTALLER_SRC = path.join(REPO_DIR, 'native/windows-installer/src');
const CLASSIC_MOVE = readFileSync(path.join(INSTALLER_SRC, 'classic_move.rs'), 'utf8');
const INSTALLER_ARGS = readFileSync(path.join(INSTALLER_SRC, 'args.rs'), 'utf8');
const INSTALLER_ON_WINDOWS = readFileSync(path.join(INSTALLER_SRC, 'win/mod.rs'), 'utf8');

let workDir = '';

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-package-switch-'));
  mkdirSync(path.join(workDir, 'data'));
  mkdirSync(path.join(workDir, 'tree', 'resources', 'installer'), { recursive: true });
  writeFileSync(path.join(workDir, 'tree', 'resources', 'installer', 'OpenHeaders-Installer-x64.exe'), 'the program');
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function makePlan(overrides: Partial<PackageSwitchPlan> = {}): PackageSwitchPlan {
  return {
    ...packageSwitchPlan({
      installer: path.join(workDir, 'tree', 'resources', 'installer', 'OpenHeaders-Installer-x64.exe'),
      tempDir: path.join(workDir, 'temp'),
      executablePath: path.join(workDir, 'tree', 'OpenHeaders.exe'),
      pid: 4242,
      classicDir: path.join(workDir, 'data'),
      channel: 'beta',
    }),
    ...overrides,
  };
}

/** An installer that says its lines and then closes the pipe. */
function scriptedInstaller(lines: readonly string[], options: { goes?: boolean } = {}) {
  const said: string[] = [];
  const installer: MoveInstaller = {
    lines: (async function* () {
      yield* lines;
    })(),
    say: async (word) => {
      if (options.goes === false) throw new Error('write EPIPE');
      said.push(word);
    },
  };
  return { installer, said };
}

interface RunOptions {
  plan?: PackageSwitchPlan;
  seams?: Partial<PackageSwitchSeams>;
}

async function run(installer: MoveInstaller, options: RunOptions = {}) {
  const order: string[] = [];
  const logged = { info: [] as string[], warn: [] as string[] };
  const started: Array<{ file: string; args: readonly string[] }> = [];
  const plan = options.plan ?? makePlan();
  const start = await startPackageSwitch(plan, {
    quit: () => order.push('quit'),
    log: { info: (message) => logged.info.push(message), warn: (message) => logged.warn.push(message) },
    copyInstaller: () => path.join(workDir, 'copy.exe'),
    start: async (file, args) => {
      started.push({ file, args });
      const say = installer.say;
      return {
        lines: installer.lines,
        say: async (word) => {
          await say(word);
          order.push(`say ${word}`);
        },
      };
    },
    writeNote: (note) => {
      writeFileSync(note, '{}\n');
      order.push('note');
    },
    ...options.seams,
  });
  const ended: PackageSwitchEnd | null = start.started ? await start.ended : null;
  return { start, ended, order, logged, started, plan };
}

describe('what the installer is started with', () => {
  it('names this install by its own files, and the note in its data folder', () => {
    expect(makePlan()).toEqual({
      installer: path.join(workDir, 'tree', 'resources', 'installer', 'OpenHeaders-Installer-x64.exe'),
      copyRoot: path.join(workDir, 'temp', SWITCH_COPY_DIR_NAME),
      app: path.join(workDir, 'tree', 'OpenHeaders.exe'),
      appPid: 4242,
      uninstaller: path.join(workDir, 'tree', CLASSIC_UNINSTALLER_FILE_NAME),
      note: path.join(workDir, 'data', MOVE_REQUEST_FILE_NAME),
      channel: 'beta',
    });
  });

  it('hands over the four switches of a move, and the channel its rule read', () => {
    const plan = makePlan({ channel: 'stable' });

    expect(moveInstallerArguments(plan)).toEqual([
      '--channel',
      'stable',
      '--move-app',
      plan.app,
      '--move-app-pid',
      '4242',
      '--move-uninstaller',
      plan.uninstaller,
      '--move-note',
      plan.note,
    ]);
  });

  it('uses only switches the installer reads', () => {
    const switches = moveInstallerArguments(makePlan()).filter((word) => word.startsWith('--'));

    expect(switches).toHaveLength(5);
    for (const name of switches) expect(INSTALLER_ARGS).toContain(`"${name}" =>`);
  });

  it("speaks the installer's own words", () => {
    expect(CLASSIC_MOVE).toContain(`pub const READY_WORD: &str = "${READY_WORD}";`);
    expect(CLASSIC_MOVE).toContain(`pub const GO_WORD: &str = "${GO_WORD}";`);
    expect(CLASSIC_MOVE).toContain(`pub const STOPPED_WORD: &str = "${STOPPED_WORD}";`);
  });

  it('keeps its copy out of the folder the installer empties at its end', () => {
    const installersOwn = /const DOWNLOAD_DIR_NAME: &str = "([^"]+)";/.exec(INSTALLER_ON_WINDOWS)?.[1];

    expect(installersOwn).toBeDefined();
    expect(SWITCH_COPY_DIR_NAME).not.toBe(installersOwn);
  });
});

describe("the app's part of a switch", () => {
  it('starts the copy with the plan, and answers that it started', async () => {
    const { start, started, plan } = await run(scriptedInstaller([]).installer);

    expect(start.started).toBe(true);
    expect(started).toEqual([{ file: path.join(workDir, 'copy.exe'), args: moveInstallerArguments(plan) }]);
  });

  it('on ready writes its note, then gives the go, then quits — in that order', async () => {
    const { installer, said } = scriptedInstaller([READY_WORD]);

    const { ended, order, plan } = await run(installer);

    expect(ended).toEqual({ outcome: 'handed-over' });
    expect(order).toEqual(['note', `say ${GO_WORD}`, 'quit']);
    expect(said).toEqual([GO_WORD]);
    expect(existsSync(plan.note)).toBe(true);
  });

  it('hears a word that ends in a carriage return', async () => {
    const { ended } = await run(scriptedInstaller([`${READY_WORD}\r`]).installer);

    expect(ended).toEqual({ outcome: 'handed-over' });
  });

  it.each([1, 10, 21, 30, 32, 33, 35, 40])(
    'says a move that stopped with %d, with nothing written and no quit',
    async (code) => {
      const { ended, order, plan } = await run(scriptedInstaller([`${STOPPED_WORD} ${code}`]).installer);

      expect(ended).toEqual({ outcome: 'stopped', code });
      expect(order).toEqual([]);
      expect(existsSync(plan.note)).toBe(false);
    },
  );

  it('says an installer that ended without a word', async () => {
    const { ended, order, logged } = await run(scriptedInstaller([]).installer);

    expect(ended).toEqual({ outcome: 'stopped', code: null });
    expect(order).toEqual([]);
    expect(logged.warn).toEqual(['the installer ended without a word']);
  });

  it('passes by a line that is none of the words', async () => {
    const { ended } = await run(scriptedInstaller(['', 'stopped', 'stopped soon', `${STOPPED_WORD} 21`]).installer);

    expect(ended).toEqual({ outcome: 'stopped', code: 21 });
  });

  it('calls the move off when its note cannot be written: no go, no quit, and the stop that follows is said', async () => {
    const { installer, said } = scriptedInstaller([READY_WORD, `${STOPPED_WORD} 33`]);

    const { ended, order, logged } = await run(installer, {
      seams: {
        writeNote: () => {
          throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
        },
      },
    });

    expect(ended).toEqual({ outcome: 'stopped', code: 33 });
    expect(said).toEqual(['no']);
    expect(order).not.toContain('quit');
    expect(logged.warn[0]).toContain('EACCES');
  });

  it('leaves no note and does not quit when the installer is gone before the go', async () => {
    const { installer } = scriptedInstaller([READY_WORD], { goes: false });

    const { ended, order, plan } = await run(installer);

    expect(ended).toEqual({ outcome: 'stopped', code: null });
    expect(order).toEqual(['note']);
    expect(existsSync(plan.note)).toBe(false);
  });

  it.each<[string, Partial<PackageSwitchSeams>]>([
    [
      'the copy cannot be made',
      {
        copyInstaller: () => {
          throw Object.assign(new Error('ENOSPC: no space left'), { code: 'ENOSPC' });
        },
      },
    ],
    [
      'Windows refuses the start',
      {
        start: async () => {
          throw Object.assign(new Error('spawn EACCES'), { code: 'EACCES' });
        },
      },
    ],
  ])('answers that nothing started when %s, with the code', async (_name, seams) => {
    const { start, order, logged } = await run(scriptedInstaller([READY_WORD]).installer, { seams });

    expect(start.started).toBe(false);
    expect(start).toMatchObject({ reason: expect.stringMatching(/^(ENOSPC|EACCES)$/) });
    expect(order).toEqual([]);
    expect(logged.warn).toHaveLength(1);
  });
});

describe('the copy of the installer', () => {
  /** Runs a start whose installer says nothing, with the real copy, and returns where the copy went. */
  async function copyOnce(plan: PackageSwitchPlan): Promise<string> {
    const { started } = await run(scriptedInstaller([]).installer, { plan, seams: { copyInstaller: undefined } });
    return started[0]?.file ?? '';
  }

  it('lies in a folder of its own under the root, under the name it is published by', async () => {
    const plan = makePlan();

    const copy = await copyOnce(plan);

    expect(path.basename(copy)).toBe('OpenHeaders-Installer-x64.exe');
    expect(path.dirname(path.dirname(copy))).toBe(plan.copyRoot);
    expect(readFileSync(copy, 'utf8')).toBe('the program');
  });

  it('takes the copies of earlier starts away', async () => {
    const plan = makePlan();

    const first = await copyOnce(plan);
    const second = await copyOnce(plan);

    expect(existsSync(first)).toBe(false);
    expect(readdirSync(plan.copyRoot)).toEqual([path.basename(path.dirname(second))]);
  });
});

describe('a real program on the pipe', () => {
  /** Stands in for the installer: says ready, keeps the first line it is answered with, and ends. */
  const STAND_IN = `
const { heard } = JSON.parse(process.argv[1]);
const lines = require('node:readline').createInterface({ input: process.stdin });
lines.once('line', (line) => {
  require('node:fs').writeFileSync(heard, JSON.stringify({ line, args: process.argv.slice(2) }));
  process.exit(0);
});
process.stdout.write('ready\\n');
`;

  async function untilThere(file: string): Promise<void> {
    for (let attempt = 0; attempt < 100 && !existsSync(file); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  it('hears ready and answers go on the program own standard handles', async () => {
    const heard = path.join(workDir, 'heard.json');

    const { ended, order, plan } = await run(scriptedInstaller([]).installer, {
      seams: {
        start: (_file, args) =>
          startMoveInstaller(process.execPath, ['-e', STAND_IN, JSON.stringify({ heard }), ...args]),
      },
    });
    await untilThere(heard);

    expect(ended).toEqual({ outcome: 'handed-over' });
    expect(order).toEqual(['note', 'quit']);
    expect(JSON.parse(readFileSync(heard, 'utf8'))).toEqual({ line: GO_WORD, args: moveInstallerArguments(plan) });
  });

  it('says a program that ends without a word', async () => {
    const { ended } = await run(scriptedInstaller([]).installer, {
      seams: { start: () => startMoveInstaller(process.execPath, ['-e', 'process.exit(2)']) },
    });

    expect(ended).toEqual({ outcome: 'stopped', code: null });
  });

  it('answers that nothing started for a program that is not there', async () => {
    const { start } = await run(scriptedInstaller([]).installer, {
      seams: { start: () => startMoveInstaller(path.join(workDir, 'no-such-program'), []) },
    });

    expect(start).toEqual({ started: false, reason: 'ENOENT' });
  });
});
