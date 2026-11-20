import os from 'node:os';
import type { ProcessReader } from '@openheaders/oracle-host-node/process-reader';
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
  beforeEach(() => {
    ipcHandlers.clear();
    ipcListeners.clear();
    teardowns.clear();
    wcOnceListeners.clear();
    spawnedPtys.length = 0;
    ptySpawn.mockClear();
    fakeWebContents = { id: 7 };
    fakeProcesses = [];
    installTerminalHost({ processReader: fakeReader });
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

  describe('whether a tab has work running — the close-confirm', () => {
    const TERMINAL = 16_777_221;

    /** A session whose shell sits on its own terminal, and the ask the close affordance makes. */
    async function openTab(others: (shellPid: number) => FakeProcess[] = () => []) {
      const sender = makeSender(7);
      const { id } = await spawnSession(sender);
      const shellPid = spawnedPtys[0].pid;
      fakeProcesses = [
        { pid: shellPid, parentPid: 4312, startedAt: SHELL_STARTED, terminal: TERMINAL },
        ...others(shellPid),
      ];
      const hasChildren = ipcHandlers.get('oh:terminal:has-children');
      if (!hasChildren) throw new Error('has-children handler not registered');
      return { id, ask: (from = sender) => hasChildren({ sender: from }, { id }) as Promise<boolean> };
    }

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

    it('never asks where the host has no process reader', async () => {
      ipcHandlers.clear();
      installTerminalHost({ processReader: null });
      const { ask } = await openTab((shellPid) => [
        { pid: 61_102, parentPid: shellPid, startedAt: SHELL_STARTED + 5_000, terminal: TERMINAL },
      ]);
      expect(await ask()).toBe(false);
    });
  });
});
