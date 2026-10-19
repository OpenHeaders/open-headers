/**
 * The desktop's crash-and-error-report adapter (the error reports plan
 * §4, §5): the `telemetry.errorReports` gate off the settings blob,
 * the one session id shared with the usage channel, the own-origin
 * test over the asar / the dev server / a bare main-process path, the
 * ring-0 sink drained at install, and the message-free envelope that
 * leaves.
 */

import { OH, type StorageKey } from '@openheaders/core/storage';
import {
  createInMemoryProductTelemetrySessionStore,
  type ErrorReportEnvelope,
  type TelemetryEnvelope,
} from '@openheaders/core/telemetry';
import { afterEach, describe, expect, it } from 'vitest';
import { __resetErrorReportSinkForTests, recordErrorReport } from '@/main/bootstrap/error-report-sink';
import { createOwnOriginTest, installErrorReports } from '@/main/error-reports';
import { buildEnvelopeFacts, installProductTelemetry, type ProductTelemetryHostDeps } from '@/main/product-telemetry';

const APP_PATH = '/Applications/Open Headers.app/Contents/Resources/app.asar';

interface RigOptions {
  settings?: Record<string, unknown>;
  appPath?: string;
  rendererDevUrl?: string;
}

function makeRig(options: RigOptions = {}) {
  const sent: ErrorReportEnvelope[] = [];
  const usageSent: TelemetryEnvelope[] = [];
  const values = new Map<string, unknown>([[OH.settingsUser.key, options.settings]]);
  const listeners = new Map<string, Array<(next: unknown) => void>>();

  const storage: ProductTelemetryHostDeps['storage'] = {
    get: async <T>(spec: StorageKey<T>) => values.get(spec.key) as T | undefined,
    set: async (spec, value) => {
      values.set(spec.key, value);
    },
    remove: async (spec) => {
      for (const one of Array.isArray(spec) ? spec : [spec]) values.delete(one.key);
    },
    subscribe: <T>(spec: StorageKey<T>, fn: (next: T | undefined) => void) => {
      const bucket = listeners.get(spec.key) ?? [];
      bucket.push(fn as (next: unknown) => void);
      listeners.set(spec.key, bucket);
      return () => undefined;
    },
  };
  const write = (spec: StorageKey<unknown>, value: unknown): void => {
    values.set(spec.key, value);
    for (const fn of listeners.get(spec.key) ?? []) fn(value);
  };

  const sessionStore = createInMemoryProductTelemetrySessionStore();
  const telemetryDeps: ProductTelemetryHostDeps = {
    storage,
    appVersion: '2026.10.2',
    platform: 'darwin',
    arch: 'arm64',
    runningUnderArm64Translation: false,
    systemVersion: '15.1',
    channel: 'github-release',
    locale: () => 'en',
    sessionStore,
    transport: {
      async send(envelope) {
        usageSent.push(envelope);
        return true;
      },
    },
    now: () => 1_760_000_000_000,
  };

  const install = () =>
    installErrorReports({
      storage,
      sessionStore,
      facts: () => buildEnvelopeFacts(telemetryDeps),
      appPath: options.appPath ?? APP_PATH,
      rendererDevUrl: options.rendererDevUrl,
      transport: {
        async send(envelope) {
          sent.push(envelope);
          return true;
        },
      },
      now: () => 1_760_000_000_000,
    });

  return { install, installUsage: () => installProductTelemetry(telemetryDeps), sent, usageSent, write };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const asarStack = [
  "TypeError: Cannot read properties of undefined (reading 'map')",
  `    at renderRows (file://${APP_PATH}/out/renderer/assets/index-abc123.js:1:48213)`,
  '    at node:internal/process/task_queues:95:5',
  '    at eval (eval at <anonymous> (blob:file:///x), <anonymous>:1:2)',
].join('\n');

afterEach(() => {
  __resetErrorReportSinkForTests();
});

describe('createOwnOriginTest', () => {
  const isOwn = createOwnOriginTest(APP_PATH, 'http://localhost:5173/');

  it('owns file URLs and bare paths under the app path, and the dev server origin', () => {
    expect(isOwn(`file://${APP_PATH}/out/renderer/assets/index-abc123.js`)).toBe(true);
    expect(isOwn(`${APP_PATH}/out/main/index.js`)).toBe(true);
    expect(isOwn('http://localhost:5173/src/renderer/index.tsx')).toBe(true);
    expect(isOwn('http://localhost:5173/node_modules/.vite/deps/chunk-X.js')).toBe(true);
  });

  it('reads everything else as foreign — Node internals, other schemes, other origins, a sibling path', () => {
    expect(isOwn('node:internal/process/task_queues')).toBe(false);
    expect(isOwn('chrome-extension://abcdef/background.js')).toBe(false);
    expect(isOwn('blob:file:///x')).toBe(false);
    expect(isOwn('http://localhost:5174/other.js')).toBe(false);
    expect(isOwn('/Applications/Open Headers.app/Contents/Resources/app.asar.unpacked/native.js')).toBe(false);
    expect(isOwn('/Users/someone/scripts/rule.js')).toBe(false);
  });

  it('a packaged build has no dev origin, and a Windows app path reads its drive-letter frames', () => {
    const packaged = createOwnOriginTest(APP_PATH);
    expect(packaged('http://localhost:5173/src/index.tsx')).toBe(false);
    const windows = createOwnOriginTest('C:\\Program Files\\Open Headers\\resources\\app.asar');
    expect(windows('file:///C:/Program%20Files/Open%20Headers/resources/app.asar/out/renderer/index-1.js')).toBe(true);
    expect(windows('C:\\Program Files\\Open Headers\\resources\\app.asar\\out\\main\\index.js')).toBe(true);
    expect(windows('C:\\Users\\someone\\other.js')).toBe(false);
  });
});

describe('installErrorReports', () => {
  it("shares the usage channel's session id and sends a message-free report with only own frames named", async () => {
    const { install, installUsage, sent, usageSent } = makeRig();
    const usage = await installUsage();
    const handle = await install();
    handle.record({
      kind: 'render-error',
      process: 'renderer',
      surface: 'request-edit',
      error: { name: 'TypeError', message: "Cannot read properties of undefined (reading 'map')", stack: asarStack },
      componentStack: '\n    at RequestEditor\n    at WorkbenchTabBody',
    });
    await settle();
    await usage.flush();
    expect(sent).toHaveLength(1);
    expect(usageSent).toHaveLength(1);
    expect(sent[0].sessionId).toBe(usageSent[0].sessionId);
    expect(sent[0].host).toBe('desktop');
    expect(sent[0].channel).toBe('github-release');
    expect(sent[0].platform).toBe('mac');
    expect('installId' in sent[0]).toBe(false);
    const [report] = sent[0].reports;
    expect(report).toMatchObject({
      kind: 'render-error',
      process: 'renderer',
      surface: 'request-edit',
      errorName: 'TypeError',
      template: 'cannot-read-property',
      componentStack: ['RequestEditor', 'WorkbenchTabBody'],
      count: 1,
    });
    expect(report.frames).toEqual([
      { file: 'index-abc123.js', line: 1, col: 48213, fn: 'renderRows' },
      { external: true },
    ]);
    expect(JSON.stringify(sent[0])).not.toContain('map');
    expect(JSON.stringify(sent[0])).not.toContain('Applications');
    handle.dispose();
    usage.dispose();
  });

  it('the setting gates it: off suppresses, a live flip to on delivers what is recorded after', async () => {
    const { install, sent, write } = makeRig({ settings: { 'telemetry.errorReports': false } });
    const handle = await install();
    handle.record({ kind: 'abnormal-exit', process: 'main' });
    await settle();
    expect(sent).toHaveLength(0);
    const off = await handle.snapshot();
    expect(off.enabled).toBe(false);
    expect(off.entries.map((entry) => entry.disposition)).toEqual(['suppressed']);
    write(OH.settingsUser, { 'telemetry.errorReports': true });
    handle.record({ kind: 'unresponsive', process: 'renderer', reopenCount: 1 });
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0].reports[0]).toMatchObject({ kind: 'unresponsive', reopenCount: 1 });
    handle.dispose();
  });

  it('drains the ring-0 observations buffered before the channel booted, and detaches on dispose', async () => {
    recordErrorReport({ kind: 'abnormal-exit', process: 'main' });
    recordErrorReport({ kind: 'child-process-gone', process: 'gpu', reason: 'crashed', exitCode: 5 });
    const { install, sent } = makeRig();
    const handle = await install();
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0].reports.map((report) => report.kind)).toEqual(['abnormal-exit', 'child-process-gone']);
    expect(sent[0].reports[1]).toMatchObject({ process: 'gpu', reason: 'crashed', exitCode: 5 });
    handle.dispose();
    recordErrorReport({ kind: 'abnormal-exit', process: 'main' });
    await settle();
    expect(sent).toHaveLength(1);
  });

  it('a repeat of a sent fingerprint on the same day is suppressed, never sent twice', async () => {
    const { install, sent } = makeRig();
    const handle = await install();
    handle.record({ kind: 'abnormal-exit', process: 'main' });
    await settle();
    handle.record({ kind: 'abnormal-exit', process: 'main' });
    await settle();
    expect(sent).toHaveLength(1);
    const snapshot = await handle.snapshot();
    expect(snapshot.entries.map((entry) => entry.disposition)).toEqual(['sent', 'suppressed']);
    handle.dispose();
  });
});
