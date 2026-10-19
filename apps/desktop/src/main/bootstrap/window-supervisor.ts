/**
 * Window supervisor — ring 0 of the containment design (the
 * crash-and-error-reports plan §3.3): the main process watching each
 * renderer the way VS Code's window service does.
 *
 *   - `render-process-gone` (crashed / killed / oom / launch-failed):
 *     logged with Electron's typed reason, then ONE automatic reopen
 *     (`reload`). A second death inside the crash-loop window is a
 *     loop, not a glitch: a native dialog offers Reopen, Open Logs,
 *     Restart Without Hardware Acceleration (the marker file the
 *     File-menu toggle writes) and Quit. The dialog is native because
 *     the renderer is the thing that died.
 *   - `unresponsive` (event loop blocked): the VS Code dialog — Keep
 *     Waiting / Reopen / Quit. Reopen terminates the renderer, whose
 *     `render-process-gone` then rides the ordinary reopen path.
 *     `responsive` is logged; a dialog already on screen stays (the
 *     OS owns it until the person answers).
 *
 * No timers, no silent retry loops: one reopen, then a person decides.
 */

import { app, type BrowserWindow, dialog } from 'electron';
import { disableHardwareAccelerationOnNextLaunch } from './hardware-acceleration';
import { requestQuit } from './lifecycle';
import { mainTranslator } from './locale';
import { revealLogFile } from './log-reveal';
import { createLogger } from './logger';
import { relaunchApp } from './relaunch';

const logger = createLogger('window-supervisor');

/** Two renderer deaths closer together than this are a crash loop. */
export const CRASH_LOOP_WINDOW_MS = 60_000;

export interface WindowSupervisorDeps {
  now(): number;
  showMessageBox: (win: BrowserWindow, options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;
  revealLogs(): void;
  restartWithoutAcceleration(): void;
  quit(reason: string): void;
  translate(): ReturnType<typeof mainTranslator>;
}

const defaultDeps: WindowSupervisorDeps = {
  now: () => Date.now(),
  showMessageBox: (win, options) => dialog.showMessageBox(win, options),
  revealLogs: revealLogFile,
  restartWithoutAcceleration: () => {
    if (disableHardwareAccelerationOnNextLaunch()) relaunchApp();
  },
  quit: (reason) => requestQuit({ reason }),
  translate: mainTranslator,
};

export function attachWindowSupervisor(win: BrowserWindow, deps: WindowSupervisorDeps = defaultDeps): void {
  const { webContents } = win;
  let lastGoneAt: number | null = null;
  let dialogOpen = false;

  const reopen = (): void => {
    if (win.isDestroyed()) return;
    webContents.reload();
  };

  const showCrashedDialog = async (): Promise<void> => {
    if (dialogOpen || win.isDestroyed()) return;
    dialogOpen = true;
    const t = deps.translate();
    try {
      const { response } = await deps.showMessageBox(win, {
        type: 'error',
        title: t('desktop.dialog.windowCrashed.title'),
        message: t('desktop.dialog.windowCrashed.message', { name: app.getName() }),
        detail: t('desktop.dialog.windowCrashed.detail'),
        buttons: [
          t('desktop.dialog.windowCrashed.reopen'),
          t('desktop.dialog.windowCrashed.openLogs'),
          t('desktop.dialog.windowCrashed.restartWithoutAcceleration'),
          t('desktop.dialog.windowCrashed.quit'),
        ],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response === 1) {
        deps.revealLogs();
        reopen();
      } else if (response === 2) {
        deps.restartWithoutAcceleration();
      } else if (response === 3) {
        deps.quit('crash-dialog');
      } else {
        reopen();
      }
    } finally {
      dialogOpen = false;
    }
  };

  const showUnresponsiveDialog = async (): Promise<void> => {
    if (dialogOpen || win.isDestroyed()) return;
    dialogOpen = true;
    const t = deps.translate();
    try {
      const { response } = await deps.showMessageBox(win, {
        type: 'warning',
        title: t('desktop.dialog.windowUnresponsive.title'),
        message: t('desktop.dialog.windowUnresponsive.message', { name: app.getName() }),
        detail: t('desktop.dialog.windowUnresponsive.detail'),
        buttons: [
          t('desktop.dialog.windowUnresponsive.keepWaiting'),
          t('desktop.dialog.windowUnresponsive.reopen'),
          t('desktop.dialog.windowUnresponsive.quit'),
        ],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response === 1 && !win.isDestroyed()) {
        // The kill surfaces as `render-process-gone` (reason `killed`)
        // and rides the ordinary one-reopen path below — a deliberate
        // reopen is never counted toward a crash loop.
        lastGoneAt = null;
        webContents.forcefullyCrashRenderer();
      } else if (response === 2) {
        deps.quit('unresponsive-dialog');
      }
    } finally {
      dialogOpen = false;
    }
  };

  webContents.on('render-process-gone', (_event, details) => {
    // `details.reason` distinguishes `crashed` / `killed` / `oom` /
    // `launch-failed` / `integrity-failure` — the triage key.
    logger.error('renderer process gone', details);
    // A clean exit is Chromium retiring the process on its own terms
    // (a navigation, an ordered shutdown), not a failure to contain.
    if (details.reason === 'clean-exit') return;
    const now = deps.now();
    const loop = lastGoneAt !== null && now - lastGoneAt < CRASH_LOOP_WINDOW_MS;
    lastGoneAt = now;
    if (loop) {
      logger.error('renderer died twice within the crash-loop window; asking the person');
      void showCrashedDialog();
      return;
    }
    logger.warn('reopening the window once');
    reopen();
  });
  webContents.on('unresponsive', () => {
    logger.warn('renderer unresponsive (event loop blocked)');
    void showUnresponsiveDialog();
  });
  webContents.on('responsive', () => {
    logger.info('renderer responsive again');
  });
}
