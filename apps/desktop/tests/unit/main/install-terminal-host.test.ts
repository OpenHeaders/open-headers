import os from 'node:os';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown, raw: unknown) => unknown;

const ipcHandlers = new Map<string, Handler>();
const ipcListeners = new Map<string, Handler>();
const appListeners = new Map<string, (event?: { preventDefault: () => void }) => void>();
const wcOnceListeners = new Map<number, Map<string, () => void>>();

let fakeWebContents: { id: number } | null = null;

vi.mock('electron', () => ({
  app: {
    on: (event: string, listener: (event?: { preventDefault: () => void }) => void) => {
      appListeners.set(event, listener);
    },
    quit: vi.fn(),
  },
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
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      emitData: (data) => dataListener?.(data),
      emitExit: (exitCode) => exitListener?.({ exitCode }),
    };
    spawned.push(fake);
    return {
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

describe('installTerminalHost', () => {
  beforeEach(() => {
    ipcHandlers.clear();
    ipcListeners.clear();
    appListeners.clear();
    wcOnceListeners.clear();
    spawnedPtys.length = 0;
    ptySpawn.mockClear();
    fakeWebContents = { id: 7 };
    installTerminalHost();
  });

  function spawnSession(sender: ReturnType<typeof makeSender>, raw: unknown = { cols: 100, rows: 30 }) {
    const handler = ipcHandlers.get('oh:terminal:spawn');
    if (!handler) throw new Error('spawn handler not registered');
    return handler({ sender }, raw) as { ok: boolean; id?: string };
  }

  it('spawns a pty and streams its output to the sender', () => {
    const sender = makeSender(7);
    const result = spawnSession(sender);
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

  it('clamps absurd spawn dimensions to sane bounds', () => {
    spawnSession(makeSender(7), { cols: -5, rows: 1e9 });
    const opts = ptySpawn.mock.calls[0][2] as { cols: number; rows: number };
    expect(opts.cols).toBe(2);
    expect(opts.rows).toBe(1000);
  });

  it('starts in the request cwd when the profile names none', () => {
    const dir = process.cwd();
    spawnSession(makeSender(7), { cols: 80, rows: 24, cwd: dir });
    const opts = ptySpawn.mock.calls[0][2] as { cwd: string };
    expect(opts.cwd).toBe(dir);
  });

  it('lets a profile cwd win over the request cwd', () => {
    const profileDir = os.tmpdir();
    spawnSession(makeSender(7), {
      cols: 80,
      rows: 24,
      profile: { shell: '/bin/zsh', args: [], cwd: profileDir },
      cwd: process.cwd(),
    });
    const opts = ptySpawn.mock.calls[0][2] as { cwd: string };
    expect(opts.cwd).toBe(profileDir);
  });

  it('falls back to home when the request cwd is not a directory', () => {
    spawnSession(makeSender(7), { cols: 80, rows: 24, cwd: '/openheaders-io-definitely-missing' });
    const opts = ptySpawn.mock.calls[0][2] as { cwd: string };
    expect(opts.cwd).toBe(os.homedir());
  });

  it('routes writes to the pty only from the owning sender', () => {
    const sender = makeSender(7);
    const { id } = spawnSession(sender);
    const write = ipcListeners.get('oh:terminal:write');
    if (!write) throw new Error('write listener not registered');

    write({ sender }, { id, data: 'ls\r' });
    expect(spawnedPtys[0].write).toHaveBeenCalledWith('ls\r');

    write({ sender: makeSender(8) }, { id, data: 'stolen' });
    expect(spawnedPtys[0].write).toHaveBeenCalledTimes(1);
  });

  it('notifies exit once and drops the session', () => {
    const sender = makeSender(7);
    const { id } = spawnSession(sender);
    spawnedPtys[0].emitExit(0);
    expect(sender.send).toHaveBeenCalledWith('oh:terminal:exit', { id, exitCode: 0 });

    const write = ipcListeners.get('oh:terminal:write');
    write?.({ sender }, { id, data: 'after-exit' });
    expect(spawnedPtys[0].write).not.toHaveBeenCalled();
  });

  it('kill disposes the pty; before-quit sweeps the rest', () => {
    const sender = makeSender(7);
    const first = spawnSession(sender);
    const second = spawnSession(sender);
    const kill = ipcListeners.get('oh:terminal:kill');
    kill?.({ sender }, { id: first.id });
    expect(spawnedPtys[0].kill).toHaveBeenCalledTimes(1);

    // A live session holds the quit while the pty drain runs — the
    // handler prevents the default and requits once the exits land.
    const quitEvent = { preventDefault: vi.fn() };
    appListeners.get('before-quit')?.(quitEvent);
    expect(quitEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(spawnedPtys[1].kill).toHaveBeenCalledTimes(1);
    expect(second.ok).toBe(true);
    spawnedPtys[1].emitExit(0);
  });

  it('kills a renderer’s sessions when its webContents is destroyed', () => {
    const sender = makeSender(7);
    spawnSession(sender);
    wcOnceListeners.get(7)?.get('destroyed')?.();
    expect(spawnedPtys[0].kill).toHaveBeenCalledTimes(1);
  });
});
