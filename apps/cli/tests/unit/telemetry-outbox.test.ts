/**
 * The telemetry outbox (the v2 plan, Session 5) — sealed bodies on
 * disk between invocations: the file's shape and mode, the cap, the
 * drain's order and its stop at the first incomplete delivery, the
 * attempts ceiling, the per-channel discard, and the production wire's
 * reading of what the worker answered.
 */

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDeliveryCircuit,
  createFetchWire,
  createSpoolingTransport,
  openTelemetryOutbox,
  parseTelemetryOutbox,
  serializeTelemetryOutbox,
  TELEMETRY_OUTBOX_MAX_ATTEMPTS,
  TELEMETRY_OUTBOX_MAX_ENTRIES,
  type TelemetryDelivery,
  type TelemetryWire,
  telemetryOutboxPath,
} from '../../src/telemetry-outbox';

let dir: string;
let filePath: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-outbox-'));
  filePath = path.join(dir, 'openheaders', 'telemetry-outbox.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function recordingWire(answers: TelemetryDelivery[]): { wire: TelemetryWire; bodies: string[] } {
  const bodies: string[] = [];
  return {
    bodies,
    wire: {
      async deliver(body) {
        bodies.push(body);
        return answers.shift() ?? 'delivered';
      },
    },
  };
}

describe('the outbox file', () => {
  it('lives beside the config file', () => {
    expect(telemetryOutboxPath(path.join('/home', 'oh', '.config', 'openheaders', 'cli.json'))).toBe(
      path.join('/home', 'oh', '.config', 'openheaders', 'telemetry-outbox.json'),
    );
  });

  it('round-trips entries, reads a malformed file as empty and leaves an unreadable entry out', () => {
    const entries = [
      { channel: 'usage' as const, body: '{"a":1}', attempts: 2 },
      { channel: 'errors' as const, body: '{"b":2}', attempts: 0 },
    ];
    expect(parseTelemetryOutbox(serializeTelemetryOutbox(entries))).toEqual(entries);
    expect(parseTelemetryOutbox('not json')).toEqual([]);
    expect(parseTelemetryOutbox('[]')).toEqual([]);
    expect(parseTelemetryOutbox(JSON.stringify({ version: 2, entries }))).toEqual([]);
    expect(
      parseTelemetryOutbox(
        JSON.stringify({
          version: 1,
          entries: [
            { channel: 'other', body: '{}' },
            { channel: 'usage', body: 7 },
            { channel: 'usage', body: '{}' },
            'x',
          ],
        }),
      ),
    ).toEqual([{ channel: 'usage', body: '{}', attempts: 0 }]);
  });

  it('is written 0600 through a rename, holds the newest entries up to the cap, and is removed when empty', async () => {
    const outbox = await openTelemetryOutbox(filePath);
    for (let i = 0; i < TELEMETRY_OUTBOX_MAX_ENTRIES + 2; i += 1) outbox.put('usage', `{"n":${i}}`);
    await outbox.settle();
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    const entries = parseTelemetryOutbox(await readFile(filePath, 'utf8'));
    expect(entries).toHaveLength(TELEMETRY_OUTBOX_MAX_ENTRIES);
    expect(entries[0].body).toBe('{"n":2}');
    expect(entries[entries.length - 1].body).toBe(`{"n":${TELEMETRY_OUTBOX_MAX_ENTRIES + 1}}`);
    outbox.discard('usage');
    await outbox.settle();
    await expect(readFile(filePath, 'utf8')).rejects.toThrow();
  });

  it('opens a missing file as empty and a corrupt one as empty, without writing anything', async () => {
    expect((await openTelemetryOutbox(filePath)).entries('usage')).toEqual([]);
    await expect(readFile(filePath, 'utf8')).rejects.toThrow();
    await writeFile(path.join(dir, 'corrupt.json'), '{');
    const outbox = await openTelemetryOutbox(path.join(dir, 'corrupt.json'));
    expect(outbox.entries('usage')).toEqual([]);
    await outbox.settle();
    expect(await readFile(path.join(dir, 'corrupt.json'), 'utf8')).toBe('{');
  });
});

describe('the drain', () => {
  it('delivers oldest first, usage before errors, and drops what the worker took or refused', async () => {
    const outbox = await openTelemetryOutbox(filePath);
    outbox.put('errors', 'e1');
    outbox.put('usage', 'u1');
    outbox.put('usage', 'u2');
    const usage = recordingWire(['delivered', 'rejected']);
    const errors = recordingWire(['delivered']);
    const circuit = createDeliveryCircuit();
    await outbox.drain({ usage: usage.wire, errors: errors.wire }, circuit);
    expect(circuit.down).toBe(false);
    expect(usage.bodies).toEqual(['u1', 'u2']);
    expect(errors.bodies).toEqual(['e1']);
    expect(outbox.entries('usage')).toEqual([]);
    expect(outbox.entries('errors')).toEqual([]);
    await outbox.settle();
    await expect(readFile(filePath, 'utf8')).rejects.toThrow();
  });

  it('opens the circuit at the first incomplete delivery and stops across both channels, counting one attempt', async () => {
    const outbox = await openTelemetryOutbox(filePath);
    outbox.put('usage', 'u1');
    outbox.put('usage', 'u2');
    outbox.put('errors', 'e1');
    const usage = recordingWire(['undelivered']);
    const errors = recordingWire([]);
    const circuit = createDeliveryCircuit();
    await outbox.drain({ usage: usage.wire, errors: errors.wire }, circuit);
    expect(circuit.down).toBe(true);
    expect(usage.bodies).toEqual(['u1']);
    expect(errors.bodies).toEqual([]);
    await outbox.drain({ usage: usage.wire, errors: errors.wire }, circuit);
    expect(usage.bodies).toEqual(['u1']);
    expect(outbox.entries('usage').map((entry) => [entry.body, entry.attempts])).toEqual([
      ['u1', 1],
      ['u2', 0],
    ]);
    expect(outbox.entries('errors')).toHaveLength(1);
    await outbox.settle();
  });

  it('leaves a channel with no wire alone and drops an entry at the attempts ceiling', async () => {
    const outbox = await openTelemetryOutbox(filePath);
    outbox.put('usage', 'u1');
    outbox.put('errors', 'e1');
    for (let i = 0; i < TELEMETRY_OUTBOX_MAX_ATTEMPTS - 1; i += 1) {
      await outbox.drain({ usage: recordingWire(['undelivered']).wire }, createDeliveryCircuit());
    }
    expect(outbox.entries('usage')[0].attempts).toBe(TELEMETRY_OUTBOX_MAX_ATTEMPTS - 1);
    await outbox.drain({ usage: recordingWire(['undelivered']).wire }, createDeliveryCircuit());
    expect(outbox.entries('usage')).toEqual([]);
    expect(outbox.entries('errors')).toHaveLength(1);
    await outbox.settle();
    expect(parseTelemetryOutbox(await readFile(filePath, 'utf8')).map((entry) => entry.channel)).toEqual(['errors']);
  });
});

describe('the spooling transport', () => {
  it('seals only what the wire did not take, and settles every fate for the controller', async () => {
    const outbox = await openTelemetryOutbox(filePath);
    const wire = recordingWire(['delivered', 'rejected', 'delivered']);
    const transport = createSpoolingTransport<{ n: number }>(outbox, 'usage', wire.wire, createDeliveryCircuit());
    expect(await transport.send({ n: 1 })).toBe(true);
    expect(await transport.send({ n: 2 })).toBe(true);
    expect(await transport.send({ n: 3 })).toBe(true);
    expect(outbox.entries('usage')).toEqual([]);
    const circuit = createDeliveryCircuit();
    const throwing = createSpoolingTransport<{ n: number }>(
      outbox,
      'errors',
      {
        async deliver() {
          throw new Error('offline');
        },
      },
      circuit,
    );
    expect(await throwing.send({ n: 4 })).toBe(true);
    expect(circuit.down).toBe(true);
    expect(outbox.entries('errors').map((entry) => entry.body)).toEqual(['{"n":4}']);
    await outbox.settle();
  });

  it('seals without trying once the circuit is open, on either channel', async () => {
    const outbox = await openTelemetryOutbox(filePath);
    const circuit = createDeliveryCircuit();
    const usage = recordingWire(['undelivered']);
    const errors = recordingWire([]);
    const usageTransport = createSpoolingTransport<{ n: number }>(outbox, 'usage', usage.wire, circuit);
    const errorTransport = createSpoolingTransport<{ n: number }>(outbox, 'errors', errors.wire, circuit);
    expect(await usageTransport.send({ n: 1 })).toBe(true);
    expect(await usageTransport.send({ n: 2 })).toBe(true);
    expect(await errorTransport.send({ n: 3 })).toBe(true);
    expect(usage.bodies).toEqual(['{"n":1}']);
    expect(errors.bodies).toEqual([]);
    expect(outbox.entries('usage').map((entry) => entry.body)).toEqual(['{"n":1}', '{"n":2}']);
    expect(outbox.entries('errors').map((entry) => entry.body)).toEqual(['{"n":3}']);
    await outbox.settle();
  });
});

describe('the fetch wire', () => {
  const answering =
    (status: number): typeof fetch =>
    async () =>
      new Response(null, { status });

  it('reads a 2xx as delivered, a refusing 4xx as rejected, and a 5xx, 408 or 429 as unknown', async () => {
    const endpoint = 'https://telemetry.openheaders.io/v1/events';
    expect(await createFetchWire(endpoint, 50, answering(202)).deliver('{}')).toBe('delivered');
    expect(await createFetchWire(endpoint, 50, answering(400)).deliver('{}')).toBe('rejected');
    expect(await createFetchWire(endpoint, 50, answering(413)).deliver('{}')).toBe('rejected');
    expect(await createFetchWire(endpoint, 50, answering(408)).deliver('{}')).toBe('undelivered');
    expect(await createFetchWire(endpoint, 50, answering(429)).deliver('{}')).toBe('undelivered');
    expect(await createFetchWire(endpoint, 50, answering(503)).deliver('{}')).toBe('undelivered');
  });

  it('posts the body as JSON and reads a network error or the abort cap as unknown', async () => {
    const seen: { url: string; init: RequestInit | undefined }[] = [];
    const slow: typeof fetch = (url, init) => {
      seen.push({ url: String(url), init });
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    };
    expect(await createFetchWire('https://telemetry.openheaders.io/v1/events', 20, slow).deliver('{"a":1}')).toBe(
      'undelivered',
    );
    expect(seen[0].url).toBe('https://telemetry.openheaders.io/v1/events');
    expect(seen[0].init?.method).toBe('POST');
    expect(seen[0].init?.body).toBe('{"a":1}');
    const failing: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await createFetchWire('https://telemetry.openheaders.io/v1/events', 20, failing).deliver('{}')).toBe(
      'undelivered',
    );
  });
});
