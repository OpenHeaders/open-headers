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
 *   - `unresponsive` (event loop blocked): the VS Code dialog — Reopen /
 *     Quit / Keep Waiting. Reopen terminates the renderer on purpose:
 *     the supervisor records the expected death before the kill and the
 *     `render-process-gone` it raises consumes that record — a
 *     deliberate kill reopens once and never stamps the crash-loop
 *     clock. Chromium re-reports the hang on every further input while
 *     the dialog is up; those re-reports are one debug line each, not a
 *     second dialog and not a second warning.
 *   - `responsive` is logged; a dialog already on screen stays (the OS
 *     owns it until the person answers).
 *
 * Button roles: the default (Return) and the cancel (Escape) are
 * distinct indices on every dialog — a shared index loses the default
 * role on macOS. Crash: Return = Reopen, Escape = Open Logs (reveals the
 * log and reopens; never quits a tray app by reflex). Hang: Return =
 * Reopen, Escape = Keep Waiting. macOS never renders `title`; the bold
 * line is `message`.
 *
 * No timers, no silent retry loops: one reopen, then a person decides.
 */

import type { ErrorReportInput } from '@openheaders/core/telemetry';
import { app, type BrowserWindow, dialog } from 'electron';
import { recordErrorReport } from './error-report-sink';
import { disableHardwareAccelerationOnNextLaunch } from './hardware-acceleration';
import { requestQuit } from './lifecycle';
import { mainTranslator } from './locale';
import { revealLogFile } from './log-reveal';
import { createLogger } from './logger';
import { relaunchApp } from './relaunch';

const logger = createLogger('window-supervisor');

/** Two renderer deaths closer together than this are a crash loop. */
export const CRASH_LOOP_WINDOW_MS = 60_000;

/** The crash dialog's buttons, by index. */
export const CRASHED_DIALOG = { reopen: 0, openLogs: 1, restartWithoutAcceleration: 2, quit: 3 } as const;
/** The hang dialog's buttons, by index. */
export const UNRESPONSIVE_DIALOG = { reopen: 0, quit: 1, keepWaiting: 2 } as const;

export interface WindowSupervisorDeps {
  now(): number;
  showMessageBox: (win: BrowserWindow, options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;
  revealLogs(): void;
  restartWithoutAcceleration(): void;
  quit(reason: string): void;
  translate(): ReturnType<typeof mainTranslator>;
  /** The report channel's sink (the error reports plan §3.3): a renderer gone by itself, a hang — never a deliberate kill. */
  report(input: ErrorReportInput): void;
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
  report: recordErrorReport,
};

export function attachWindowSupervisor(win: BrowserWindow, deps: WindowSupervisorDeps = defaultDeps): void {
  const { webContents } = win;
  let lastGoneAt: number | null = null;
  /** Set while a dialog is on screen — the moment it opened. */
  let dialogOpenedAt: number | null = null;
  /** Set right before a deliberate kill; the death it raises consumes it. */
  let expectedDeath = false;
  /** Automatic reopens so far — the report's `reopenCount`, so a loop reads as one. */
  let reopenCount = 0;

  const reopen = (): void => {
    if (win.isDestroyed()) return;
    webContents.reload();
  };

  const showCrashedDialog = async (): Promise<void> => {
    if (dialogOpenedAt !== null || win.isDestroyed()) return;
    dialogOpenedAt = deps.now();
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
        defaultId: CRASHED_DIALOG.reopen,
        cancelId: CRASHED_DIALOG.openLogs,
        noLink: true,
      });
      if (response === CRASHED_DIALOG.openLogs) {
        deps.revealLogs();
        reopen();
      } else if (response === CRASHED_DIALOG.restartWithoutAcceleration) {
        deps.restartWithoutAcceleration();
      } else if (response === CRASHED_DIALOG.quit) {
        deps.quit('crash-dialog');
      } else {
        reopen();
      }
    } finally {
      dialogOpenedAt = null;
    }
  };

  const showUnresponsiveDialog = async (): Promise<void> => {
    if (dialogOpenedAt !== null || win.isDestroyed()) return;
    dialogOpenedAt = deps.now();
    const t = deps.translate();
    try {
      const { response } = await deps.showMessageBox(win, {
        type: 'warning',
        title: t('desktop.dialog.windowUnresponsive.title'),
        message: t('desktop.dialog.windowUnresponsive.message', { name: app.getName() }),
        detail: t('desktop.dialog.windowUnresponsive.detail'),
        buttons: [
          t('desktop.dialog.windowUnresponsive.reopen'),
          t('desktop.dialog.windowUnresponsive.quit'),
          t('desktop.dialog.windowUnresponsive.keepWaiting'),
        ],
        defaultId: UNRESPONSIVE_DIALOG.reopen,
        cancelId: UNRESPONSIVE_DIALOG.keepWaiting,
        noLink: true,
      });
      if (response === UNRESPONSIVE_DIALOG.reopen && !win.isDestroyed()) {
        expectedDeath = true;
        webContents.forcefullyCrashRenderer();
      } else if (response === UNRESPONSIVE_DIALOG.quit) {
        deps.quit('unresponsive-dialog');
      }
    } finally {
      dialogOpenedAt = null;
    }
  };

  webContents.on('render-process-gone', (_event, details) => {
    if (expectedDeath) {
      expectedDeath = false;
      logger.info('renderer terminated on request; reopening', details);
      reopen();
      return;
    }
    // `details.reason` distinguishes `crashed` / `killed` / `oom` /
    // `launch-failed` / `integrity-failure` — the triage key.
    logger.error('renderer process gone', details);
    // A clean exit is Chromium retiring the process on its own terms
    // (a navigation, an ordered shutdown), not a failure to contain.
    if (details.reason === 'clean-exit') return;
    deps.report({
      kind: 'renderer-gone',
      process: 'renderer',
      reason: details.reason,
      exitCode: details.exitCode,
      reopenCount,
    });
    const now = deps.now();
    const loop = lastGoneAt !== null && now - lastGoneAt < CRASH_LOOP_WINDOW_MS;
    lastGoneAt = now;
    if (loop) {
      logger.error('renderer died twice within the crash-loop window; asking the person');
      void showCrashedDialog();
      return;
    }
    logger.warn('reopening the window once');
    reopenCount += 1;
    reopen();
  });
  webContents.on('unresponsive', () => {
    if (dialogOpenedAt !== null) {
      logger.debug(`renderer still unresponsive (+${Math.round((deps.now() - dialogOpenedAt) / 1000)}s)`);
      return;
    }
    logger.warn('renderer unresponsive (event loop blocked)');
    deps.report({ kind: 'unresponsive', process: 'renderer', reopenCount });
    void showUnresponsiveDialog();
  });
  webContents.on('responsive', () => {
    logger.info('renderer responsive again');
  });
}
