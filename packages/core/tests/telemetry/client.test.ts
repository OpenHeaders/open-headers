import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  mintTelemetrySessionId,
  TELEMETRY_MAX_LOG,
  TELEMETRY_MAX_QUEUE,
  TELEMETRY_SCHEMA_VERSION,
  TelemetryClient,
  type TelemetryEnvelope,
  TelemetryEnvelopeSchema,
  type TelemetryEvent,
} from '../../src/telemetry';

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

function makeClient(overrides: Partial<{ result: boolean; error: Error }> = {}) {
  const transport = makeTransport(overrides);
  let clock = 1_760_000_000_000;
  const client = new TelemetryClient({ transport, now: () => clock++ });
  return { client, transport };
}

function makeEvent(overrides: Partial<Extract<TelemetryEvent, { name: 'import_run' }>> = {}): TelemetryEvent {
  return { name: 'import_run', source: 'insomnia', ok: true, ...overrides };
}

function makeDisclosedClient(overrides: Partial<{ result: boolean; error: Error }> = {}) {
  const made = makeClient(overrides);
  made.client.noteDisclosureShown();
  return made;
}

describe('TelemetryClient — session id', () => {
  it('mints 32 lowercase hex chars', () => {
    expect(mintTelemetrySessionId()).toMatch(/^[0-9a-f]{32}$/);
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
    const client = new TelemetryClient({ transport, now: () => 1_760_000_000_000, sessionId: injected });
    client.noteDisclosureShown();
    client.track(makeEvent());
    await client.flush();
    expect(client.sessionId).toBe(injected);
    expect(transport.sent[0].sessionId).toBe(injected);
  });
});

describe('TelemetryClient — disclosure latch', () => {
  it('never queues or sends before the disclosure has been shown', async () => {
    const { client, transport } = makeClient();
    client.track(makeEvent());
    expect(client.queuedCount).toBe(0);
    expect(await client.flush()).toBe(false);
    expect(transport.sent).toEqual([]);
    expect(client.readEventLog()).toHaveLength(1);
    expect(client.readEventLog()[0].disposition).toBe('suppressed');
  });

  it('queues and sends after the disclosure has been shown', async () => {
    const { client, transport } = makeDisclosedClient();
    client.track(makeEvent());
    expect(client.queuedCount).toBe(1);
    expect(await client.flush()).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(client.readEventLog()[0].disposition).toBe('sent');
  });
});

describe('TelemetryClient — batching and envelope shape', () => {
  it('delivers all pending events as one schema-valid envelope', async () => {
    const { client, transport } = makeDisclosedClient();
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
    expect(envelope.sessionId).toBe(client.sessionId);
    expect(envelope.events).toEqual(events);
    expect(v.safeParse(TelemetryEnvelopeSchema, envelope).success).toBe(true);
    expect(client.queuedCount).toBe(0);
  });

  it('sends nothing when the queue is empty', async () => {
    const { client, transport } = makeDisclosedClient();
    expect(await client.flush()).toBe(false);
    expect(transport.sent).toEqual([]);
  });
});

describe('TelemetryClient — failure is silent, batch rides the next flush', () => {
  it('requeues on a transport rejection (false)', async () => {
    const { client } = makeDisclosedClient({ result: false });
    client.track(makeEvent());
    expect(await client.flush()).toBe(false);
    expect(client.queuedCount).toBe(1);
    expect(client.readEventLog()[0].disposition).toBe('pending');
  });

  it('requeues on a transport throw without rejecting the flush', async () => {
    const { client } = makeDisclosedClient({ error: new Error('offline') });
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
      now: () => 1_760_000_000_000,
    });
    client.noteDisclosureShown();
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
    const { client } = makeDisclosedClient();
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

describe('TelemetryClient — the one-switch toggle', () => {
  it('disabled: track() still logs would-be events but nothing queues or sends', async () => {
    const { client, transport } = makeDisclosedClient();
    client.setEnabled(false);
    client.track(makeEvent());
    expect(client.queuedCount).toBe(0);
    expect(await client.flush()).toBe(false);
    expect(transport.sent).toEqual([]);
    expect(client.readEventLog()).toHaveLength(1);
    expect(client.readEventLog()[0].disposition).toBe('suppressed');
  });

  it('turning off suppresses the pending queue completely', () => {
    const { client } = makeDisclosedClient();
    client.track(makeEvent());
    client.track(makeEvent());
    client.setEnabled(false);
    expect(client.queuedCount).toBe(0);
    expect(client.readEventLog().every((entry) => entry.disposition === 'suppressed')).toBe(true);
  });

  it('re-enabling resumes delivery for later events only', async () => {
    const { client, transport } = makeDisclosedClient();
    client.setEnabled(false);
    client.track(makeEvent());
    client.setEnabled(true);
    client.track({ name: 'error_beacon', code: 'sync-push-failed' });
    await client.flush();
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].events).toEqual([{ name: 'error_beacon', code: 'sync-push-failed' }]);
  });
});
