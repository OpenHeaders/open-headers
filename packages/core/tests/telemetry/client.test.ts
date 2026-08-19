import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  buildTelemetryUninstallUrl,
  mintTelemetryInstallId,
  mintTelemetrySessionId,
  type PersistedTelemetryQueueEntry,
  TELEMETRY_MAX_LOG,
  TELEMETRY_MAX_QUEUE,
  TELEMETRY_SCHEMA_VERSION,
  TelemetryClient,
  type TelemetryEnvelope,
  type TelemetryEnvelopeFacts,
  TelemetryEnvelopeSchema,
  type TelemetryEvent,
  type TelemetryInstallContext,
  type TelemetryQueueStore,
} from '../../src/telemetry';

const NOW = 1_760_000_000_000;
const INSTALL: TelemetryInstallContext = { installId: 'feedface00feedface00feedface0000', installedAt: NOW };
const FACTS: TelemetryEnvelopeFacts = {
  channel: 'chrome-store',
  appVersion: { year: 2026, month: 8, patch: 0 },
  locale: 'fr',
  platform: 'mac',
  browser: 'chrome',
};

function makeTransport(overrides: Partial<{ result: boolean; error: Error }> = {}) {
  const sent: TelemetryEnvelope[] = [];
  return {
    sent,
    async send(envelope: TelemetryEnvelope): Promise<boolean> {
      if (overrides.error) throw overrides.error;
      sent.push(envelope);
      return overrides.result ?? true;
    },
  };
}

function makeClient(
  overrides: Partial<{ result: boolean; error: Error; install: TelemetryInstallContext | null }> = {},
) {
  const transport = makeTransport(overrides);
  let clock = NOW;
  const client = new TelemetryClient({
    transport,
    host: 'extension',
    facts: () => FACTS,
    now: () => clock++,
    install: () => (overrides.install === undefined ? INSTALL : overrides.install),
  });
  return { client, transport };
}

function makeEvent(overrides: Partial<Extract<TelemetryEvent, { name: 'import_run' }>> = {}): TelemetryEvent {
  return { name: 'import_run', source: 'insomnia', ok: true, ...overrides };
}

describe('buildTelemetryUninstallUrl', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('carries the install id plus the coarse age bucket and channel', () => {
    expect(buildTelemetryUninstallUrl(INSTALL, 'chrome-store', NOW)).toBe(
      `https://telemetry.openheaders.com/v1/uninstall?i=${INSTALL.installId}&a=0&c=chrome-store`,
    );
  });

  it('rolls the age bucket with the clock — the host re-registers as it changes', () => {
    expect(buildTelemetryUninstallUrl(INSTALL, 'firefox-amo', NOW + 3 * DAY)).toBe(
      `https://telemetry.openheaders.com/v1/uninstall?i=${INSTALL.installId}&a=2-7&c=firefox-amo`,
    );
    expect(buildTelemetryUninstallUrl(INSTALL, 'dev', NOW + 40 * DAY)).toContain('&a=31%2B&c=dev');
  });
});

describe('TelemetryClient — session id', () => {
  it('mints 32 lowercase hex chars', () => {
    expect(mintTelemetrySessionId()).toMatch(/^[0-9a-f]{32}$/);
    expect(mintTelemetryInstallId()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('mints a fresh id per construction', () => {
    const { client: a } = makeClient();
    const { client: b } = makeClient();
    expect(a.sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  it('carries an injected session id onto the envelope', async () => {
    const transport = makeTransport();
    const injected = 'deadbeefdeadbeefdeadbeefdeadbeef';
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      sessionId: injected,
    });
    client.track(makeEvent());
    await client.flush();
    expect(client.sessionId).toBe(injected);
    expect(transport.sent[0].sessionId).toBe(injected);
  });
});

describe('TelemetryClient — install identity on the envelope', () => {
  it('stamps the install id and a day-0 sinceInstall bucket at flush time', async () => {
    const { client, transport } = makeClient();
    client.track(makeEvent());
    await client.flush();
    expect(transport.sent[0].installId).toBe(INSTALL.installId);
    expect(transport.sent[0].sinceInstall).toBe('0');
  });

  it('buckets an older install coarsely, never as a day count', async () => {
    const transport = makeTransport();
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => ({ installId: INSTALL.installId, installedAt: NOW - 12 * 24 * 60 * 60 * 1000 }),
    });
    client.track(makeEvent());
    await client.flush();
    expect(transport.sent[0].sinceInstall).toBe('8-30');
  });

  it('re-reads the install context per flush so a re-minted identity re-stamps the next envelope', async () => {
    const transport = makeTransport();
    let installId = INSTALL.installId;
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => ({ installId, installedAt: NOW }),
    });
    client.track(makeEvent());
    await client.flush();
    installId = mintTelemetryInstallId();
    client.track(makeEvent());
    await client.flush();
    expect(transport.sent[0].installId).toBe(INSTALL.installId);
    expect(transport.sent[1].installId).toBe(installId);
  });

  it('flushes nothing without an install identity and keeps the batch pending', async () => {
    const { client, transport } = makeClient({ install: null });
    client.track(makeEvent());
    expect(await client.flush()).toBe(false);
    expect(transport.sent).toEqual([]);
    expect(client.queuedCount).toBe(1);
  });
});

describe('TelemetryClient — queueing', () => {
  it('queues on track and marks the entry sent after a flush', async () => {
    const { client, transport } = makeClient();
    client.track(makeEvent());
    expect(client.queuedCount).toBe(1);
    expect(await client.flush()).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(client.readEventLog()[0].disposition).toBe('sent');
  });
});

describe('TelemetryClient — batching and envelope shape', () => {
  it('delivers all pending events as one schema-valid envelope', async () => {
    const { client, transport } = makeClient();
    const events: TelemetryEvent[] = [
      makeEvent(),
      { name: 'feature_used', feature: 'import-hub' },
      { name: 'rule_created', ruleType: 'redirect' },
    ];
    for (const event of events) client.track(event);
    await client.flush();
    expect(transport.sent).toHaveLength(1);
    const envelope = transport.sent[0];
    expect(envelope.schemaVersion).toBe(TELEMETRY_SCHEMA_VERSION);
    expect(envelope.host).toBe('extension');
    expect(envelope.sessionId).toBe(client.sessionId);
    expect(envelope.events).toEqual(events);
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(true);
    expect(client.queuedCount).toBe(0);
  });

  it('stamps the per-process facts on the envelope — every row is segmentable without joins', async () => {
    const { client, transport } = makeClient();
    client.track(makeEvent());
    await client.flush();
    const envelope = transport.sent[0];
    expect(envelope.channel).toBe('chrome-store');
    expect(envelope.appVersion).toEqual({ year: 2026, month: 8, patch: 0 });
    expect(envelope.locale).toBe('fr');
    expect(envelope.platform).toBe('mac');
    expect(envelope.browser).toBe('chrome');
  });

  it('omits the optional facts a host cannot state (unmappable platform, no browser)', async () => {
    const transport = makeTransport();
    const client = new TelemetryClient({
      transport,
      host: 'cli',
      facts: () => ({ channel: 'brew', appVersion: { year: 2026, month: 8, patch: 0 }, locale: 'en' }),
      now: () => NOW,
      install: () => INSTALL,
    });
    client.track(makeEvent());
    await client.flush();
    const envelope = transport.sent[0];
    expect('platform' in envelope).toBe(false);
    expect('browser' in envelope).toBe(false);
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(true);
  });

  it('stamps the coarse sessionAge bucket from the session start time at flush', async () => {
    const transport = makeTransport();
    const twoHours = 2 * 60 * 60 * 1000;
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      sessionStartedAt: NOW - twoHours,
    });
    client.track(makeEvent());
    await client.flush();
    const envelope = transport.sent[0];
    expect(envelope.sessionAge).toBe('1-8h');
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(true);
  });

  it('omits sessionAge when no session start time was injected', async () => {
    const { client, transport } = makeClient();
    client.track(makeEvent());
    await client.flush();
    expect('sessionAge' in transport.sent[0]).toBe(false);
  });

  it('re-reads the facts per flush so a locale switch re-stamps the next envelope', async () => {
    const transport = makeTransport();
    let locale: TelemetryEnvelopeFacts['locale'] = 'en';
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => ({ ...FACTS, locale }),
      now: () => NOW,
      install: () => INSTALL,
    });
    client.track(makeEvent());
    await client.flush();
    locale = 'de';
    client.track(makeEvent());
    await client.flush();
    expect(transport.sent.map((envelope) => envelope.locale)).toEqual(['en', 'de']);
  });

  it('sends nothing when the queue is empty', async () => {
    const { client, transport } = makeClient();
    expect(await client.flush()).toBe(false);
    expect(transport.sent).toEqual([]);
  });
});

describe('TelemetryClient — failure is silent, batch rides the next flush', () => {
  it('requeues on a transport rejection (false)', async () => {
    const { client } = makeClient({ result: false });
    client.track(makeEvent());
    expect(await client.flush()).toBe(false);
    expect(client.queuedCount).toBe(1);
    expect(client.readEventLog()[0].disposition).toBe('pending');
  });

  it('requeues on a transport throw without rejecting the flush', async () => {
    const { client } = makeClient({ error: new Error('offline') });
    client.track(makeEvent());
    await expect(client.flush()).resolves.toBe(false);
    expect(client.queuedCount).toBe(1);
  });

  it('delivers the ridden batch once the transport recovers', async () => {
    const transport = makeTransport();
    let failNext = true;
    const client = new TelemetryClient({
      transport: {
        async send(envelope) {
          if (failNext) return false;
          return transport.send(envelope);
        },
      },
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
    });
    client.track(makeEvent());
    await client.flush();
    failNext = false;
    client.track({ name: 'workflow_run', ok: true });
    await client.flush();
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].events).toHaveLength(2);
  });
});

describe('TelemetryClient — hard caps', () => {
  it('caps the queue and marks the overflow dropped, oldest first', () => {
    const { client } = makeClient();
    for (let i = 0; i < TELEMETRY_MAX_QUEUE + 10; i++) client.track(makeEvent({ ok: i % 2 === 0 }));
    expect(client.queuedCount).toBe(TELEMETRY_MAX_QUEUE);
    const log = client.readEventLog();
    expect(log.filter((entry) => entry.disposition === 'dropped')).toHaveLength(10);
    expect(log[0].disposition).toBe('dropped');
  });

  it('caps the session log, oldest first', () => {
    const { client } = makeClient();
    for (let i = 0; i < TELEMETRY_MAX_LOG + 25; i++) client.track(makeEvent());
    expect(client.readEventLog()).toHaveLength(TELEMETRY_MAX_LOG);
  });
});

function makeQueueStore(initial: PersistedTelemetryQueueEntry[] | null = null) {
  const state = { entries: initial };
  const store: TelemetryQueueStore = {
    load: async () => state.entries,
    save: async (entries) => {
      state.entries = [...entries];
    },
  };
  return { store, state };
}

/** The client persists fire-and-forget on a chained promise; settle the microtask/timer queue before asserting. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('TelemetryClient — durable queue store', () => {
  it('mirrors pending entries into the store on track and wipes it after an accepted flush', async () => {
    const transport = makeTransport();
    const { store, state } = makeQueueStore();
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      queueStore: store,
    });
    client.track(makeEvent());
    await settle();
    expect(state.entries).toEqual([{ event: makeEvent(), at: NOW }]);
    await client.flush();
    await settle();
    expect(state.entries).toEqual([]);
    expect(transport.sent).toHaveLength(1);
  });

  it('keeps a failed batch in the store so a process death never loses it', async () => {
    const { store, state } = makeQueueStore();
    const client = new TelemetryClient({
      transport: { send: async () => false },
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      queueStore: store,
    });
    client.track(makeEvent());
    await client.flush();
    await settle();
    expect(state.entries).toEqual([{ event: makeEvent(), at: NOW }]);
  });

  it('restores persisted entries as pending: they re-enter the log with their original time and ride the next flush', async () => {
    const transport = makeTransport();
    const persisted: PersistedTelemetryQueueEntry[] = [
      { event: { name: 'first_run', channel: 'chrome-store' }, at: NOW - 5000 },
      { event: makeEvent(), at: NOW - 4000 },
    ];
    const { store } = makeQueueStore(persisted);
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      queueStore: store,
    });
    await client.restoreQueue();
    expect(client.queuedCount).toBe(2);
    expect(client.readEventLog().map((entry) => entry.at)).toEqual([NOW - 5000, NOW - 4000]);
    await client.flush();
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].events).toEqual(persisted.map((entry) => entry.event));
  });

  it('restores ahead of events tracked in the new process life', async () => {
    const transport = makeTransport();
    const { store } = makeQueueStore([{ event: makeEvent(), at: NOW - 5000 }]);
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      queueStore: store,
    });
    client.track({ name: 'workflow_run', ok: true });
    await client.restoreQueue();
    await client.flush();
    expect(transport.sent[0].events).toEqual([makeEvent(), { name: 'workflow_run', ok: true }]);
  });

  it('surfaces a restored queue as suppressed while disabled and wipes the store — off means off', async () => {
    const transport = makeTransport();
    const { store, state } = makeQueueStore([{ event: makeEvent(), at: NOW - 5000 }]);
    const client = new TelemetryClient({
      transport,
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      queueStore: store,
    });
    client.setEnabled(false);
    await client.restoreQueue();
    await settle();
    expect(client.queuedCount).toBe(0);
    expect(client.readEventLog()).toHaveLength(1);
    expect(client.readEventLog()[0].disposition).toBe('suppressed');
    expect(state.entries).toEqual([]);
    expect(await client.flush()).toBe(false);
    expect(transport.sent).toEqual([]);
  });

  it('wipes the store when the toggle turns off with events pending', async () => {
    const { store, state } = makeQueueStore();
    const client = new TelemetryClient({
      transport: makeTransport(),
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      queueStore: store,
    });
    client.track(makeEvent());
    client.setEnabled(false);
    await settle();
    expect(state.entries).toEqual([]);
  });

  it('ignores a store that fails to load and stays silent', async () => {
    const client = new TelemetryClient({
      transport: makeTransport(),
      host: 'extension',
      facts: () => FACTS,
      now: () => NOW,
      install: () => INSTALL,
      queueStore: {
        load: async () => {
          throw new Error('storage gone');
        },
        save: async () => undefined,
      },
    });
    await expect(client.restoreQueue()).resolves.toBeUndefined();
    expect(client.queuedCount).toBe(0);
  });

  it('is a no-op without a queue store', async () => {
    const { client } = makeClient();
    await expect(client.restoreQueue()).resolves.toBeUndefined();
  });
});

describe('TelemetryClient — the one-switch toggle', () => {
  it('disabled: track() still logs would-be events but nothing queues or sends', async () => {
    const { client, transport } = makeClient();
    client.setEnabled(false);
    client.track(makeEvent());
    expect(client.queuedCount).toBe(0);
    expect(await client.flush()).toBe(false);
    expect(transport.sent).toEqual([]);
    expect(client.readEventLog()).toHaveLength(1);
    expect(client.readEventLog()[0].disposition).toBe('suppressed');
  });

  it('turning off suppresses the pending queue completely', () => {
    const { client } = makeClient();
    client.track(makeEvent());
    client.track(makeEvent());
    client.setEnabled(false);
    expect(client.queuedCount).toBe(0);
    expect(client.readEventLog().every((entry) => entry.disposition === 'suppressed')).toBe(true);
  });

  it('re-enabling resumes delivery for later events only', async () => {
    const { client, transport } = makeClient();
    client.setEnabled(false);
    client.track(makeEvent());
    client.setEnabled(true);
    client.track({ name: 'error_beacon', code: 'sync-push-failed' });
    await client.flush();
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].events).toEqual([{ name: 'error_beacon', code: 'sync-push-failed' }]);
  });
});
