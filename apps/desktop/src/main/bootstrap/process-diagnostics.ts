/**
 * Process-level diagnostics. Without these, fatal main-process errors
 * and child-process deaths are silent — the app degrades or dies and
 * the only signal is "user reports it stopped working." Cheap to wire,
 * essential the moment something goes wrong in the field.
 *
 *   - Main process: uncaught synchronous throws and unhandled promise
 *     rejections.
 *   - Child processes (`child-process-gone`): the GPU process, utility
 *     processes, the zygote — logged with Electron's typed reason and
 *     exit code. A GPU process that dies twice in one session is the
 *     "window keeps the frame colour and never repaints" class on some
 *     driver stacks: Chromium's software fallback is the first line,
 *     the hardware-acceleration escape dialog the second.
 *
 * Renderer-level supervision (`render-process-gone`, `unresponsive`)
 * lives in `./window-supervisor` per window. Output goes through the
 * shared main-process logger (electron-log's file transport in packaged
 * builds — see `./logger`).
 */

import { app } from 'electron';
import { offerHardwareAccelerationEscape } from './hardware-acceleration';
import { createLogger } from './logger';

const logger = createLogger('process');

/** GPU deaths in one session before the acceleration escape is offered. */
export const GPU_GONE_ESCAPE_THRESHOLD = 2;

export interface ProcessDiagnosticsDeps {
  offerAccelerationEscape(): Promise<void>;
}

const defaultDeps: ProcessDiagnosticsDeps = {
  offerAccelerationEscape: offerHardwareAccelerationEscape,
};

export function installProcessDiagnostics(deps: ProcessDiagnosticsDeps = defaultDeps): void {
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', err);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', reason);
  });

  let gpuGoneCount = 0;
  app.on('child-process-gone', (_event, details) => {
    // `details.type` names the process (`GPU`, `Utility`, `Zygote`, …);
    // `details.reason` and `exitCode` are the triage key.
    logger.error('child process gone', details);
    if (details.type !== 'GPU') return;
    gpuGoneCount += 1;
    if (gpuGoneCount === GPU_GONE_ESCAPE_THRESHOLD) {
      logger.error(`GPU process died ${gpuGoneCount} times this session; offering the hardware-acceleration escape`);
      void deps.offerAccelerationEscape();
    }
  });
}
