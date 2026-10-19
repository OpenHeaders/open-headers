/**
 * Crash-and-error-report RPCs (the error reports plan §3.4, §4.2 law 8)
 * — the seam between a UI document's error funnel and the host-owned
 * `ErrorReportController`. Exactly one controller lives per host
 * (extension SW / desktop main); a document never converts, never
 * opens a socket, never dials: it hands the funnel's entry to the host
 * over the bridge and the host runs `toErrorReport` with its own
 * own-origin test.
 *
 * The wire entry carries the described error — name, message, stack —
 * because the conversion that drops the message runs on the host side.
 * This RPC is local IPC (renderer ↔ main, document ↔ service worker);
 * nothing here leaves the device.
 */

import type {
  ErrorReport,
  ErrorReportErrorDescription,
  ErrorReportKind,
  ErrorReportProcess,
  ErrorReportSurface,
  TelemetryDisposition,
} from '../../telemetry';

/** The three kinds a UI document can observe (the ring-0 kinds are the desktop main process's own). */
export type ErrorReportDocumentKind = Extract<
  ErrorReportKind,
  'render-error' | 'uncaught-exception' | 'unhandled-rejection'
>;

/** One funnelled failure as a document hands it to its host. */
export interface ErrorReportWireEntry {
  /** The document's process kind (`workbench` reads as `renderer`). */
  process: ErrorReportProcess;
  kind: ErrorReportDocumentKind;
  /** The workbench unit whose boundary caught a render error, when it is a vocabulary member. */
  surface?: ErrorReportSurface;
  error: ErrorReportErrorDescription;
  /** React's component stack for the render kind; null otherwise. */
  componentStack: string | null;
}

/** One session-log entry, as the inspector's "Error reports" section renders it. */
export interface ErrorReportLogEntryWire {
  report: ErrorReport;
  /** ms since epoch at report time. */
  at: number;
  disposition: TelemetryDisposition;
}

/** Everything the inspector section shows: the log plus the channel's gate and the shared session id. */
export interface ErrorReportSnapshotWire {
  sessionId: string;
  enabled: boolean;
  entries: ErrorReportLogEntryWire[];
}

export interface ErrorReportRpc {
  /** Record one funnelled failure on the host's controller. Fire-and-forget semantics — the response only acknowledges receipt. */
  errorReportRecord: { req: { entry: ErrorReportWireEntry }; res: { success: boolean } };
  /** Read the session's report log + the channel gate for the inspector's "Error reports" section. */
  errorReportRead: { req: Record<string, never>; res: ErrorReportSnapshotWire };
}
