/**
 * `@openheaders/core/diagnostics` — the user-initiated diagnostic
 * bundle (the error reports plan §4.5): the system-facts vocabulary the
 * hosts answer, the pure composer that turns gathered parts into zip
 * entries, and the dependency-free zip writer. Ships nothing; every
 * byte stays where the person saves it.
 */

export {
  composeDiagnosticsBundle,
  DIAGNOSTICS_BUNDLE_FACTS,
  DIAGNOSTICS_BUNDLE_LOGS_DIR,
  DIAGNOSTICS_BUNDLE_OBSERVABILITY_LOG,
  DIAGNOSTICS_BUNDLE_README,
  DIAGNOSTICS_BUNDLE_SETTINGS,
  DIAGNOSTICS_BUNDLE_STATUS,
  DIAGNOSTICS_BUNDLE_TELEMETRY_SESSION,
  type DiagnosticsBundleHost,
  type DiagnosticsBundleParts,
  type DiagnosticsLogFile,
  type DiagnosticsTelemetrySession,
  diagnosticsBundleFilename,
} from './bundle';
export type {
  DesktopDiagnosticsFacts,
  DesktopDisplayFacts,
  DiagnosticsFacts,
  DiagnosticsFactsBase,
  ExtensionDiagnosticsFacts,
} from './facts';
export { crc32, dosDateTime, writeZip, type ZipEntry } from './zip';
