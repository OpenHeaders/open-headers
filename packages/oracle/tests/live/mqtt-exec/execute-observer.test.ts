/**
 * MQTT executor — the facts a workflow run reads its session through
 * (the workflow runs plan, The model — the MQTT row and "One port for
 * all of them"), against the scripted transport: the ready fact once
 * every open-time SUBSCRIBE is answered, each inbound PUBLISH at the
 * capture point, the end before After close, and a publish that answers
 * at the broker's acknowledgement.
 */

import { decodeMqttPacket, encodeMqttPacket, MQTT_PROTOCOL_VERSIONS, type MqttPacket } from '@openheaders/core/mqtt';
import type { MqttRequest } from '@openheaders/core/types';
import { executeMqttSession } from '@openheaders/oracle/live/mqtt-exec/execute';
import {
  activeMqttSessionPosition,
  closeActiveMqttSession,
  type MqttObservedMessage,
  type MqttSessionObserver,
  publishActiveMqttMessage,
  publishActiveMqttMessageAcked,
} from '@openheaders/oracle/live/mqtt-exec/session-plane';
import {
  type MqttByteTransport,
  type MqttStreamCallbacks,
  MqttTransportError,
} from '@openheaders/oracle/live/mqtt-exec/transport';
import { describe, expect, it } from 'vitest';

function makeMqttRequest(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqtt0001',
    path: 'requests/devices-col1/probe-mqtt1',
    name: 'Probe MQTT',
    url: 'mqtt://broker.openheaders.io:1883',
    clientId: 'probe-1',
    topic: 'devices/dev-1/name',
    payload: '',
    topics: [{ uid: 'row00001', topicFilter: 'devices/dev-1/#' }],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  };
}

function scriptedTransport() {
  const version = MQTT_PROTOCOL_VERSIONS.v5;
  let seenCallbacks: MqttStreamCallbacks | null = null;
  let ended = false;
  const written: MqttPacket[] = [];
  const transport: MqttByteTransport = {
    connect(_request, callbacks, signal) {
      seenCallbacks = callbacks;
      const finish = (): void => {
        if (ended) return;
        ended = true;
        queueMicrotask(() => callbacks.onEnd());
      };
      signal?.addEventListener('abort', finish);
      return {
        write: (bytes) => {
          const decoded = decodeMqttPacket(bytes, version);
          if (!decoded.ok) throw new Error(`client wrote a malformed packet: ${decoded.error}`);
          written.push(decoded.packet);
        },
        end: finish,
      };
    },
  };
  const callbacks = (): MqttStreamCallbacks => {
    if (seenCallbacks === null) throw new Error('connect never reached the transport');
    return seenCallbacks;
  };
  return {
    transport,
    written,
    establish: () => callbacks().onConnect(),
    push: (packet: MqttPacket) => {
      const encoded = encodeMqttPacket(packet, version);
      if (!encoded.ok) throw new Error(`broker packet did not encode: ${encoded.error}`);
      callbacks().onData(encoded.bytes);
    },
    /** The socket goes away without a DISCONNECT. */
    sever: (error?: MqttTransportError) => {
      ended = true;
      callbacks().onEnd(error);
    },
  };
}

const settleTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const acceptedConnack: MqttPacket = { type: 'connack', sessionPresent: false, reasonCode: 0 };
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

type ReadyFacts = Parameters<MqttSessionObserver['ready']>[0];
type EndedFacts = Parameters<MqttSessionObserver['ended']>[0];

/** An open session with its observer's facts collected, the CONNACK not yet pushed. */
async function observed(sendId: string, request: MqttRequest = makeMqttRequest()) {
  const rig = scriptedTransport();
  const ready: ReadyFacts[] = [];
  const messages: MqttObservedMessage[] = [];
  const ended: EndedFacts[] = [];
  const settled = executeMqttSession(request, {
    workspaceId: null,
    environmentId: undefined,
    transport: rig.transport,
    sendId,
    resolution: (template) => template,
    observer: {
      ready: (facts) => ready.push(facts),
      message: (message) => messages.push(message),
      ended: (facts) => ended.push(facts),
    },
  });
  await settleTick();
  rig.establish();
  const subscribesWritten = (): Array<Extract<MqttPacket, { type: 'subscribe' }>> =>
    rig.written.flatMap((packet) => (packet.type === 'subscribe' ? [packet] : []));
  /** Open the session and grant every SUBSCRIBE it sent. */
  const open = (): void => {
    rig.push(acceptedConnack);
    for (const subscribe of subscribesWritten()) {
      rig.push({ type: 'suback', packetId: subscribe.packetId, reasonCodes: subscribe.subscriptions.map(() => 0) });
    }
  };
  return { rig, ready, messages, ended, settled, subscribesWritten, open };
}

describe('the ready fact', () => {
  it('comes once the last open-time SUBSCRIBE is answered, with every grant', async () => {
    const session = await observed(
      'send-ready',
      makeMqttRequest({
        topics: [
          { uid: 'row00001', topicFilter: 'devices/dev-1/#', qos: 1 },
          { uid: 'row00002', topicFilter: 'fleet/north', subscriptionId: 7 },
        ],
      }),
    );
    session.rig.push({ type: 'connack', sessionPresent: true, reasonCode: 0 });
    const [shared, alone] = session.subscribesWritten();
    expect(session.ready).toEqual([]);

    session.rig.push({ type: 'suback', packetId: shared.packetId, reasonCodes: [1] });
    expect(session.ready).toEqual([]);

    session.rig.push({ type: 'suback', packetId: alone.packetId, reasonCodes: [0x87] });
    expect(session.ready).toEqual([
      {
        sessionPresent: true,
        clientId: 'probe-1',
        grants: [
          { topicFilter: 'devices/dev-1/#', reasonCode: 1 },
          { topicFilter: 'fleet/north', reasonCode: 0x87 },
        ],
        unsent: [],
      },
    ]);
    closeActiveMqttSession('send-ready');
    await session.settled;
    expect(session.ready).toHaveLength(1);
  });

  it('comes at the CONNACK when the session subscribes to nothing', async () => {
    const session = await observed('send-ready-bare', makeMqttRequest({ topics: [] }));
    session.rig.push(acceptedConnack);

    expect(session.ready).toEqual([{ sessionPresent: false, clientId: 'probe-1', grants: [], unsent: [] }]);
    closeActiveMqttSession('send-ready-bare');
    await session.settled;
  });

  it('names the filters whose SUBSCRIBE did not compose', async () => {
    const session = await observed(
      'send-ready-unsent',
      makeMqttRequest({ topics: [{ uid: 'row00001', topicFilter: 'devices/#/status' }] }),
    );
    session.rig.push(acceptedConnack);

    expect(session.ready).toEqual([
      {
        sessionPresent: false,
        clientId: 'probe-1',
        grants: [],
        unsent: [{ topicFilters: ['devices/#/status'], error: expect.stringContaining('"#"') }],
      },
    ]);
    closeActiveMqttSession('send-ready-unsent');
    await session.settled;
  });

  it('is never reported to a session with no observer', async () => {
    const rig = scriptedTransport();
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-unobserved',
      resolution: (template) => template,
    });
    await settleTick();
    rig.establish();
    rig.push(acceptedConnack);
    closeActiveMqttSession('send-unobserved');
    expect((await settled).outcome).toEqual({ kind: 'connected' });
  });
});

describe('an inbound message', () => {
  it('reaches the observer as it is recorded, in order, at its place in the session', async () => {
    const session = await observed('send-tap');
    session.open();
    expect(activeMqttSessionPosition('send-tap')).toBe(1);

    session.rig.push({
      type: 'publish',
      topic: 'devices/dev-1/status',
      payload: text('{"state":"online"}'),
      qos: 0,
      retain: true,
      dup: false,
      packetId: null,
    });
    session.rig.push({
      type: 'publish',
      topic: 'devices/dev-1/status',
      payload: text('{"state":"rebooting"}'),
      qos: 1,
      retain: false,
      dup: false,
      packetId: 9,
      properties: { correlationData: text('cmd-1'), userProperties: [{ key: 'owner', value: 'John Doe' }] },
    });

    expect(session.messages).toEqual([
      {
        position: 1,
        atMs: expect.any(Number),
        topic: 'devices/dev-1/status',
        payload: text('{"state":"online"}'),
        qos: 0,
        retain: true,
        dup: false,
        properties: {},
      },
      {
        position: 2,
        atMs: expect.any(Number),
        topic: 'devices/dev-1/status',
        payload: text('{"state":"rebooting"}'),
        qos: 1,
        retain: false,
        dup: false,
        properties: { correlationData: text('cmd-1'), userProperties: [{ key: 'owner', value: 'John Doe' }] },
      },
    ]);
    expect(activeMqttSessionPosition('send-tap')).toBe(3);
    closeActiveMqttSession('send-tap');
    await session.settled;
  });

  it('is handed over once when the broker redelivers it', async () => {
    const session = await observed('send-tap-dup');
    session.open();
    const publish: MqttPacket = {
      type: 'publish',
      topic: 'devices/dev-1/status',
      payload: text('x'),
      qos: 2,
      retain: false,
      dup: false,
      packetId: 42,
    };
    session.rig.push(publish);
    session.rig.push({ ...publish, dup: true });

    expect(session.messages).toHaveLength(1);
    closeActiveMqttSession('send-tap-dup');
    await session.settled;
  });
});

describe('the end', () => {
  it('names a broker DISCONNECT by its reason', async () => {
    const session = await observed('send-end-broker');
    session.open();
    session.rig.push({ type: 'disconnect', reasonCode: 0x8e });
    await session.settled;

    expect(session.ended).toEqual([{ end: { by: 'broker', reasonCode: 0x8e }, stopped: false }]);
  });

  it('says a severed connection ended with no word, and carries the transport’s', async () => {
    const session = await observed('send-end-severed');
    session.open();
    session.rig.sever(new MqttTransportError('read ECONNRESET'));
    await session.settled;

    expect(session.ended).toEqual([{ end: null, stopped: false, error: 'read ECONNRESET' }]);
  });

  it('says the client closed it', async () => {
    const session = await observed('send-end-client');
    session.open();
    closeActiveMqttSession('send-end-client');
    await session.settled;

    expect(session.ended).toEqual([{ end: { by: 'client' }, stopped: false }]);
  });
});

describe('a publish that waits for the broker', () => {
  const NAME = { topic: 'devices/dev-1/name', payload: '{"name":"n-1"}' };

  it('answers at the write at QoS 0, with the message as sent', async () => {
    const session = await observed('send-ack-q0');
    session.open();

    const result = await publishActiveMqttMessageAcked('send-ack-q0', NAME);

    expect(result).toEqual({
      success: true,
      sent: {
        position: 1,
        atMs: expect.any(Number),
        topic: 'devices/dev-1/name',
        payload: text('{"name":"n-1"}'),
        qos: 0,
        retain: false,
      },
    });
    closeActiveMqttSession('send-ack-q0');
    await session.settled;
  });

  it('answers at the PUBACK at QoS 1, and says how long the broker took', async () => {
    const session = await observed('send-ack-q1');
    session.open();
    let answered = false;
    const publishing = publishActiveMqttMessageAcked('send-ack-q1', { ...NAME, qos: 1 }).then((result) => {
      answered = true;
      return result;
    });
    await settleTick();
    const publish = session.rig.written.at(-1);
    if (publish?.type !== 'publish' || publish.packetId === null) throw new Error('expected a QoS 1 PUBLISH');
    expect(answered).toBe(false);

    session.rig.push({ type: 'puback', packetId: publish.packetId, reasonCode: 0 });

    const result = await publishing;
    expect(result).toMatchObject({ success: true, sent: { position: 1, qos: 1 }, ackMs: expect.any(Number) });
    closeActiveMqttSession('send-ack-q1');
    await session.settled;
  });

  it('fails with the reason when the PUBACK refuses', async () => {
    const session = await observed('send-ack-refused');
    session.open();
    const publishing = publishActiveMqttMessageAcked('send-ack-refused', { ...NAME, qos: 1 });
    await settleTick();
    const publish = session.rig.written.at(-1);
    if (publish?.type !== 'publish' || publish.packetId === null) throw new Error('expected a QoS 1 PUBLISH');

    session.rig.push({ type: 'puback', packetId: publish.packetId, reasonCode: 0x87 });

    expect(await publishing).toEqual({
      success: false,
      error: 'The broker refused the publish: Not authorized (code 135).',
    });
    closeActiveMqttSession('send-ack-refused');
    await session.settled;
  });

  it('answers at the PUBCOMP at QoS 2', async () => {
    const session = await observed('send-ack-q2');
    session.open();
    let answered = false;
    const publishing = publishActiveMqttMessageAcked('send-ack-q2', { ...NAME, qos: 2 }).then((result) => {
      answered = true;
      return result;
    });
    await settleTick();
    const publish = session.rig.written.at(-1);
    if (publish?.type !== 'publish' || publish.packetId === null) throw new Error('expected a QoS 2 PUBLISH');

    session.rig.push({ type: 'pubrec', packetId: publish.packetId, reasonCode: 0 });
    await settleTick();
    expect(session.rig.written.at(-1)?.type).toBe('pubrel');
    expect(answered).toBe(false);

    session.rig.push({ type: 'pubcomp', packetId: publish.packetId, reasonCode: 0 });
    expect(await publishing).toMatchObject({ success: true, ackMs: expect.any(Number) });
    closeActiveMqttSession('send-ack-q2');
    await session.settled;
  });

  it('fails when the PUBREC refuses, and sends no PUBREL after it', async () => {
    const session = await observed('send-ack-q2-refused');
    session.open();
    const publishing = publishActiveMqttMessageAcked('send-ack-q2-refused', { ...NAME, qos: 2 });
    await settleTick();
    const publish = session.rig.written.at(-1);
    if (publish?.type !== 'publish' || publish.packetId === null) throw new Error('expected a QoS 2 PUBLISH');

    session.rig.push({ type: 'pubrec', packetId: publish.packetId, reasonCode: 0x97 });

    expect(await publishing).toEqual({
      success: false,
      error: 'The broker refused the publish: Quota exceeded (code 151).',
    });
    expect(session.rig.written.at(-1)).toBe(publish);
    closeActiveMqttSession('send-ack-q2-refused');
    await session.settled;
  });

  it('fails when the session ends before the broker answers', async () => {
    const session = await observed('send-ack-dropped');
    session.open();
    const publishing = publishActiveMqttMessageAcked('send-ack-dropped', { ...NAME, qos: 1 });
    await settleTick();

    session.rig.sever();

    expect(await publishing).toEqual({
      success: false,
      error: 'The session ended before the broker acknowledged the publish.',
    });
    await session.settled;
  });

  it('leaves the plain rider answering at the write', async () => {
    const session = await observed('send-ack-plain');
    session.open();

    expect(await publishActiveMqttMessage('send-ack-plain', { ...NAME, qos: 1 })).toEqual({ success: true });
    closeActiveMqttSession('send-ack-plain');
    await session.settled;
  });
});
