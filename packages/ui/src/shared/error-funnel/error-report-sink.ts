/**
 * The error-report sink — the funnel's second step on the hosts that
 * report (the error reports plan §3.4): every funnelled failure becomes
 * a wire entry and rides the host bridge to the process that owns the
 * report channel (desktop main, the extension service worker). The
 * document never converts: the host runs `toErrorReport` with its own
 * own-origin test, so the message never leaves the device.
 *
 * Installed by a host entry (never the served web app, which is
 * hard-off and mounts containment only). Nothing here throws and
 * nothing here waits: a failed call is dropped, never retried.
 */

import { type ErrorReportDocumentKind, type ErrorReportWireEntry, getHostBridge } from '@openheaders/core/bridge';
import {
  type ErrorReportProcess,
  type ErrorReportSurface,
  ErrorReportSurfaceSchema,
} from '@openheaders/core/telemetry';
import * as v from 'valibot';
import {
  describeError,
  type ErrorFunnelOrigin,
  type ErrorFunnelSurface,
  type ErrorFunnelUnit,
  type FunnelledError,
  setErrorFunnelSink,
} from './error-funnel';

/** The funnel's document kinds on the wire's process vocabulary; the served web app has no member and reports nothing. */
const PROCESS_BY_SURFACE: Record<Exclude<ErrorFunnelSurface, 'web'>, ErrorReportProcess> = {
  workbench: 'renderer',
  popup: 'popup',
  sidepanel: 'sidepanel',
  'devtools-panel': 'devtools-panel',
};

/** The three React origins fold onto one kind — the boundary that caught it is the `surface`. */
const KIND_BY_ORIGIN: Record<ErrorFunnelOrigin, ErrorReportDocumentKind> = {
  render: 'render-error',
  boundary: 'render-error',
  recoverable: 'render-error',
  'window-error': 'uncaught-exception',
  'unhandled-rejection': 'unhandled-rejection',
};

/** A unit names a surface only when it is a vocabulary member — a tab mode or tool window the schema never learned stays unnamed. */
function surfaceOf(unit: ErrorFunnelUnit): ErrorReportSurface | undefined {
  const candidate = unit.kind === 'tab' ? unit.mode : unit.id;
  return v.is(ErrorReportSurfaceSchema, candidate) ? candidate : undefined;
}

/** The wire entry for one funnelled failure, or null on a document kind that never reports. */
export function toErrorReportWireEntry(entry: Omit<FunnelledError, 'at'>): ErrorReportWireEntry | null {
  if (entry.surface === 'web') return null;
  const surface = entry.unit ? surfaceOf(entry.unit) : undefined;
  return {
    process: PROCESS_BY_SURFACE[entry.surface],
    kind: KIND_BY_ORIGIN[entry.origin],
    ...(surface !== undefined ? { surface } : {}),
    error: describeError(entry.error),
    componentStack: entry.componentStack,
  };
}

/** Install the sink: every funnel entry becomes one `errorReportRecord` call, fire-and-forget. */
export function installErrorReportSink(): void {
  setErrorFunnelSink((entry) => {
    const wire = toErrorReportWireEntry(entry);
    if (wire === null) return;
    const bridge = getHostBridge();
    if (!bridge) return;
    void bridge.call('errorReportRecord', { entry: wire }).catch(() => undefined);
  });
}
