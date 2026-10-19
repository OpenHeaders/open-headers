/**
 * The diagnostic bundle, document side (the error reports plan §4.5):
 * gather every part this surface can read over the bridge — the host's
 * system facts, the status snapshot, the structured diagnostic log,
 * this session's telemetry as the inspector shows it, the settings
 * snapshot and, where the host registers `readLogFiles`, its log files
 * — hand them to core's pure composer, zip the entries and give the
 * archive to the browser as a download. On the desktop that download is
 * Electron's own save dialog; in an extension page it is an ordinary
 * download, no permission needed.
 *
 * A read the host does not answer is a part left out, never a failed
 * save: a served web tab yields a smaller bundle whose README says what
 * is missing. Nothing here opens a socket to anything but the host.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import {
  composeDiagnosticsBundle,
  type DiagnosticsBundleParts,
  type DiagnosticsLogFile,
  diagnosticsBundleFilename,
  writeZip,
} from '@openheaders/core/diagnostics';
import { getCurrentHost } from '../../shared/host-vocabulary';
import { snapshotSettings } from './settings-snapshot';

async function answered<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

async function readHostLogFiles(): Promise<DiagnosticsLogFile[]> {
  const read = getCapability('readLogFiles');
  if (!read) return [];
  return (await answered(read)) ?? [];
}

/** Every part this surface can gather, each read tolerant of a host that does not answer it. */
export async function collectDiagnosticsBundleParts(now: () => number = Date.now): Promise<DiagnosticsBundleParts> {
  const [facts, status, observabilityLog, events, reports, logFiles] = await Promise.all([
    answered(() => hostBridge.call('diagnosticsFacts')).then((r) => r?.facts ?? null),
    answered(() => hostBridge.call('getStatusSnapshot')).then((r) => r?.snapshot ?? null),
    answered(() => hostBridge.call('getObservabilityLog')).then((r) => r?.entries ?? null),
    answered(() => hostBridge.call('productTelemetryRead')),
    answered(() => hostBridge.call('errorReportRead')),
    readHostLogFiles(),
  ]);
  let settings: Record<string, unknown> | null;
  try {
    settings = snapshotSettings();
  } catch {
    settings = null;
  }
  return {
    host: getCurrentHost(),
    generatedAt: now(),
    facts,
    status,
    observabilityLog,
    telemetrySession: events === null && reports === null ? null : { events, reports },
    settings,
    logFiles,
  };
}

export interface DiagnosticsBundleFile {
  filename: string;
  bytes: Uint8Array;
}

/** Gather, compose and zip — the bytes a test can open without a DOM. */
export async function buildDiagnosticsBundle(now: () => number = Date.now): Promise<DiagnosticsBundleFile> {
  const parts = await collectDiagnosticsBundleParts(now);
  const bytes = await writeZip(composeDiagnosticsBundle(parts), now);
  return { filename: diagnosticsBundleFilename(parts.host, parts.generatedAt), bytes };
}

/** The Settings row's and the desktop Help menu's one action: build the bundle and hand it to the browser as a download. */
export async function saveDiagnosticsBundle(): Promise<void> {
  const { filename, bytes } = await buildDiagnosticsBundle();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
