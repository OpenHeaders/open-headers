import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachWindowSupervisor,
  CRASH_LOOP_WINDOW_MS,
  type WindowSupervisorDeps,
} from '@/main/bootstrap/window-supervisor';

vi.mock('@/main/bootstrap/locale', () => ({ mainTranslator: () => (key: string) => key }));
vi.mock('@/main/bootstrap/log-reveal', () => ({ revealLogFile: vi.fn() }));
vi.mock('@/main/bootstrap/relaunch', () => ({ relaunchApp: vi.fn() }));
vi.mock('@/main/bootstrap/hardware-acceleration', () => ({ disableHardwareAccelerationOnNextLaunch: vi.fn() }));
vi.mock('@/main/bootstrap/lifecycle', () => ({ requestQuit: vi.fn() }));

class FakeWebContents extends EventEmitter {
  reload = vi.fn();
  forcefullyCrashRenderer = vi.fn();
}

function makeWindow() {
  const webContents = new FakeWebContents();
  const win = { webContents, isDestroyed: () => false } as unknown as BrowserWindow;
  return { win, webContents };
}

function makeDeps(now: { value: number }, response = 0) {
  const deps: WindowSupervisorDeps = {
    now: () => now.value,
    showMessageBox: vi.fn(async () => ({ response, checkboxChecked: false })),
    revealLogs: vi.fn(),
    restartWithoutAcceleration: vi.fn(),
    quit: vi.fn(),
    translate: () => ((key: string) => key) as unknown as ReturnType<WindowSupervisorDeps['translate']>,
  };
  return deps;
}

const gone = (reason: string) => ({ reason, exitCode: 1 });

/** Let the async dialog chain settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('window-supervisor', () => {
  let now: { value: number };

  beforeEach(() => {
    now = { value: 1_000_000 };
  });

  it('reopens the window once on the first renderer death, with no dialog', () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now);
    attachWindowSupervisor(win, deps);
    webContents.emit('render-process-gone', {}, gone('crashed'));
    expect(webContents.reload).toHaveBeenCalledOnce();
    expect(deps.showMessageBox).not.toHaveBeenCalled();
  });

  it('a second death inside the crash-loop window asks the person instead of reloading again', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now);
    attachWindowSupervisor(win, deps);
    webContents.emit('render-process-gone', {}, gone('crashed'));
    now.value += CRASH_LOOP_WINDOW_MS - 1;
    webContents.emit('render-process-gone', {}, gone('oom'));
    await settle();
    expect(deps.showMessageBox).toHaveBeenCalledOnce();
    // Reopen (the default answer) reloads once more.
    expect(webContents.reload).toHaveBeenCalledTimes(2);
  });

  it('a death after the crash-loop window is a fresh first death', () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now);
    attachWindowSupervisor(win, deps);
    webContents.emit('render-process-gone', {}, gone('crashed'));
    now.value += CRASH_LOOP_WINDOW_MS + 1;
    webContents.emit('render-process-gone', {}, gone('crashed'));
    expect(webContents.reload).toHaveBeenCalledTimes(2);
    expect(deps.showMessageBox).not.toHaveBeenCalled();
  });

  it('a clean exit is not a failure', () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now);
    attachWindowSupervisor(win, deps);
    webContents.emit('render-process-gone', {}, gone('clean-exit'));
    expect(webContents.reload).not.toHaveBeenCalled();
  });

  it.each([
    [1, 'revealLogs'],
    [2, 'restartWithoutAcceleration'],
    [3, 'quit'],
  ] as const)('crash dialog answer %i routes to %s', async (response, dep) => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now, response);
    attachWindowSupervisor(win, deps);
    webContents.emit('render-process-gone', {}, gone('crashed'));
    webContents.emit('render-process-gone', {}, gone('crashed'));
    await settle();
    expect(deps[dep]).toHaveBeenCalledOnce();
    if (dep === 'quit') expect(deps.quit).toHaveBeenCalledWith('crash-dialog');
  });

  it('an unresponsive renderer shows the dialog once; Reopen terminates it and the death reloads once', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now, 1);
    attachWindowSupervisor(win, deps);
    webContents.emit('unresponsive');
    webContents.emit('unresponsive');
    await settle();
    expect(deps.showMessageBox).toHaveBeenCalledOnce();
    expect(webContents.forcefullyCrashRenderer).toHaveBeenCalledOnce();
    webContents.emit('render-process-gone', {}, gone('killed'));
    expect(webContents.reload).toHaveBeenCalledOnce();
    expect(deps.showMessageBox).toHaveBeenCalledOnce();
  });

  it('Quit on the unresponsive dialog routes to the lifecycle', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now, 2);
    attachWindowSupervisor(win, deps);
    webContents.emit('unresponsive');
    await settle();
    expect(deps.quit).toHaveBeenCalledWith('unresponsive-dialog');
    expect(webContents.forcefullyCrashRenderer).not.toHaveBeenCalled();
  });
});
