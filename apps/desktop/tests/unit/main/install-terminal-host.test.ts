import os from 'node:os';
import {
  createProcessRootRegistry,
  type HeldProcessRoot,
  type ProcessReader,
  type ProcessRootRegistry,
} from '@openheaders/oracle-host-node/process-reader';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, raw: unknown) => unknown;

const ipcHandlers = new Map<string, Handler>();
const ipcListeners = new Map<string, Handler>();
const teardowns = new Map<string, () => void | Promise<void>>();
const wcOnceListeners = new Map<number, Map<string, () => void>>();

let fakeWebContents: { id: number } | null = null;

vi.mock('../../../src/main/bootstrap/lifecycle', () => ({
  registerTeardown: (name: string, _deadlineMs: number, run: () => void | Promise<void>) => {
    teardowns.set(name, run);
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      ipcHandlers.set(channel, handler);
    },
    on: (channel: string, handler: Handler) => {
      ipcListeners.set(channel, handler);
    },
  },
  webContents: {
    fromId: (id: number) => {
      if (!fakeWebContents || fakeWebContents.id !== id) return undefined;
      const listeners = wcOnceListeners.get(id) ?? new Map<string, () => void>();
      wcOnceListeners.set(id, listeners);
      return {
        once: (event: string, listener: () => void) => {
          listeners.set(event, listener);
        },
      };
    },
  },
}));

const { spawnedPtys, ptySpawn } = vi.hoisted(() => {
  interface HoistedFakePty {
    pid: number;
    write: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    emitData: (data: string) => void;
    emitExit: (exitCode: number) => void;
  }
  const spawned: HoistedFakePty[] = [];
  const spawn = vi.fn((_file: string, _args: string[], _opts: unknown) => {
    let dataListener: ((data: string) => void) | null = null;
    let exitListener: ((e: { exitCode: number }) => void) | null = null;
    const fake: HoistedFakePty = {
      pid: 61_044 + spawned.length,
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      emitData: (data) => dataListener?.(data),
      emitExit: (exitCode) => exitListener?.({ exitCode }),
    };
    spawned.push(fake);
    return {
      pid: fake.pid,
      write: fake.write,
      resize: fake.resize,
      kill: fake.kill,
      onData: (listener: (data: string) => void) => {
        dataListener = listener;
      },
      onExit: (listener: (e: { exitCode: number }) => void) => {
        exitListener = listener;
      },
    };
  });
  return { spawnedPtys: spawned, ptySpawn: spawn };
});

vi.mock('node-pty', () => ({ spawn: ptySpawn }));

import { installTerminalHost } from '../../../src/main/install-terminal-host';

function makeSender(id: number) {
  return { id, isDestroyed: () => false, send: vi.fn() };
}

/** One process of the fake system: who started it, when, and which terminal it sits on. */
interface FakeProcess {
  pid: number;
  parentPid: number;
  startedAt: number;
  terminal: number | null;
}

const SHELL_STARTED = 1_763_625_600_000;
let fakeProcesses: FakeProcess[] = [];

const fakeReader: ProcessReader = {
  memoryKind: 'footprint',
  read: (pid) => {
    const found = fakeProcesses.find((entry) => entry.pid === pid);
    return found ? { pid, parentPid: found.parentPid, startedAt: found.startedAt, name: null, cost: null } : null;
  },
  childPids: (pid) => fakeProcesses.filter((entry) => entry.parentPid === pid).map((entry) => entry.pid),
  terminalPids: (pid) => {
    const terminal = fakeProcesses.find((entry) => entry.pid === pid)?.terminal ?? null;
    return terminal === null
      ? []
      : fakeProcesses.filter((entry) => entry.terminal === terminal).map((entry) => entry.pid);
  },
};

describe('installTerminalHost', () => {
  let processRoots: ProcessRootRegistry;

  beforeEach(() => {
    ipcHandlers.clear();
    ipcListeners.clear();
    teardowns.clear();
    wcOnceListeners.clear();
    spawnedPtys.length = 0;
    ptySpawn.mockClear();
    fakeWebContents = { id: 7 };
    fakeProcesses = [];
    processRoots = createProcessRootRegistry(fakeReader);
    installTerminalHost({ processReader: fakeReader, processRoots });
  });

  function spawnSession(sender: ReturnType<typeof makeSender>, raw: unknown = { cols: 100, rows: 30 }) {
    const handler = ipcHandlers.get('oh:terminal:spawn');
    if (!handler) throw new Error('spawn handler not registered');
    return handler({ sender }, raw) as Promise<{ ok: boolean; id?: string }>;
  }

  it('spawns a pty and streams its output to the sender', async () => {
    const sender = makeSender(7);
    const result = await spawnSession(sender);
    expect(result.ok).toBe(true);
    expect(ptySpawn).toHaveBeenCalledTimes(1);
    const opts = ptySpawn.mock.calls[0][2] as { cols: number; rows: number };
    expect(opts.cols).toBe(100);
    expect(opts.rows).toBe(30);

    spawnedPtys[0].emitData('hello from openheaders.io');
    expect(sender.send).toHaveBeenCalledWith('oh:terminal:data', {
      id: result.id,
      data: 'hello from openheaders.io',
    });
  });

  it('clamps absurd spawn dimensions to sane bounds', async () => {
    await spawnSession(makeSender(7), { cols: -5, rows: 1e9 });
    const opts = ptySpawn.mock.calls[0][2] as { cols: number; rows: number };
    expect(opts.cols).toBe(2);
    expect(opts.rows).toBe(1000);
  });

  it('starts in the request cwd when the profile names none', async () => {
    const dir = process.cwd();
    await spawnSession(makeSender(7), { cols: 80, rows: 24, cwd: dir });
    const opts = ptySpawn.mock.calls[0][2] as { cwd: string };
    expect(opts.cwd).toBe(dir);
  });

  it('lets a profile cwd win over the request cwd', async () => {
    const profileDir = os.tmpdir();
    await spawnSession(makeSender(7), {
      cols: 80,
      rows: 24,
      profile: { shell: '/bin/zsh', args: [], cwd: profileDir },
      cwd: process.cwd(),
    });
    const opts = ptySpawn.mock.calls[0][2] as { cwd: string };
    expect(opts.cwd).toBe(profileDir);
  });

  it('falls back to home when the request cwd is not a directory', async () => {
    await spawnSession(makeSender(7), { cols: 80, rows: 24, cwd: '/openheaders-io-definitely-missing' });
    const opts = ptySpawn.mock.calls[0][2] as { cwd: string };
    expect(opts.cwd).toBe(os.homedir());
  });

  it('routes writes to the pty only from the owning sender', async () => {
    const sender = makeSender(7);
    const { id } = await spawnSession(sender);
    const write = ipcListeners.get('oh:terminal:write');
    if (!write) throw new Error('write listener not registered');

    write({ sender }, { id, data: 'ls\r' });
    expect(spawnedPtys[0].write).toHaveBeenCalledWith('ls\r');

    write({ sender: makeSender(8) }, { id, data: 'stolen' });
    expect(spawnedPtys[0].write).toHaveBeenCalledTimes(1);
  });

  it('notifies exit once and drops the session', async () => {
    const sender = makeSender(7);
    const { id } = await spawnSession(sender);
    spawnedPtys[0].emitExit(0);
    expect(sender.send).toHaveBeenCalledWith('oh:terminal:exit', { id, exitCode: 0 });

    const write = ipcListeners.get('oh:terminal:write');
    write?.({ sender }, { id, data: 'after-exit' });
    expect(spawnedPtys[0].write).not.toHaveBeenCalled();
  });

  it('kill disposes the pty; the quit teardown sweeps the rest and drains exits', async () => {
    const sender = makeSender(7);
    const first = await spawnSession(sender);
    const second = await spawnSession(sender);
    expect(second.ok).toBe(true);
    const kill = ipcListeners.get('oh:terminal:kill');
    kill?.({ sender }, { id: first.id });
    expect(spawnedPtys[0].kill).toHaveBeenCalledTimes(1);

    // The lifecycle participant kills what's left and holds the drain
    // open until every pty's exit callback has landed — including the
    // one killed above whose exit is still pending.
    const drain = teardowns.get('pty-drain');
    expect(drain).toBeDefined();
    const drained = vi.fn();
    void Promise.resolve(drain?.()).then(drained);
    await Promise.resolve();
    await Promise.resolve();
    expect(spawnedPtys[1].kill).toHaveBeenCalledTimes(1);
    expect(drained).not.toHaveBeenCalled();

    spawnedPtys[0].emitExit(0);
    spawnedPtys[1].emitExit(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(drained).toHaveBeenCalledTimes(1);
  });

  it('kills a renderer’s sessions when its webContents is destroyed', async () => {
    const sender = makeSender(7);
    await spawnSession(sender);
    wcOnceListeners.get(7)?.get('destroyed')?.();
    expect(spawnedPtys[0].kill).toHaveBeenCalledTimes(1);
  });

  const TERMINAL = 16_777_221;
  /** The pid the fake pty hands the first session of a test. */
  const FIRST_SHELL_PID = 61_044;

  /** The first session's shell, on its own terminal, as the system holds it from the instant it is spawned. */
  function seedShell(others: FakeProcess[] = []): void {
    fakeProcesses = [
      { pid: FIRST_SHELL_PID, parentPid: 4312, startedAt: SHELL_STARTED, terminal: TERMINAL },
      ...others,
    ];
  }

  describe('a session’s shell in the registry of roots', () => {
    it('registers the shell where it is spawned: the session as its owner, a terminal’s shell, its start read then', async () => {
      seedShell();
      const { id } = await spawnSession(makeSender(7));
      expect(processRoots.list()).toEqual([
        {
          owner: { kind: 'terminal', id },
          root: { pid: FIRST_SHELL_PID, startedAt: SHELL_STARTED },
          terminal: true,
        },
      ]);
    });

    it('lets go of the shell when it exits', async () => {
      seedShell();
      await spawnSession(makeSender(7));
      spawnedPtys[0].emitExit(0);
      expect(processRoots.list()).toEqual([]);
    });

    it('keeps a killed session’s shell until its exit lands', async () => {
      seedShell();
      const sender = makeSender(7);
      const { id } = await spawnSession(sender);
      ipcListeners.get('oh:terminal:kill')?.({ sender }, { id });
      expect(processRoots.list()).toHaveLength(1);
      spawnedPtys[0].emitExit(0);
      expect(processRoots.list()).toEqual([]);
    });
  });

  describe('whether a tab has work running — the close-confirm', () => {
    /** A session whose shell sits on its own terminal, and the ask the close affordance makes. */
    async function openTab(others: (shellPid: number) => FakeProcess[] = () => []) {
      const sender = makeSender(7);
      seedShell(others(FIRST_SHELL_PID));
      const { id } = await spawnSession(sender);
      const hasChildren = ipcHandlers.get('oh:terminal:has-children');
      if (!hasChildren) throw new Error('has-children handler not registered');
      return { id, ask: (from = sender) => hasChildren({ sender: from }, { id }) as Promise<boolean> };
    }

    it('walks from the shell as it was registered: a pid that came to name another process has no work', async () => {
      const { ask } = await openTab((shellPid) => [
        { pid: 61_102, parentPid: shellPid, startedAt: SHELL_STARTED + 5_000, terminal: TERMINAL },
      ]);
      expect(await ask()).toBe(true);
      // The shell died unheard and its number went to a process started later, with a child of its own.
      fakeProcesses = [
        { pid: FIRST_SHELL_PID, parentPid: 1, startedAt: SHELL_STARTED + 60_000, terminal: TERMINAL },
        { pid: 61_102, parentPid: FIRST_SHELL_PID, startedAt: SHELL_STARTED + 61_000, terminal: TERMINAL },
      ];
      expect(await ask()).toBe(false);
    });

    it('answers no for a shell alone on its terminal', async () => {
      const { ask } = await openTab();
      expect(await ask()).toBe(false);
    });

    it('answers yes while the shell has a child', async () => {
      const { ask } = await openTab((shellPid) => [
        { pid: 61_102, parentPid: shellPid, startedAt: SHELL_STARTED + 5_000, terminal: TERMINAL },
      ]);
      expect(await ask()).toBe(true);
    });

    it('answers yes for a process that detached from the shell and still shares the tab’s terminal', async () => {
      const { ask } = await openTab(() => [
        { pid: 61_102, parentPid: 1, startedAt: SHELL_STARTED + 5_000, terminal: TERMINAL },
      ]);
      expect(await ask()).toBe(true);
    });

    it('answers no for what runs on another terminal and is no child of this shell', async () => {
      const { ask } = await openTab(() => [
        { pid: 61_102, parentPid: 1, startedAt: SHELL_STARTED + 5_000, terminal: TERMINAL + 1 },
        // An older process holding a pid on this terminal is not this tab's work.
        { pid: 812, parentPid: 1, startedAt: SHELL_STARTED - 60_000, terminal: TERMINAL },
      ]);
      expect(await ask()).toBe(false);
    });

    it('answers no to another renderer’s ask, and once the shell has exited', async () => {
      const { ask } = await openTab((shellPid) => [
        { pid: 61_102, parentPid: shellPid, startedAt: SHELL_STARTED + 5_000, terminal: TERMINAL },
      ]);
      expect(await ask(makeSender(8))).toBe(false);
      spawnedPtys[0].emitExit(0);
      expect(await ask()).toBe(false);
    });

    describe('on a reader that holds roots — Windows', () => {
      const CONSOLE_HOST = 11_924;
      let memberPids: number[] = [];
      let released = 0;
      // Nothing is walked there: what runs in the tab is what the system lists in what is held.
      const holdingReader: ProcessReader = {
        ...fakeReader,
        childPids: () => [],
        terminalPids: () => [],
        holdRoot: (root): HeldProcessRoot => ({
          ownPids: [root.pid, CONSOLE_HOST],
          memberPids: () => memberPids,
          cpuSeconds: () => null,
          release: () => {
            released += 1;
          },
        }),
      };

      beforeEach(() => {
        released = 0;
        ipcHandlers.clear();
        installTerminalHost({ processReader: holdingReader, processRoots: createProcessRootRegistry(holdingReader) });
      });

      const consoleHost: FakeProcess = {
        pid: CONSOLE_HOST,
        parentPid: 4312,
        startedAt: SHELL_STARTED - 40,
        terminal: null,
      };

      it('answers no for a shell and its console host alone', async () => {
        memberPids = [FIRST_SHELL_PID, CONSOLE_HOST];
        const { ask } = await openTab(() => [consoleHost]);
        expect(await ask()).toBe(false);
      });

      it('answers yes while the system lists anything else in the tab — a process whose starter is gone too', async () => {
        memberPids = [FIRST_SHELL_PID, CONSOLE_HOST, 7780];
        const { ask } = await openTab(() => [
          consoleHost,
          { pid: 7780, parentPid: 9999, startedAt: SHELL_STARTED + 5_000, terminal: null },
        ]);
        expect(await ask()).toBe(true);
      });

      it('answers yes for a process the system lists and will not let be read', async () => {
        memberPids = [FIRST_SHELL_PID, CONSOLE_HOST, 9120];
        const { ask } = await openTab(() => [consoleHost]);
        expect(await ask()).toBe(true);
      });

      it('lets go of what is held when the shell exits', async () => {
        memberPids = [FIRST_SHELL_PID, CONSOLE_HOST];
        await openTab(() => [consoleHost]);
        expect(released).toBe(0);
        spawnedPtys[0].emitExit(0);
        expect(released).toBe(1);
      });
    });

    it('never asks where the host has no process reader', async () => {
      ipcHandlers.clear();
      installTerminalHost({ processReader: null, processRoots: createProcessRootRegistry() });
      const { ask } = await openTab((shellPid) => [
        { pid: 61_102, parentPid: shellPid, startedAt: SHELL_STARTED + 5_000, terminal: TERMINAL },
      ]);
      expect(await ask()).toBe(false);
    });
  });
});
