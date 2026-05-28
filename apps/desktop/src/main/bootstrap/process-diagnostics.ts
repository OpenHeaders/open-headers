/**
 * Process-level diagnostics. Without these, fatal main-process errors
 * and renderer crashes are silent — the app degrades or dies and the
 * only signal is "user reports it stopped working." Cheap to wire,
 * essential the moment something goes wrong in the field.
 *
 * Two surfaces:
 *   - Main process: uncaught synchronous throws and unhandled promise
 *     rejections.
 *   - Renderer: `render-process-gone` (crash / killed), `unresponsive`
 *     / `responsive` (event loop blocked).
 *
 * Output is `console.*` for now; a structured logger (electron-log to
 * file in packaged builds) lands in a separate slice.
 */

import type { BrowserWindow } from 'electron';
import { createLogger } from './logger';

const logger = createLogger('process');

export function installProcessDiagnostics(): void {
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', err);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', reason);
  });
}

export function attachRendererDiagnostics(win: BrowserWindow): void {
  win.webContents.on('render-process-gone', (_event, details) => {
    // `details.reason` distinguishes `crashed` / `killed` / `oom` /
    // `launch-failed` / `integrity-failure` — useful for triage.
    logger.error('renderer process gone', details);
  });
  win.webContents.on('unresponsive', () => {
    logger.warn('renderer unresponsive (event loop blocked)');
  });
  win.webContents.on('responsive', () => {
    logger.info('renderer responsive again');
  });
}
