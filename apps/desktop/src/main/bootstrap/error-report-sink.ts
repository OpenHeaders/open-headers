/**
 * The main process's error-report sink (the error reports plan §3.3,
 * §3.4) — where ring 0 hands its observations to the report channel:
 * a renderer gone, a child process gone, a hang, the sentinel's dirty
 * previous session, main's own uncaught failures.
 *
 * The channel's controller boots with the engine, after `whenReady`;
 * the sentinel and the first supervisor events can fire before it
 * exists. The seam buffers those (a bounded handful) and drains them
 * the moment the host installs the sink, so the one report a dirty
 * exit earns is never lost to boot order. Nothing here throws.
 */

import type { ErrorReportInput } from '@openheaders/core/telemetry';

export type ErrorReportSink = (input: ErrorReportInput) => void;

/** Reports held before the sink exists; a boot never produces more than a few, the rest are dropped. */
export const ERROR_REPORT_PENDING_CAP = 20;

let sink: ErrorReportSink | null = null;
let pending: ErrorReportInput[] = [];

/** Hand one observation to the channel — now, or when it boots. */
export function recordErrorReport(input: ErrorReportInput): void {
  if (sink) {
    try {
      sink(input);
    } catch {
      // The channel must never turn one failure into two.
    }
    return;
  }
  if (pending.length < ERROR_REPORT_PENDING_CAP) pending.push(input);
}

/** Install the channel's sink (null removes it); the buffered observations drain into it in order. */
export function setErrorReportSink(next: ErrorReportSink | null): void {
  sink = next;
  if (!next) return;
  const buffered = pending;
  pending = [];
  for (const input of buffered) recordErrorReport(input);
}

/** Test-only — drop the sink and anything buffered. */
export function __resetErrorReportSinkForTests(): void {
  sink = null;
  pending = [];
}
