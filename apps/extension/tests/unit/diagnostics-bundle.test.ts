// @vitest-environment jsdom
/**
 * The diagnostic bundle, document side (the error reports plan §4.5):
 * every bridge read becomes a file, a read the host does not answer is
 * a part left out (and named in the README), the `logs/` folder follows
 * the `readLogFiles` capability, the redaction runs under the host's
 * roots and the bound workspaces, and the archive carries the host and
 * the second in its name.
 */

import { inflateRawSync } from 'node:zlib';
import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { buildDiagnosticsBundle } from '@openheaders/ui/workbench/settings/diagnostics-bundle';
import { afterEach, describe, expect, it, vi } from 'vitest';

const AT = Date.UTC(2026, 9, 19, 18, 20, 47);

/** The archive's names and inflated texts, read back the way an unzip tool walks the central directory. */
function readZip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const out = new Map<string, string>();
  for (let i = 0; i < count; i += 1) {
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    const bodyStart = localOffset + 30 + view.getUint16(localOffset + 26, true);
    const body = bytes.subarray(bodyStart, bodyStart + compressedSize);
    out.set(name, new TextDecoder().decode(method === 8 ? new Uint8Array(inflateRawSync(body)) : body));
    cursor += 46 + nameLength;
  }
  return out;
}

function installBridge(answers: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const call = vi.fn(async (type: string) => {
    if (type in answers) return answers[type];
    throw new Error(`no handler for ${type}`);
  });
  setHostBridge({ call } as unknown as HostBridge);
  return call;
}

afterEach(() => {
  unregisterCapability('readLogFiles');
  unregisterCapability('diagnosticsRoots');
});

describe('buildDiagnosticsBundle', () => {
  it('zips every answered part, the host log files under logs/, under a host-stamped name', async () => {
    setCurrentHost('desktop');
    installBridge({
      diagnosticsFacts: { facts: { host: 'desktop', appVersion: '2026.10.1' } },
      getStatusSnapshot: { snapshot: { entries: [] } },
      getObservabilityLog: { entries: [{ op: 'connect' }] },
      productTelemetryRead: { sessionId: 's1', installId: null, enabled: true, entries: [] },
      errorReportRead: { sessionId: 's1', enabled: true, entries: [{ at: AT, disposition: 'sent', report: {} }] },
      'oh.workspaceTree.list': { bindings: [{ workspaceId: 'w1', rootDir: '/Users/jane/dev/acme', issues: [] }] },
    });
    registerCapability('readLogFiles', async () => [
      {
        name: 'main.log',
        text: 'line\nsweep /Users/jane/dev/acme: 0 batches\nat /Users/jane/dev/app/x.js:1:2\nsaw /Users/jane/other/f\n',
        note: 'this launch and the one before it',
      },
    ]);
    registerCapability('diagnosticsRoots', async () => [
      { path: '/Users/jane', placeholder: '<home>', collapse: true },
      { path: '/Users/jane/dev/app', placeholder: '<app>' },
    ]);

    const { filename, bytes } = await buildDiagnosticsBundle(() => AT);
    expect(filename).toBe('openheaders-diagnostics-desktop-2026-10-19T18-20-47.zip');
    const files = readZip(bytes);
    expect([...files.keys()]).toEqual([
      'README.txt',
      'facts.json',
      'status.json',
      'observability-log.json',
      'telemetry-session.json',
      'settings.json',
      'logs/main.log',
    ]);
    expect(files.get('logs/main.log')).toBe('line\nsweep <workspace 1>: 0 batches\nat x.js:1:2\nsaw <home>/…\n');
    expect(files.get('README.txt')).toContain('(this launch and the one before it)');
    expect(JSON.parse(files.get('facts.json') ?? '')).toMatchObject({ appVersion: '2026.10.1' });
    expect(JSON.parse(files.get('telemetry-session.json') ?? '').reports.entries).toHaveLength(1);
    expect(files.get('README.txt')).toContain('session: s1');
    expect(files.get('README.txt')).not.toContain('Not included');
  });

  it('leaves unanswered reads out and says so, with no logs/ where the host has no files', async () => {
    setCurrentHost('web');
    installBridge({
      getStatusSnapshot: { snapshot: { entries: [] } },
      getObservabilityLog: { entries: [] },
    });

    const { filename, bytes } = await buildDiagnosticsBundle(() => AT);
    expect(filename).toContain('-web-');
    const files = readZip(bytes);
    expect([...files.keys()]).toEqual(['README.txt', 'status.json', 'observability-log.json', 'settings.json']);
    const readme = files.get('README.txt') ?? '';
    expect(readme).toContain('Not included:');
    expect(readme).toContain('facts.json —');
    expect(readme).toContain('telemetry-session.json —');
    expect(readme).toContain('logs/ —');
  });
});
