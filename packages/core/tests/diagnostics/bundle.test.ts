/**
 * The bundle composer: every answered part becomes a named file, every
 * unanswered part is named in the README instead, and the README's
 * first lines carry the host, the version, the time and the session.
 */

import { describe, expect, it } from 'vitest';
import {
  composeDiagnosticsBundle,
  DIAGNOSTICS_BUNDLE_README,
  type DiagnosticsBundleParts,
  type DiagnosticsFacts,
  diagnosticsBundleFilename,
} from '../../src/diagnostics';

const AT = Date.UTC(2026, 9, 19, 18, 20, 47);

const desktopFacts: DiagnosticsFacts = {
  host: 'desktop',
  appVersion: '2026.10.1',
  channel: 'github-release',
  locale: 'en',
  platform: 'darwin',
  arch: 'arm64',
  osVersion: '26.0.1',
  uptimeSeconds: 120,
  collectedAt: AT,
  packaged: true,
  runtime: { electron: '44.4.5', chromium: '144.0.0.0', node: '24.0.0', v8: '14.0' },
  runningUnderArm64Translation: false,
  hardwareAccelerationDisabledOnNextLaunch: false,
  previousSessionEndedDirty: true,
  gpuFeatureStatus: { gpu_compositing: 'enabled' },
  memory: { totalKB: 16_000_000, freeKB: 4_000_000 },
  displays: [{ width: 1728, height: 1117, scaleFactor: 2, internal: true }],
  windows: 1,
};

function fullParts(): DiagnosticsBundleParts {
  return {
    host: 'desktop',
    generatedAt: AT,
    facts: desktopFacts,
    status: { entries: [] } as unknown as DiagnosticsBundleParts['status'],
    observabilityLog: [
      { timestamp: AT, subsystem: 'sync', op: 'connect', level: 'info', message: 'connected', context: {} },
    ],
    telemetrySession: {
      events: { sessionId: 'abc123', installId: null, enabled: true, entries: [] },
      reports: { sessionId: 'abc123', enabled: true, entries: [] },
    },
    settings: { 'general.language': 'auto' },
    logFiles: [
      { name: 'main.log', text: 'line one\n' },
      { name: 'main.old.log', text: 'older\n' },
    ],
  };
}

function text(data: Uint8Array | string): string {
  return typeof data === 'string' ? data : new TextDecoder().decode(data);
}

describe('composeDiagnosticsBundle', () => {
  it('names every part as a file, the README first, the logs under logs/', () => {
    const entries = composeDiagnosticsBundle(fullParts());
    expect(entries.map((e) => e.name)).toEqual([
      DIAGNOSTICS_BUNDLE_README,
      'facts.json',
      'status.json',
      'observability-log.json',
      'telemetry-session.json',
      'settings.json',
      'logs/main.log',
      'logs/main.old.log',
    ]);
    for (const entry of entries) expect(entry.modifiedAt).toBe(AT);
    const readme = text(entries[0].data);
    expect(readme).toContain('host: desktop');
    expect(readme).toContain('version: 2026.10.1');
    expect(readme).toContain('generated: 2026-10-19T18:20:47.000Z');
    expect(readme).toContain('session: abc123');
    expect(readme).toContain('did not send this');
    expect(readme).not.toContain('Not included');
    expect(JSON.parse(text(entries[1].data))).toEqual(desktopFacts);
    expect(JSON.parse(text(entries[3].data))).toMatchObject({ exportedAt: '2026-10-19T18:20:47.000Z' });
    expect(text(entries[6].data)).toBe('line one\n');
  });

  it('leaves unanswered parts out and lists them in the README', () => {
    const entries = composeDiagnosticsBundle({
      host: 'web',
      generatedAt: AT,
      facts: null,
      status: null,
      observabilityLog: [],
      telemetrySession: null,
      settings: null,
      logFiles: [],
    });
    expect(entries.map((e) => e.name)).toEqual([DIAGNOSTICS_BUNDLE_README, 'observability-log.json']);
    const readme = text(entries[0].data);
    expect(readme).toContain('version: unknown');
    expect(readme).not.toContain('session:');
    expect(readme).toContain('Not included:');
    for (const name of ['facts.json', 'status.json', 'telemetry-session.json', 'settings.json', 'logs/']) {
      expect(readme).toContain(`  ${name} —`);
    }
  });
});

describe('diagnosticsBundleFilename', () => {
  it('is host-tagged and second-stamped with no colons', () => {
    expect(diagnosticsBundleFilename('extension', AT)).toBe(
      'openheaders-diagnostics-extension-2026-10-19T18-20-47.zip',
    );
  });
});
