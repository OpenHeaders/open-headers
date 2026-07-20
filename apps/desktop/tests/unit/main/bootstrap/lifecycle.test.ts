import { beforeEach, describe, expect, it, vi } from 'vitest';

type BeforeQuitListener = (event: { preventDefault: () => void }) => void;

const appListeners = new Map<string, BeforeQuitListener>();
const quitSpy = vi.fn();
const exitSpy = vi.fn();

interface FakeWindow {
  destroyed: boolean;
  isDestroyed: () => boolean;
  destroy: ReturnType<typeof vi.fn>;
}

const windows: FakeWindow[] = [];

function makeWindow(): FakeWindow {
  const win: FakeWindow = {
    destroyed: false,
    isDestroyed: () => win.destroyed,
    destroy: vi.fn(() => {
      win.destroyed = true;
    }),
  };
  windows.push(win);
  return win;
}

vi.mock('electron', () => ({
  app: {
    on: (event: string, listener: BeforeQuitListener) => {
      appListeners.set(event, listener);
    },
    quit: () => quitSpy(),
    exit: (code?: number) => exitSpy(code),
    getPath: () => '/tmp/open-headers-test',
  },
  BrowserWindow: {
    getAllWindows: () => [...windows],
  },
}));

import {
  installAppLifecycle,
  isQuitting,
  lifecyclePhase,
  registerTeardown,
  requestQuit,
  resetLifecycleForTests,
  trackEngineBoot,
} from '../../../../src/main/bootstrap/lifecycle';

/** Settle enough microtask/macrotask turns for the teardown chain. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('app lifecycle', () => {
  beforeEach(() => {
    appListeners.clear();
    quitSpy.mockClear();
    exitSpy.mockClear();
    windows.length = 0;
    resetLifecycleForTests();
    installAppLifecycle();
  });

  it('starts in booting, transitions to running when the engine boot settles', async () => {
    expect(lifecyclePhase()).toBe('booting');
    trackEngineBoot(Promise.resolve());
    await flush();
    expect(lifecyclePhase()).toBe('running');
    expect(isQuitting()).toBe(false);
  });

  it('destroys every window immediately on quit request, then exits via app.quit', async () => {
    const win = makeWindow();
    trackEngineBoot(Promise.resolve());
    await flush();
    requestQuit({ reason: 'tray-quit' });
    expect(win.destroy).toHaveBeenCalledTimes(1);
    expect(isQuitting()).toBe(true);
    await flush();
    expect(lifecyclePhase()).toBe('exiting');
    expect(quitSpy).toHaveBeenCalledTimes(1);
  });

  it('serializes a quit during booting: participants wait for the boot to settle', async () => {
    let settleBoot!: () => void;
    trackEngineBoot(
      new Promise<void>((resolve) => {
        settleBoot = resolve;
      }),
    );
    const engineDispose = vi.fn();
    requestQuit({ reason: 'external-quit' });
    // Boot registers its teardown mid-flight — the machine must still see it.
    registerTeardown('engine', 1_000, engineDispose);
    await flush();
    expect(engineDispose).not.toHaveBeenCalled();
    expect(quitSpy).not.toHaveBeenCalled();
    settleBoot();
    await flush();
    expect(engineDispose).toHaveBeenCalledTimes(1);
    expect(quitSpy).toHaveBeenCalledTimes(1);
  });

  it('absorbs a second quit request: one teardown, one finisher', async () => {
    const participant = vi.fn();
    registerTeardown('engine', 1_000, participant);
    trackEngineBoot(Promise.resolve());
    await flush();
    requestQuit({ reason: 'tray-quit' });
    requestQuit({ reason: 'tray-quit' });
    appListeners.get('before-quit')?.({ preventDefault: vi.fn() });
    await flush();
    expect(participant).toHaveBeenCalledTimes(1);
    expect(quitSpy).toHaveBeenCalledTimes(1);
  });

  it('external before-quit is cancelled and rerouted; the final quit passes through', async () => {
    trackEngineBoot(Promise.resolve());
    await flush();
    const first = { preventDefault: vi.fn() };
    appListeners.get('before-quit')?.(first);
    expect(first.preventDefault).toHaveBeenCalledTimes(1);
    await flush();
    expect(lifecyclePhase()).toBe('exiting');
    // The finisher's app.quit() re-enters before-quit — it must pass.
    const second = { preventDefault: vi.fn() };
    appListeners.get('before-quit')?.(second);
    expect(second.preventDefault).not.toHaveBeenCalled();
  });

  it('a participant missing its deadline is skipped past; the exit still happens', async () => {
    registerTeardown('hung', 20, () => new Promise<void>(() => {}));
    const healthy = vi.fn();
    registerTeardown('engine', 1_000, healthy);
    trackEngineBoot(Promise.resolve());
    await flush();
    requestQuit({ reason: 'tray-quit' });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(quitSpy).toHaveBeenCalledTimes(1);
  });

  it('a participant that throws does not block the exit', async () => {
    registerTeardown('broken', 1_000, () => {
      throw new Error('teardown exploded');
    });
    trackEngineBoot(Promise.resolve());
    await flush();
    requestQuit({ reason: 'tray-quit' });
    await flush();
    expect(quitSpy).toHaveBeenCalledTimes(1);
  });

  it('runs a custom finisher instead of app.quit (relaunch / install paths)', async () => {
    const finish = vi.fn();
    trackEngineBoot(Promise.resolve());
    await flush();
    requestQuit({ reason: 'update-install', finish });
    await flush();
    expect(finish).toHaveBeenCalledTimes(1);
    expect(quitSpy).not.toHaveBeenCalled();
  });

  it('a quit with no engine boot started skips the boot-settle wait', async () => {
    requestQuit({ reason: 'single-instance' });
    await flush();
    expect(lifecyclePhase()).toBe('exiting');
    expect(quitSpy).toHaveBeenCalledTimes(1);
  });
});
