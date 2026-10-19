import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  ERROR_REPORT_MAX_BYTES,
  ERROR_REPORT_MAX_LOG,
  ERROR_REPORT_MAX_PER_ENVELOPE,
  ERROR_REPORT_MAX_QUEUE,
  type ErrorReport,
  ErrorReportClient,
  type ErrorReportEnvelope,
  ErrorReportEnvelopeSchema,
  type ErrorReportQueueStore,
  errorReportGroupKey,
  type PersistedErrorReportQueueEntry,
  PRODUCT_ERROR_REPORTS_ENDPOINT,
  serializedErrorReportBytes,
  type TelemetryEnvelopeFacts,
} from '../../src/telemetry';

const NOW = 1_760_000_000_000;
const SESSION_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';
const FACTS: TelemetryEnvelopeFacts = {
  channel: 'chrome-store',
  appVersion: { year: 2026, month: 10, patch: 2 },
  locale: 'fr',
  platform: 'mac',
  arch: 'arm64',
  browser: 'chrome',
  osVersion: 26,
  browserVersion: 141,
};

function makeReport(overrides: Partial<ErrorReport> = {}): ErrorReport {
  return {
    kind: 'render-error',
    process: 'popup',
    errorName: 'TypeError',
    template: 'not-a-function',
    frames: [{ file: 'popup.js', line: 1, col: 1, fn: 'render' }],
    fingerprint: '0123456789abcdef',
    count: 1,
    ...overrides,
  };
}

function fingerprint(n: number): string {
  return n.toString(16).padStart(16, '0');
}

function makeTransport(overrides: Partial<{ result: boolean; error: Error }> = {}) {
  const sent: ErrorReportEnvelope[] = [];
  return {
    sent,
    async send(envelope: ErrorReportEnvelope): Promise<boolean> {
      if (overrides.error) throw overrides.error;
      sent.push(envelope);
      return overrides.result ?? true;
    },
  };
}

function makeQueueStore(initial: PersistedErrorReportQueueEntry[] | null = null) {
  const saves: PersistedErrorReportQueueEntry[][] = [];
  const store: ErrorReportQueueStore = {
    load: async () => initial,
    save: async (entries) => {
      saves.push([...entries]);
    },
  };
  return { store, saves };
}

function makeClient(
  overrides: Partial<{
    result: boolean;
    error: Error;
    queueStore: ErrorReportQueueStore;
    sessionStartedAt: number;
  }> = {},
) {
  const transport = makeTransport(overrides);
  let clock = NOW;
  const client = new ErrorReportClient({
    transport,
    host: 'extension',
    facts: () => FACTS,
    now: () => clock++,
    sessionId: SESSION_ID,
    sessionStartedAt: overrides.sessionStartedAt ?? NOW,
    queueStore: overrides.queueStore,
  });
  return { client, transport };
}

const flushed = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('PRODUCT_ERROR_REPORTS_ENDPOINT', () => {
  it('is the errors route beside the usage and uninstall routes', () => {
    expect(PRODUCT_ERROR_REPORTS_ENDPOINT).toBe('https://telemetry.openheaders.com/v1/errors');
  });
});

describe('ErrorReportClient — report', () => {
  it('queues and logs a report as pending', () => {
    const { client } = makeClient();
    expect(client.report(makeReport())).toBe('pending');
    expect(client.queuedCount).toBe(1);
    expect(client.readLog()).toEqual([{ report: makeReport(), at: NOW, disposition: 'pending' }]);
  });

  it('folds a repeat of a pending group into its count — one entry, no second queue slot (law 7)', () => {
    const { client } = makeClient();
    client.report(makeReport());
    expect(client.report(makeReport({ count: 2 }))).toBe('pending');
    expect(client.hasPending(makeReport())).toBe(true);
    expect(client.queuedCount).toBe(1);
    const log = client.readLog();
    expect(log).toHaveLength(1);
    expect(log[0].report.count).toBe(3);
  });

  it('keys the fold on the fingerprint AND the process and surface — one group seen in two places is two rows (S8)', () => {
    const { client } = makeClient();
    client.report(makeReport({ surface: 'request-edit' }));
    client.report(makeReport({ surface: 'http-rules' }));
    client.report(makeReport({ process: 'sidepanel', surface: 'request-edit' }));
    client.report(makeReport({ surface: 'request-edit' }));
    expect(client.queuedCount).toBe(3);
    expect(client.hasPending(makeReport({ surface: 'request-edit' }))).toBe(true);
    expect(client.hasPending(makeReport({ process: 'renderer', surface: 'request-edit' }))).toBe(false);
    expect(client.readLog().map((e) => [e.report.process, e.report.surface, e.report.count])).toEqual([
      ['popup', 'request-edit', 2],
      ['popup', 'http-rules', 1],
      ['sidepanel', 'request-edit', 1],
    ]);
    expect(errorReportGroupKey(makeReport())).toBe('0123456789abcdef:popup:');
    expect(errorReportGroupKey(makeReport({ surface: 'vault' }))).toBe('0123456789abcdef:popup:vault');
  });

  it('logs a report suppressed while the channel is off and never queues it', () => {
    const { client } = makeClient();
    client.setEnabled(false);
    expect(client.report(makeReport())).toBe('suppressed');
    expect(client.queuedCount).toBe(0);
    expect(client.readLog()[0].disposition).toBe('suppressed');
  });

  it('drops and logs a report over the serialized budget rather than truncating it (law 7)', () => {
    const { client } = makeClient();
    const huge = makeReport({
      frames: Array.from({ length: 20 }, () => ({
        file: `${'w'.repeat(80)}.js`,
        line: 123456,
        col: 123456,
        fn: 'f'.repeat(64),
      })),
      componentStack: Array.from({ length: 16 }, () => 'C'.repeat(64)),
    });
    expect(serializedErrorReportBytes(huge)).toBeGreaterThan(ERROR_REPORT_MAX_BYTES);
    expect(client.report(huge)).toBe('dropped');
    expect(client.queuedCount).toBe(0);
    expect(client.readLog()[0].disposition).toBe('dropped');
  });

  it('refuses on the controller’s word with the given disposition, logged only', () => {
    const { client } = makeClient();
    expect(client.refuse(makeReport(), 'suppressed')).toBe('suppressed');
    expect(client.refuse(makeReport(), 'dropped')).toBe('dropped');
    expect(client.queuedCount).toBe(0);
    expect(client.readLog().map((e) => e.disposition)).toEqual(['suppressed', 'dropped']);
  });

  it('turning the channel off holds the pending queue: still pending, never sent, delivered when on again', async () => {
    const { client, transport } = makeClient();
    client.report(makeReport());
    client.setEnabled(false);
    expect(client.queuedCount).toBe(1);
    expect(client.readLog()[0].disposition).toBe('pending');
    expect(await client.flush()).toEqual([]);
    expect(client.report(makeReport())).toBe('suppressed');
    expect(client.queuedCount).toBe(1);
    client.setEnabled(true);
    expect(await client.flush()).toHaveLength(1);
    expect(transport.sent[0].reports[0].count).toBe(1);
    expect(client.readLog().map((e) => e.disposition)).toEqual(['sent', 'suppressed']);
  });

  it('caps the queue (oldest dropped) and the log', () => {
    const { client } = makeClient();
    for (let i = 0; i < ERROR_REPORT_MAX_QUEUE + 5; i++) client.report(makeReport({ fingerprint: fingerprint(i) }));
    expect(client.queuedCount).toBe(ERROR_REPORT_MAX_QUEUE);
    expect(client.readLog().filter((e) => e.disposition === 'dropped')).toHaveLength(5);
    for (let i = 0; i < ERROR_REPORT_MAX_LOG * 2; i++) client.refuse(makeReport(), 'suppressed');
    expect(client.readLog()).toHaveLength(ERROR_REPORT_MAX_LOG);
  });
});

describe('ErrorReportClient — flush', () => {
  it('sends one envelope the schema accepts, with the shared session and no install identity (law 1)', async () => {
    const { client, transport } = makeClient();
    client.report(makeReport());
    const sent = await client.flush();
    expect(sent).toEqual([makeReport()]);
    expect(transport.sent).toHaveLength(1);
    const envelope = transport.sent[0];
    expect(v.safeParse(ErrorReportEnvelopeSchema, envelope).success).toBe(true);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      host: 'extension',
      channel: 'chrome-store',
      appVersion: FACTS.appVersion,
      platform: 'mac',
      arch: 'arm64',
      browser: 'chrome',
      locale: 'fr',
      osVersion: 26,
      browserVersion: 141,
      sessionId: SESSION_ID,
      sessionAge: '0-9m',
      reports: [makeReport()],
    });
    expect(envelope).not.toHaveProperty('installId');
    expect(envelope).not.toHaveProperty('sinceInstall');
    expect(client.readLog()[0].disposition).toBe('sent');
  });

  it('carries at most ten reports per envelope; the rest ride the next flush (law 7)', async () => {
    const { client, transport } = makeClient();
    for (let i = 0; i < 13; i++) client.report(makeReport({ fingerprint: fingerprint(i) }));
    expect(await client.flush()).toHaveLength(ERROR_REPORT_MAX_PER_ENVELOPE);
    expect(client.queuedCount).toBe(3);
    expect(await client.flush()).toHaveLength(3);
    expect(transport.sent.map((e) => e.reports.length)).toEqual([10, 3]);
  });

  it('resolves empty and requeues at the front when the transport refuses or throws', async () => {
    const refused = makeClient({ result: false });
    refused.client.report(makeReport());
    expect(await refused.client.flush()).toEqual([]);
    expect(refused.client.queuedCount).toBe(1);
    expect(refused.client.readLog()[0].disposition).toBe('pending');

    const thrown = makeClient({ error: new Error('offline') });
    thrown.client.report(makeReport({ fingerprint: fingerprint(1) }));
    thrown.client.report(makeReport({ fingerprint: fingerprint(2) }));
    expect(await thrown.client.flush()).toEqual([]);
    expect(thrown.client.queuedCount).toBe(2);
  });

  it('resolves empty with nothing pending, while off, and while a flush is in flight', async () => {
    const { client } = makeClient();
    expect(await client.flush()).toEqual([]);
    client.report(makeReport());
    client.setEnabled(false);
    expect(await client.flush()).toEqual([]);
    client.setEnabled(true);
    client.report(makeReport());
    const [first, second] = await Promise.all([client.flush(), client.flush()]);
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
  });
});

describe('ErrorReportClient — durable queue', () => {
  it('mirrors every queue mutation into the store and leaves the held queue there on toggle-off', async () => {
    const { store, saves } = makeQueueStore();
    const { client } = makeClient({ queueStore: store });
    client.report(makeReport());
    client.report(makeReport());
    await flushed();
    expect(saves).toHaveLength(2);
    expect(saves[1]).toEqual([{ report: makeReport({ count: 2 }), at: NOW }]);
    client.setEnabled(false);
    await flushed();
    expect(saves).toHaveLength(2);
  });

  it('leaves the batch in the store until the transport accepts it', async () => {
    const { store, saves } = makeQueueStore();
    const { client } = makeClient({ queueStore: store, result: false });
    client.report(makeReport());
    await client.flush();
    await flushed();
    expect(saves[saves.length - 1]).toHaveLength(1);
  });

  it('restores a persisted queue at boot with its timestamps, held pending while the channel is off', async () => {
    const persisted = [{ report: makeReport(), at: NOW - 5000 }];
    const on = makeClient({ queueStore: makeQueueStore(persisted).store });
    await on.client.restoreQueue();
    expect(on.client.queuedCount).toBe(1);
    expect(on.client.readLog()).toEqual([{ report: makeReport(), at: NOW - 5000, disposition: 'pending' }]);

    const off = makeClient({ queueStore: makeQueueStore(persisted).store });
    off.client.setEnabled(false);
    await off.client.restoreQueue();
    expect(off.client.queuedCount).toBe(1);
    expect(off.client.readLog()[0].disposition).toBe('pending');
    expect(await off.client.flush()).toEqual([]);
  });

  it('is a no-op without a store and silent when the store fails to load', async () => {
    const { client } = makeClient();
    await expect(client.restoreQueue()).resolves.toBeUndefined();
    const failing: ErrorReportQueueStore = {
      load: async () => {
        throw new Error('corrupt');
      },
      save: async () => undefined,
    };
    const broken = makeClient({ queueStore: failing });
    await expect(broken.client.restoreQueue()).resolves.toBeUndefined();
    expect(broken.client.queuedCount).toBe(0);
  });
});
