/**
 * MQTT executor — the script hooks on the real spine over a scripted
 * transport and a scripted session host: Before connect rewrites the
 * CONNECT (client id, credentials, will, user properties) and the
 * open-time SUBSCRIBE before either leaves; Before publish rewrites
 * the rider's publish or drops it (the rider answers with the level's
 * name, nothing captured) while a script-origin publish never
 * re-enters; On message runs after the capture off the same PUBLISH
 * with the reply-to facts and `oh.publish` rides the captured publish
 * path; After close runs once at settle with the end record, the marks
 * ride the event log with the live feed, the snapshot carries the
 * record, and the session's runtime context is released. A host with
 * no script capability, or a request whose chain is empty, leaves the
 * session scriptless; a CONNACK refusal still carries the Before
 * connect record.
 */

import type { MqttStreamEventWire } from '@openheaders/core/bridge';
import {
  decodeMqttPacket,
  encodeMqttPacket,
  MQTT_PROTOCOL_VERSIONS,
  type MqttPacket,
  type MqttProtocolVersion,
} from '@openheaders/core/mqtt';
import type { ScriptExecutionResult } from '@openheaders/core/scripts';
import type { ExecutedMqttScriptMark, MqttRequest } from '@openheaders/core/types';
import { executeMqttSession } from '@openheaders/oracle/live/mqtt-exec/execute';
import { closeActiveMqttSession, publishActiveMqttMessage } from '@openheaders/oracle/live/mqtt-exec/session-plane';
import type {
  MqttByteTransport,
  MqttStreamCallbacks,
  MqttTransportRequest,
} from '@openheaders/oracle/live/mqtt-exec/transport';
import type { SessionScriptHost, SessionScriptInput } from '@openheaders/oracle/live/request-exec/script-hooks';
import { describe, expect, it } from 'vitest';

function makeMqttRequest(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqttscr1',
    path: 'requests/suite-col1/probe-scripts',
    name: 'Probe Scripts',
    url: 'mqtt://broker.openheaders.io:1883',
    clientId: 'oh-probe',
    topic: 'probe/echo',
    payload: 'hello',
    topics: [{ uid: 'tp000001', topicFilter: 'probe/echo/reply', qos: 1, subscribe: true }],
    savedMessages: [],
    userProperties: [{ uid: 'up000001', key: 'tenant', value: 'acme' }],
    auth: { type: 'basic', username: 'probe', password: 'probe-secret' },
    ...overrides,
  };
}

const ok = (over: Partial<ScriptExecutionResult> = {}): ScriptExecutionResult => ({
  executionId: 'e',
  succeeded: true,
  assertions: [],
  consoleLog: [],
  durationMs: 1,
  ...over,
});

const settleTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const utf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const decode = (base64: string): string => Buffer.from(base64, 'base64').toString('utf8');

/** Scripted byte transport — the broker side of the rig (one dial). */
function rig(version: MqttProtocolVersion = MQTT_PROTOCOL_VERSIONS.v5) {
  let seenRequest: MqttTransportRequest | null = null;
  let seenCallbacks: MqttStreamCallbacks | null = null;
  let ended = false;
  const written: MqttPacket[] = [];
  const transport: MqttByteTransport = {
    connect(request, callbacks, signal) {
      seenRequest = request;
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
    dialed: () => seenRequest !== null,
    establish: () => callbacks().onConnect(),
    push: (packet: MqttPacket) => {
      const encoded = encodeMqttPacket(packet, version);
      if (!encoded.ok) throw new Error(`broker packet did not encode: ${encoded.error}`);
      callbacks().onData(encoded.bytes);
    },
    packets: (type: MqttPacket['type']) => written.filter((p) => p.type === type),
  };
}

/** A session host answering per SOURCE, recording every call. */
function scriptedHost(
  answers: Record<string, (input: SessionScriptInput) => ScriptExecutionResult | Promise<ScriptExecutionResult>>,
) {
  const ran: SessionScriptInput[] = [];
  const ended: string[] = [];
  const host: SessionScriptHost = {
    mode: 'safe',
    run: async (input) => {
      ran.push(input);
      return answers[input.source]?.(input) ?? ok();
    },
    endSession: (id) => {
      ended.push(id);
    },
  };
  return { host, ran, ended };
}

const acceptedConnack: MqttPacket = { type: 'connack', sessionPresent: false, reasonCode: 0 };

const marksOf = (events: readonly { kind: string }[]): ExecutedMqttScriptMark[] =>
  events.filter((event): event is ExecutedMqttScriptMark => event.kind === 'script');

const inboundPublish = (topic: string, payload: string, over: Partial<Extract<MqttPacket, { type: 'publish' }>> = {}) =>
  ({
    type: 'publish',
    topic,
    payload: new TextEncoder().encode(payload),
    qos: 0,
    retain: false,
    dup: false,
    packetId: null,
    ...over,
  }) as MqttPacket;

describe('executeMqttSession — Before connect', () => {
  it('rewrites the CONNECT and the open-time SUBSCRIBE before either leaves, ancestors first', async () => {
    const t = rig();
    const host = scriptedHost({
      'col();': () =>
        ok({
          sessionMutation: {
            kind: 'mqtt-connect',
            clientId: 'fleet-7',
            subscriptions: [
              { topicFilter: 'probe/echo/reply', qos: 1 },
              { topicFilter: 'fleet/+/status', qos: 2, noLocal: true },
            ],
          },
        }),
      'req();': (input) =>
        ok({
          sessionMutation: {
            kind: 'mqtt-connect',
            username: 'device',
            password: 'device-secret',
            will: {
              topic: 'fleet/7/status',
              payloadBase64: Buffer.from('offline').toString('base64'),
              qos: 1,
              retain: true,
            },
            userProperties: [
              ...(input.hook.kind === 'mqtt-before-connect' ? input.hook.connect.userProperties : []),
              { key: 'client', value: input.hook.kind === 'mqtt-before-connect' ? input.hook.connect.clientId : '?' },
            ],
          },
        }),
    });
    const events: MqttStreamEventWire[] = [];
    const settled = executeMqttSession(makeMqttRequest({ scripts: { 'mqtt-before-connect': 'req();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-mscr-1',
      resolution: (template) => template,
      scriptChain: [
        {
          level: 'collection',
          label: "Collection 'Fleet'",
          entity: { uid: 'col1', name: 'Fleet', scripts: { 'mqtt-before-connect': 'col();' } },
        },
      ],
      scriptHost: host.host,
      emitStreamEvent: (event) => events.push(event),
    });
    await settleTick();
    expect(t.dialed()).toBe(true);
    t.establish();
    const connect = t.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT');
    expect(connect.clientId).toBe('fleet-7');
    expect(connect.username).toBe('device');
    expect(connect.password === undefined ? null : utf8(connect.password)).toBe('device-secret');
    expect(connect.will).toMatchObject({ topic: 'fleet/7/status', qos: 1, retain: true });
    expect(connect.will === undefined ? null : utf8(connect.will.payload)).toBe('offline');
    expect(connect.properties?.userProperties).toEqual([
      { key: 'tenant', value: 'acme' },
      { key: 'client', value: 'fleet-7' },
    ]);
    // The hook saw the entity's CONNECT as composed — the Basic pair,
    // the open row, the CONNECT user properties.
    const first = host.ran[0]?.hook;
    expect(first?.kind === 'mqtt-before-connect' ? first.connect : null).toMatchObject({
      url: 'mqtt://broker.openheaders.io:1883',
      protocolVersion: '5.0',
      clientId: 'oh-probe',
      username: 'probe',
      password: 'probe-secret',
      will: null,
      subscriptions: [{ topicFilter: 'probe/echo/reply', qos: 1 }],
      userProperties: [{ key: 'tenant', value: 'acme' }],
      attempt: 0,
    });
    t.push(acceptedConnack);
    const subscribe = t.packets('subscribe')[0];
    if (subscribe?.type !== 'subscribe') throw new Error('expected SUBSCRIBE');
    expect(subscribe.subscriptions.map((s) => [s.topicFilter, s.qos, s.noLocal === true])).toEqual([
      ['probe/echo/reply', 1, false],
      ['fleet/+/status', 2, true],
    ]);
    closeActiveMqttSession('send-mscr-1');
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('connected');
    expect(snapshot.clientId).toBe('fleet-7');
    expect(snapshot.scripts).toMatchObject({ mode: 'safe', beforeConnect: { succeeded: true, dials: 1 } });
    expect(snapshot.scripts?.beforeConnect?.chain.map((s) => [s.level, s.name])).toEqual([
      ['collection', 'Fleet'],
      ['request', 'Probe Scripts'],
    ]);
    const marks = marksOf(snapshot.events);
    expect(marks.map((m) => [m.hook, m.attempt])).toEqual([['mqtt-before-connect', 0]]);
    // The mark rode the live feed as an item.
    const liveMarks = events.flatMap((e) => (e.kind === 'items' ? e.items.filter((i) => i.kind === 'script') : []));
    expect(liveMarks).toHaveLength(1);
    expect(host.ended).toEqual(['send-mscr-1']);
  });

  it('a Before connect failure is recorded and the CONNECT proceeds unmutated', async () => {
    const t = rig();
    const host = scriptedHost({
      'boom();': () => ok({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
    });
    const settled = executeMqttSession(makeMqttRequest({ scripts: { 'mqtt-before-connect': 'boom();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-mscr-2',
      resolution: (template) => template,
      scriptChain: [],
      scriptHost: host.host,
    });
    await settleTick();
    t.establish();
    expect(t.written[0]).toMatchObject({ type: 'connect', clientId: 'oh-probe', username: 'probe' });
    t.push(acceptedConnack);
    closeActiveMqttSession('send-mscr-2');
    const snapshot = await settled;
    expect(snapshot.scripts?.beforeConnect).toMatchObject({ succeeded: false, error: { message: 'boom' } });
    expect(marksOf(snapshot.events)[0]).toMatchObject({ hook: 'mqtt-before-connect', succeeded: false });
  });

  it('a CONNACK refusal still carries the Before connect record on the failed snapshot', async () => {
    const t = rig();
    const host = scriptedHost({});
    const settled = executeMqttSession(makeMqttRequest({ scripts: { 'mqtt-before-connect': 'x();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-mscr-3',
      resolution: (template) => template,
      scriptChain: [],
      scriptHost: host.host,
    });
    await settleTick();
    t.establish();
    t.push({ type: 'connack', sessionPresent: false, reasonCode: 0x87 });
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('failed');
    expect(snapshot.scripts?.beforeConnect?.dials).toBe(1);
    expect(snapshot.scripts?.afterClose).toBeUndefined();
    expect(marksOf(snapshot.events)).toHaveLength(1);
    expect(host.ended).toEqual(['send-mscr-3']);
  });
});

describe('executeMqttSession — Before publish and On message', () => {
  it('rewrites the rider publish, drops another, replies from On message without re-entering', async () => {
    const t = rig();
    const host = scriptedHost({
      'pub();': (input) => {
        const message = input.hook.kind === 'mqtt-before-publish' ? input.hook.message : null;
        if (message?.payload === 'secret') return ok({ sessionMutation: { kind: 'mqtt-publish', drop: true } });
        return ok({
          sessionMutation: {
            kind: 'mqtt-publish',
            payload: `${message?.payload ?? ''}!`,
            topic: 'probe/echo/v2',
            qos: 1,
            retain: true,
            properties: { ...(message?.properties ?? {}), userProperties: [{ key: 'trace', value: 't-1' }] },
          },
        });
      },
      'msg();': async (input) => {
        const message = input.hook.kind === 'mqtt-on-message' ? input.hook.message : null;
        if (message?.text === 'ping' && message.properties?.responseTopic !== undefined) {
          // The reply rides the script-origin path — no Before publish.
          await publishActiveMqttMessage(
            'send-mscr-4',
            { topic: message.properties.responseTopic, payload: 'pong' },
            'script',
          );
        }
        return ok({ consoleLog: [{ level: 'log', args: ['seen', message?.topic ?? ''], timeMs: 0 }] });
      },
    });
    const settled = executeMqttSession(
      makeMqttRequest({ topics: [], scripts: { 'mqtt-before-publish': 'pub();', 'mqtt-on-message': 'msg();' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: t.transport,
        sendId: 'send-mscr-4',
        resolution: (template) => template,
        scriptChain: [],
        scriptHost: host.host,
      },
    );
    await settleTick();
    t.establish();
    t.push(acceptedConnack);

    await expect(
      publishActiveMqttMessage('send-mscr-4', {
        topic: 'probe/echo',
        payload: 'hello',
        properties: { contentType: 'text/plain' },
      }),
    ).resolves.toEqual({ success: true });
    await expect(publishActiveMqttMessage('send-mscr-4', { topic: 'probe/echo', payload: 'secret' })).resolves.toEqual({
      success: false,
      error: 'Dropped by the Before publish script at Request.',
    });
    const first = t.packets('publish')[0];
    if (first?.type !== 'publish') throw new Error('expected PUBLISH');
    expect(first.topic).toBe('probe/echo/v2');
    expect(utf8(first.payload)).toBe('hello!');
    expect(first.qos).toBe(1);
    expect(first.retain).toBe(true);
    expect(first.properties).toMatchObject({
      contentType: 'text/plain',
      userProperties: [{ key: 'trace', value: 't-1' }],
    });
    if (first.packetId !== null) t.push({ type: 'puback', packetId: first.packetId, reasonCode: 0 });
    expect(t.packets('publish')).toHaveLength(1);

    // The hook saw the rider's compose as composed: text payload, the
    // resolved properties, the event-log position it would take.
    const seenPublish = host.ran.find((r) => r.kind === 'mqtt-before-publish')?.hook;
    expect(seenPublish?.kind === 'mqtt-before-publish' ? seenPublish.message : null).toEqual({
      direction: 'up',
      topic: 'probe/echo',
      payload: 'hello',
      format: 'text',
      qos: 0,
      retain: false,
      properties: { contentType: 'text/plain' },
      index: 0,
    });

    t.push(
      inboundPublish('probe/echo/reply', 'ping', {
        properties: { responseTopic: 'probe/ack', correlationData: new TextEncoder().encode('c-1') },
      }),
    );
    await settleTick();
    const publishes = t.packets('publish');
    expect(publishes).toHaveLength(2);
    expect(publishes[1]).toMatchObject({ topic: 'probe/ack' });
    // Before publish ran for the two rider publishes alone.
    expect(host.ran.filter((r) => r.kind === 'mqtt-before-publish')).toHaveLength(2);
    // The On message hook saw the captured PUBLISH with its reply-to facts.
    const seenInbound = host.ran.find((r) => r.kind === 'mqtt-on-message')?.hook;
    expect(seenInbound?.kind === 'mqtt-on-message' ? seenInbound.message : null).toEqual({
      direction: 'down',
      topic: 'probe/echo/reply',
      payloadBase64: Buffer.from('ping').toString('base64'),
      text: 'ping',
      qos: 0,
      retain: false,
      dup: false,
      properties: { responseTopic: 'probe/ack', correlationData: 'c-1' },
      // The event log holds the first publish's mark, its PUBLISH, the
      // drop's mark, then this message.
      index: 3,
    });

    closeActiveMqttSession('send-mscr-4');
    const snapshot = await settled;
    const messages = snapshot.events.filter((e) => e.kind === 'message');
    expect(messages.map((m) => [m.direction, m.topic, decode(m.payloadBase64)])).toEqual([
      ['up', 'probe/echo/v2', 'hello!'],
      ['down', 'probe/echo/reply', 'ping'],
      ['up', 'probe/ack', 'pong'],
    ]);
    expect(snapshot.scripts?.beforePublish).toMatchObject({ runs: 2, dropped: 1 });
    expect(snapshot.scripts?.onMessage).toMatchObject({ runs: 1, failed: 0 });
    // The marks sit in the event log where their hooks FINISHED: the
    // first Before publish before its own PUBLISH, the drop after it,
    // On message after the reply it published.
    expect(
      snapshot.events.map((e) =>
        e.kind === 'script' ? `${e.hook}${e.droppedBy !== undefined ? ':dropped' : ''}` : e.kind,
      ),
    ).toEqual([
      'mqtt-before-publish',
      'message',
      'mqtt-before-publish:dropped',
      'message',
      'message',
      'mqtt-on-message',
    ]);
    expect(marksOf(snapshot.events)[2]?.consoleLog).toEqual([
      { level: 'log', args: ['seen', 'probe/echo/reply'], timeMs: 0 },
    ]);
  });
});

describe('executeMqttSession — After close and the chain', () => {
  it('runs After close once at settle with the end record, ancestors first', async () => {
    const t = rig();
    const host = scriptedHost({
      'col();': (input) => ok({ consoleLog: [{ level: 'log', args: [JSON.stringify(input.hook)], timeMs: 0 }] }),
      'req();': () => ok({ assertions: [{ name: 'clean', passed: true }] }),
    });
    const settled = executeMqttSession(makeMqttRequest({ topics: [], scripts: { 'mqtt-after-close': 'req();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-mscr-5',
      resolution: (template) => template,
      scriptChain: [
        {
          level: 'collection',
          label: "Collection 'Fleet'",
          entity: { uid: 'col1', name: 'Fleet', scripts: { 'mqtt-after-close': 'col();' } },
        },
      ],
      scriptHost: host.host,
    });
    await settleTick();
    t.establish();
    t.push(acceptedConnack);
    t.push(inboundPublish('probe/retained', 'one', { retain: true }));
    await expect(publishActiveMqttMessage('send-mscr-5', { topic: 'probe/out', payload: 'two' })).resolves.toEqual({
      success: true,
    });
    closeActiveMqttSession('send-mscr-5');
    const snapshot = await settled;
    expect(host.ran.map((r) => r.source)).toEqual(['col();', 'req();']);
    const close = host.ran[0]?.hook;
    expect(close?.kind === 'mqtt-after-close' ? close.close : null).toMatchObject({
      end: { by: 'client' },
      connack: { sessionPresent: false, reasonCode: 0 },
      stopped: false,
      published: 1,
      received: 1,
      droppedMessages: 0,
    });
    expect(snapshot.scripts?.afterClose).toMatchObject({
      succeeded: true,
      assertions: [{ name: 'clean', passed: true }],
    });
    expect(snapshot.scripts?.afterClose?.chain.map((s) => [s.level, s.name])).toEqual([
      ['collection', 'Fleet'],
      ['request', 'Probe Scripts'],
    ]);
    expect(marksOf(snapshot.events).map((m) => m.hook)).toEqual(['mqtt-after-close']);
    expect(host.ended).toEqual(['send-mscr-5']);
  });

  it('a scriptless request, or a host without scripts, records nothing', async () => {
    const t = rig();
    const host = scriptedHost({});
    const settled = executeMqttSession(makeMqttRequest({ topics: [] }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-mscr-6',
      resolution: (template) => template,
      scriptChain: [],
      scriptHost: host.host,
    });
    await settleTick();
    t.establish();
    t.push(acceptedConnack);
    closeActiveMqttSession('send-mscr-6');
    const snapshot = await settled;
    expect(snapshot.scripts).toBeUndefined();
    expect(snapshot.events).toEqual([]);
    expect(host.ran).toHaveLength(0);
    expect(host.ended).toEqual([]);

    const t2 = rig();
    const noHost = executeMqttSession(makeMqttRequest({ topics: [], scripts: { 'mqtt-after-close': 'x();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t2.transport,
      sendId: 'send-mscr-7',
      resolution: (template) => template,
      scriptChain: [],
    });
    await settleTick();
    t2.establish();
    t2.push(acceptedConnack);
    closeActiveMqttSession('send-mscr-7');
    expect((await noHost).scripts).toBeUndefined();
  });
});
