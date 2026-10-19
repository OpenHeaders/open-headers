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

import type { ErrorReportInput, ErrorReportProcess } from '@openheaders/core/telemetry';
import { app } from 'electron';
import { describeThrown, recordErrorReport } from './error-report-sink';
import { offerHardwareAccelerationEscape } from './hardware-acceleration';
import { createLogger } from './logger';

const logger = createLogger('process');

/** GPU deaths in one session before the acceleration escape is offered. */
export const GPU_GONE_ESCAPE_THRESHOLD = 2;

export interface ProcessDiagnosticsDeps {
  offerAccelerationEscape(): Promise<void>;
  /** The report channel's sink (the error reports plan §3.3): main's own failures and the gone child processes. */
  report(input: ErrorReportInput): void;
}

const defaultDeps: ProcessDiagnosticsDeps = {
  offerAccelerationEscape: offerHardwareAccelerationEscape,
  report: recordErrorReport,
};

/**
 * The child process types the report vocabulary names; the rest (the
 * zygote, the sandbox helper, plugins) log only — an unlisted type is
 * never misreported under the nearest member.
 */
function reportableChildProcess(type: string): ErrorReportProcess | null {
  if (type === 'GPU') return 'gpu';
  if (type === 'Utility') return 'utility';
  return null;
}

export function installProcessDiagnostics(deps: ProcessDiagnosticsDeps = defaultDeps): void {
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', err);
    deps.report({ kind: 'uncaught-exception', process: 'main', error: describeThrown(err) });
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', reason);
    deps.report({ kind: 'unhandled-rejection', process: 'main', error: describeThrown(reason) });
  });

  let gpuGoneCount = 0;
  app.on('child-process-gone', (_event, details) => {
    // `details.type` names the process (`GPU`, `Utility`, `Zygote`, …);
    // `details.reason` and `exitCode` are the triage key.
    logger.error('child process gone', details);
    const reportable = reportableChildProcess(details.type);
    if (reportable !== null) {
      deps.report({
        kind: 'child-process-gone',
        process: reportable,
        reason: details.reason,
        exitCode: details.exitCode,
      });
    }
    if (details.type !== 'GPU') return;
    gpuGoneCount += 1;
    if (gpuGoneCount === GPU_GONE_ESCAPE_THRESHOLD) {
      logger.error(`GPU process died ${gpuGoneCount} times this session; offering the hardware-acceleration escape`);
      void deps.offerAccelerationEscape();
    }
  });
}
