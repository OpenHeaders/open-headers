import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachWindowSupervisor,
  CRASH_LOOP_WINDOW_MS,
  CRASHED_DIALOG,
  UNRESPONSIVE_DIALOG,
  type WindowSupervisorDeps,
} from '@/main/bootstrap/window-supervisor';

const log = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));

vi.mock('@/main/bootstrap/logger', () => ({ createLogger: () => log }));
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

const shownOptions = (deps: WindowSupervisorDeps, call = 0) => vi.mocked(deps.showMessageBox).mock.calls[call][1];

describe('window-supervisor', () => {
  let now: { value: number };

  beforeEach(() => {
    now = { value: 1_000_000 };
    vi.clearAllMocks();
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

  it('the crash dialog gives Return to Reopen and Escape to Open Logs — distinct roles', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now);
    attachWindowSupervisor(win, deps);
    webContents.emit('render-process-gone', {}, gone('crashed'));
    webContents.emit('render-process-gone', {}, gone('crashed'));
    await settle();
    const options = shownOptions(deps);
    expect(options.defaultId).toBe(CRASHED_DIALOG.reopen);
    expect(options.cancelId).toBe(CRASHED_DIALOG.openLogs);
    expect(options.defaultId).not.toBe(options.cancelId);
    expect(options.buttons?.[CRASHED_DIALOG.reopen]).toBe('desktop.dialog.windowCrashed.reopen');
    expect(options.buttons?.[CRASHED_DIALOG.openLogs]).toBe('desktop.dialog.windowCrashed.openLogs');
  });

  it.each([
    [CRASHED_DIALOG.openLogs, 'revealLogs'],
    [CRASHED_DIALOG.restartWithoutAcceleration, 'restartWithoutAcceleration'],
    [CRASHED_DIALOG.quit, 'quit'],
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

  it('the hang dialog gives Return to Reopen and Escape to Keep Waiting — distinct roles', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now, UNRESPONSIVE_DIALOG.keepWaiting);
    attachWindowSupervisor(win, deps);
    webContents.emit('unresponsive');
    await settle();
    const options = shownOptions(deps);
    expect(options.defaultId).toBe(UNRESPONSIVE_DIALOG.reopen);
    expect(options.cancelId).toBe(UNRESPONSIVE_DIALOG.keepWaiting);
    expect(options.defaultId).not.toBe(options.cancelId);
    expect(options.buttons?.[UNRESPONSIVE_DIALOG.reopen]).toBe('desktop.dialog.windowUnresponsive.reopen');
    expect(options.buttons?.[UNRESPONSIVE_DIALOG.keepWaiting]).toBe('desktop.dialog.windowUnresponsive.keepWaiting');
    // Keep Waiting leaves the renderer alone.
    expect(webContents.forcefullyCrashRenderer).not.toHaveBeenCalled();
    expect(deps.quit).not.toHaveBeenCalled();
  });

  it('an unresponsive renderer shows the dialog once; Reopen terminates it and the death reloads once', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now, UNRESPONSIVE_DIALOG.reopen);
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

  it('a deliberate Reopen kill never seeds the crash-loop clock: a real death right after reopens silently', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now, UNRESPONSIVE_DIALOG.reopen);
    attachWindowSupervisor(win, deps);
    webContents.emit('unresponsive');
    await settle();
    webContents.emit('render-process-gone', {}, gone('killed'));
    expect(webContents.reload).toHaveBeenCalledOnce();
    expect(log.error).not.toHaveBeenCalled();
    now.value += 10_000;
    webContents.emit('render-process-gone', {}, gone('crashed'));
    expect(webContents.reload).toHaveBeenCalledTimes(2);
    // The hang dialog is the only dialog ever shown.
    expect(deps.showMessageBox).toHaveBeenCalledOnce();
  });

  it('the hang is logged once per dialog; re-reports while it is up are a debug line, never a second warning', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now, UNRESPONSIVE_DIALOG.keepWaiting);
    attachWindowSupervisor(win, deps);
    webContents.emit('unresponsive');
    now.value += 4_000;
    webContents.emit('unresponsive');
    webContents.emit('unresponsive');
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.warn).toHaveBeenCalledWith('renderer unresponsive (event loop blocked)');
    expect(log.debug).toHaveBeenCalledTimes(2);
    expect(log.debug).toHaveBeenCalledWith('renderer still unresponsive (+4s)');
    await settle();
    // After Keep Waiting the next report is a new episode: it asks again.
    webContents.emit('unresponsive');
    await settle();
    expect(deps.showMessageBox).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(2);
  });

  it('Quit on the unresponsive dialog routes to the lifecycle', async () => {
    const { win, webContents } = makeWindow();
    const deps = makeDeps(now, UNRESPONSIVE_DIALOG.quit);
    attachWindowSupervisor(win, deps);
    webContents.emit('unresponsive');
    await settle();
    expect(deps.quit).toHaveBeenCalledWith('unresponsive-dialog');
    expect(webContents.forcefullyCrashRenderer).not.toHaveBeenCalled();
  });
});
