/**
 * The diagnostic bundle's composer (the error reports plan §4.5 — the
 * user-initiated third tier beside the structured report channel): the
 * parts a document gathered over the bridge become the files of one
 * zip, with a README that names each one and states what every part of
 * the product states — nothing in here was sent anywhere. A part a host
 * could not answer is left out and the README says so, so a bundle from
 * a browser surface (no log file) or a served web tab (no telemetry)
 * still reads whole.
 *
 * Pure: no bridge, no DOM, no clock of its own. The host-side readers
 * live with their hosts; the download step lives with the document.
 */

import type { ErrorReportSnapshotWire, ProductTelemetrySnapshot } from '../protocol/channels';
import type { LogEntry, StatusSnapshot } from '../types';
import type { DiagnosticsFacts } from './facts';
import type { ZipEntry } from './zip';

/** One host log file as the host hands it over — the file's name and its text. */
export interface DiagnosticsLogFile {
  name: string;
  text: string;
}

export interface DiagnosticsTelemetrySession {
  events: ProductTelemetrySnapshot | null;
  reports: ErrorReportSnapshotWire | null;
}

export type DiagnosticsBundleHost = 'desktop' | 'extension' | 'web';

export interface DiagnosticsBundleParts {
  host: DiagnosticsBundleHost;
  /** ms since epoch when the bundle was composed. */
  generatedAt: number;
  facts: DiagnosticsFacts | null;
  status: StatusSnapshot | null;
  observabilityLog: readonly LogEntry[] | null;
  telemetrySession: DiagnosticsTelemetrySession | null;
  settings: Record<string, unknown> | null;
  logFiles: readonly DiagnosticsLogFile[];
}

export const DIAGNOSTICS_BUNDLE_README = 'README.txt';
export const DIAGNOSTICS_BUNDLE_FACTS = 'facts.json';
export const DIAGNOSTICS_BUNDLE_STATUS = 'status.json';
export const DIAGNOSTICS_BUNDLE_OBSERVABILITY_LOG = 'observability-log.json';
export const DIAGNOSTICS_BUNDLE_TELEMETRY_SESSION = 'telemetry-session.json';
export const DIAGNOSTICS_BUNDLE_SETTINGS = 'settings.json';
export const DIAGNOSTICS_BUNDLE_LOGS_DIR = 'logs';

/** `openheaders-diagnostics-<host>-<YYYY-MM-DDTHH-mm-ss>.zip` — sortable, no characters a filesystem refuses. */
export function diagnosticsBundleFilename(host: DiagnosticsBundleHost, at: number): string {
  const stamp = new Date(at).toISOString().slice(0, 19).replace(/:/g, '-');
  return `openheaders-diagnostics-${host}-${stamp}.zip`;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sessionIdOf(session: DiagnosticsTelemetrySession | null): string | null {
  return session?.reports?.sessionId ?? session?.events?.sessionId ?? null;
}

interface ComposedFile {
  entry: ZipEntry;
  description: string;
}

/** The archive's entries in order: the README first, then every part the host answered. */
export function composeDiagnosticsBundle(parts: DiagnosticsBundleParts): ZipEntry[] {
  const files: ComposedFile[] = [];
  const missing: string[] = [];
  const at = parts.generatedAt;

  if (parts.facts) {
    files.push({
      entry: { name: DIAGNOSTICS_BUNDLE_FACTS, data: json(parts.facts), modifiedAt: at },
      description: 'build, runtime, platform and machine-class facts (no paths, no user names)',
    });
  } else {
    missing.push(`${DIAGNOSTICS_BUNDLE_FACTS} — this host did not answer the facts read`);
  }

  if (parts.status) {
    files.push({
      entry: { name: DIAGNOSTICS_BUNDLE_STATUS, data: json(parts.status), modifiedAt: at },
      description: 'the per-subsystem status snapshot at the time of saving',
    });
  } else {
    missing.push(`${DIAGNOSTICS_BUNDLE_STATUS} — this host did not answer the status read`);
  }

  if (parts.observabilityLog) {
    files.push({
      entry: {
        name: DIAGNOSTICS_BUNDLE_OBSERVABILITY_LOG,
        data: json({ exportedAt: new Date(at).toISOString(), entries: parts.observabilityLog }),
        modifiedAt: at,
      },
      description: `the structured diagnostic log (${parts.observabilityLog.length} entries), the same file "Export log" saves`,
    });
  } else {
    missing.push(`${DIAGNOSTICS_BUNDLE_OBSERVABILITY_LOG} — this host did not answer the log read`);
  }

  if (parts.telemetrySession) {
    const { events, reports } = parts.telemetrySession;
    files.push({
      entry: { name: DIAGNOSTICS_BUNDLE_TELEMETRY_SESSION, data: json(parts.telemetrySession), modifiedAt: at },
      description:
        `this session's anonymous usage events (${events?.entries.length ?? 0}) and crash and error reports ` +
        `(${reports?.entries.length ?? 0}), byte for byte as the inspector shows them, sent or not`,
    });
  } else {
    missing.push(`${DIAGNOSTICS_BUNDLE_TELEMETRY_SESSION} — this host keeps no telemetry session`);
  }

  if (parts.settings) {
    files.push({
      entry: { name: DIAGNOSTICS_BUNDLE_SETTINGS, data: json(parts.settings), modifiedAt: at },
      description: 'every persisted setting, the same file "Export Settings" saves',
    });
  } else {
    missing.push(`${DIAGNOSTICS_BUNDLE_SETTINGS} — the settings store was not readable`);
  }

  if (parts.logFiles.length > 0) {
    for (const file of parts.logFiles) {
      files.push({
        entry: { name: `${DIAGNOSTICS_BUNDLE_LOGS_DIR}/${file.name}`, data: file.text, modifiedAt: at },
        description: 'the host log file as written on disk (free text — read it before sharing)',
      });
    }
  } else {
    missing.push(
      `${DIAGNOSTICS_BUNDLE_LOGS_DIR}/ — this host writes no log file (browser surfaces log to the diagnostic log above)`,
    );
  }

  const sessionId = sessionIdOf(parts.telemetrySession);
  const lines: string[] = [
    'Open Headers diagnostic bundle',
    '',
    `host: ${parts.host}`,
    `version: ${parts.facts?.appVersion ?? 'unknown'}`,
    `generated: ${new Date(at).toISOString()}`,
    ...(sessionId !== null ? [`session: ${sessionId}`] : []),
    '',
    'Saved by you from Settings > Data > Diagnostics. Open Headers did not send this',
    'archive anywhere; it exists only where you saved it. Read it before sharing —',
    'the log files are free text and may name the URLs you worked with.',
    '',
    'Files:',
    ...files.map((file) => `  ${file.entry.name} — ${file.description}`),
  ];
  if (missing.length > 0) {
    lines.push('', 'Not included:', ...missing.map((line) => `  ${line}`));
  }
  lines.push('');

  return [{ name: DIAGNOSTICS_BUNDLE_README, data: lines.join('\n'), modifiedAt: at }, ...files.map((f) => f.entry)];
}
