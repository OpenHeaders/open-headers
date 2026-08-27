/**
 * MQTT executor — the session driver above the protocol-blind
 * byte-stream seam, exercised against a SCRIPTED transport whose
 * broker side speaks through the same `@openheaders/core/mqtt` codec:
 * the CONNACK-gated open (refusal reasons verbatim), open-time
 * subscriptions with SUBACK grants per row, the QoS 1/2 ack flows both
 * directions (inbound QoS 2 exactly-once), the publish / subscription
 * riders with per-send resolution and payload-ENCODING decode, the
 * 3.1.1 version lens (5.0 surfaces honestly inert), keep-alive
 * PINGREQ, the broker DISCONNECT reason verbatim, and the clean
 * Disconnect.
 */

import {
  decodeMqttPacket,
  encodeMqttPacket,
  MQTT_PROTOCOL_VERSIONS,
  type MqttPacket,
  type MqttProtocolVersion,
} from '@openheaders/core/mqtt';
import type { MqttRequest } from '@openheaders/core/types';
import { executeMqttSession } from '@openheaders/oracle/live/mqtt-exec/execute';
import {
  closeActiveMqttSession,
  publishActiveMqttMessage,
  setActiveMqttSubscription,
} from '@openheaders/oracle/live/mqtt-exec/session-plane';
import {
  type MqttByteTransport,
  type MqttStreamCallbacks,
  MqttTransportError,
  type MqttTransportRequest,
} from '@openheaders/oracle/live/mqtt-exec/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeMqttRequest(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqtt0001',
    path: 'requests/suite-col1/probe-mqtt1',
    name: 'Probe MQTT',
    url: 'mqtt://{{host}}',
    topic: 'probe/echo',
    payload: 'hello',
    topics: [],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  };
}

const SCOPE: Record<string, string> = {
  host: 'broker.openheaders.io:1883',
  team: 'alpha',
};

function scopedResolution(template: string, unresolved: Set<string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
    const value = SCOPE[name.trim()];
    if (value === undefined) {
      unresolved.add(name.trim());
      return whole;
    }
    return value;
  });
}

/** Scripted byte transport — the broker side of the rig. `written`
 *  holds every client packet DECODED through the real codec (each
 *  executor write is exactly one packet); `push` answers with
 *  broker-encoded packets. `end()` closes like a socket: onEnd on a
 *  microtask, exactly once. */
function scriptedTransport(version: MqttProtocolVersion) {
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
  return {
    transport,
    written,
    wire: () => {
      if (seenRequest === null) throw new Error('connect never reached the transport');
      return seenRequest;
    },
    establish: () => {
      if (seenCallbacks === null) throw new Error('connect never reached the transport');
      seenCallbacks.onConnect();
    },
    push: (packet: MqttPacket) => {
      if (seenCallbacks === null) throw new Error('connect never reached the transport');
      const encoded = encodeMqttPacket(packet, version);
      if (!encoded.ok) throw new Error(`broker packet did not encode: ${encoded.error}`);
      seenCallbacks.onData(encoded.bytes);
    },
    pushBytes: (bytes: Uint8Array) => {
      if (seenCallbacks === null) throw new Error('connect never reached the transport');
      seenCallbacks.onData(bytes);
    },
  };
}

async function settleTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const acceptedConnack: MqttPacket = { type: 'connack', sessionPresent: false, reasonCode: 0 };

describe('executeMqttSession — connect gate', () => {
  it('sends CONNECT on the established stream (generated client id, defaults) and opens on the accepting CONNACK', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-open',
      resolution: scopedResolution,
    });
    await settleTick();
    expect(rig.wire().url).toBe('mqtt://broker.openheaders.io:1883');
    // An empty knob dials under the 30 s reference deadline.
    expect(rig.wire().timeoutMs).toBe(30_000);
    rig.establish();
    expect(rig.written).toHaveLength(1);
    const connect = rig.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT first');
    expect(connect.clientId).toMatch(/^oh-/);
    expect(connect.cleanStart).toBe(true);
    expect(connect.keepAlive).toBe(60);
    rig.push({ type: 'connack', sessionPresent: true, reasonCode: 0 });
    closeActiveMqttSession('send-mqtt-open');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    // remainingLength is the frame's Remaining Length as framed by the
    // broker side (5.0 CONNACK: flags + reason + empty properties = 3).
    expect(snapshot.connack).toEqual({ sessionPresent: true, reasonCode: 0, remainingLength: 3 });
    expect(snapshot.clientId).toBe(connect.clientId);
    expect(snapshot.end).toEqual({ by: 'client' });
    // The clean Disconnect wrote a DISCONNECT before closing.
    expect(rig.written.at(-1)?.type).toBe('disconnect');
  });

  it('a close before the CONNACK settles as the aborted outcome, not a failure', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-abort',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    // Cancel while still connecting — no CONNACK ever arrives.
    closeActiveMqttSession('send-mqtt-abort');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'aborted' });
    // `stopped` keeps its open-session meaning only — the aborted
    // outcome IS the pre-open mark.
    expect(snapshot.stopped).toBeUndefined();
    // The socket HAD been established — the torn-down connection keeps
    // its end record (the timeline's "Disconnected from broker" row).
    expect(snapshot.end).toEqual({ by: 'client' });
  });

  it('a close before the socket ever establishes aborts with NO end record — no fabricated disconnect', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-abort-dial',
      resolution: scopedResolution,
    });
    await settleTick();
    // Cancel mid-dial — the transport never reported onConnect.
    closeActiveMqttSession('send-mqtt-abort-dial');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'aborted' });
    expect(snapshot.stopped).toBeUndefined();
    expect(snapshot.end).toBeNull();
  });

  it('carries the resolved Basic pair on CONNECT and keeps it off an auth-less session', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(
      makeMqttRequest({ auth: { type: 'basic', username: 'probe-{{team}}', password: 'secret pass' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-auth',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    rig.establish();
    const connect = rig.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT first');
    expect(connect.username).toBe('probe-alpha');
    if (connect.password === undefined) throw new Error('expected the CONNECT password');
    expect(new TextDecoder().decode(connect.password)).toBe('secret pass');
    rig.push(acceptedConnack);
    closeActiveMqttSession('send-mqtt-auth');
    await settled;

    const bareRig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const bareSettled = executeMqttSession(makeMqttRequest({ auth: { type: 'none' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: bareRig.transport,
      sendId: 'send-mqtt-noauth',
      resolution: scopedResolution,
    });
    await settleTick();
    bareRig.establish();
    const bareConnect = bareRig.written[0];
    if (bareConnect.type !== 'connect') throw new Error('expected CONNECT first');
    expect(bareConnect.username).toBeUndefined();
    expect(bareConnect.password).toBeUndefined();
    bareRig.push(acceptedConnack);
    closeActiveMqttSession('send-mqtt-noauth');
    await bareSettled;
  });

  it('gates unresolved auth references as the structured pre-wire error', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const snapshot = await executeMqttSession(
      makeMqttRequest({ auth: { type: 'basic', username: 'probe', password: '{{vault.brokerSecret}}' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-auth-unresolved',
        resolution: scopedResolution,
      },
    );
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain('vault.brokerSecret');
  });

  it('surfaces a CONNACK refusal verbatim as the classified pre-open error', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-refused',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    rig.push({ type: 'connack', sessionPresent: false, reasonCode: 0x87 });
    const snapshot = await settled;
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain('Not authorized');
    expect(snapshot.outcome.error).toContain('135');
    expect(snapshot.connack).toEqual({ sessionPresent: false, reasonCode: 0x87, remainingLength: 3 });
  });

  it('refuses a 3.1.1-form CONNACK code on a 5.0 session with the 3.1.1 name verbatim', async () => {
    // A 3.1.1-only broker answering a 5.0 CONNECT (the aedes probe
    // fact): 3.1.1-form CONNACK, return code 0x01 — a refusal, never
    // an open session the broker is already closing.
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v311);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-v5-refused',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    // The broker side emits the two-byte 3.1.1 CONNACK verbatim; the
    // 5.0 request's decoder must read it tolerantly.
    rig.pushBytes(new Uint8Array([0x20, 0x02, 0x00, 0x01]));
    const snapshot = await settled;
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain('Unacceptable protocol version');
    expect(snapshot.outcome.error).toContain('code 1');
    // The raw wire frame declared Remaining Length 2 — recorded verbatim.
    expect(snapshot.connack).toEqual({ sessionPresent: false, reasonCode: 1, remainingLength: 2 });
  });

  it('gates a foreign scheme and unresolved variables as structured pre-wire errors', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const base = {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      resolution: scopedResolution,
    };
    const scheme = await executeMqttSession(makeMqttRequest({ url: 'https://openheaders.io' }), {
      ...base,
      sendId: 's1',
    });
    if (scheme.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(scheme.outcome.error).toContain('mqtt://');
    const vars = await executeMqttSession(makeMqttRequest({ url: 'mqtt://{{missing}}' }), { ...base, sendId: 's2' });
    if (vars.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(vars.outcome.error).toContain('missing');
  });
});

describe('executeMqttSession — subscriptions', () => {
  it('subscribes enabled rows at open and records SUBACK grants per row (downgrades honest)', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(
      makeMqttRequest({
        topics: [
          { uid: 'row00001', topicFilter: 'probe/{{team}}/#', qos: 2 },
          { uid: 'row00002', topicFilter: 'probe/off', subscribe: false },
          { uid: 'row00003', topicFilter: 'probe/opts', qos: 1, noLocal: true, retainHandling: 2 },
          {
            uid: 'row00004',
            topicFilter: 'probe/meta',
            userProperties: [
              { uid: 'up000001', key: 'trace', value: '{{team}}' },
              { uid: 'up000002', key: 'off', value: 'x', enabled: false },
              { uid: 'up000003', key: '  ', value: 'blank' },
            ],
          },
        ],
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-subs',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    rig.establish();
    rig.push(acceptedConnack);
    const subscribe = rig.written[1];
    if (subscribe.type !== 'subscribe') throw new Error('expected SUBSCRIBE after CONNACK');
    expect(subscribe.subscriptions.map((s) => s.topicFilter)).toEqual(['probe/alpha/#', 'probe/opts']);
    expect(subscribe.subscriptions[1]).toMatchObject({ noLocal: true, retainHandling: 2 });
    // A row carrying User Properties rides its OWN packet — the pairs
    // are per-SUBSCRIBE; enabled rows with a key, values resolved.
    const metaSubscribe = rig.written[2];
    if (metaSubscribe.type !== 'subscribe') throw new Error('expected the properties row on its own SUBSCRIBE');
    expect(metaSubscribe.subscriptions.map((s) => s.topicFilter)).toEqual(['probe/meta']);
    expect(metaSubscribe.properties?.userProperties).toEqual([{ key: 'trace', value: 'alpha' }]);
    // Grants verbatim, positional — the broker downgrades row 1 to QoS 1.
    rig.push({ type: 'suback', packetId: subscribe.packetId, reasonCodes: [1, 0x80] });
    closeActiveMqttSession('send-mqtt-subs');
    const snapshot = await settled;
    expect(snapshot.events[0]).toEqual({
      kind: 'subscribed',
      grants: [
        { topicFilter: 'probe/alpha/#', reasonCode: 1 },
        { topicFilter: 'probe/opts', reasonCode: 0x80 },
      ],
    });
  });

  it('rides the live toggle riders: SUBSCRIBE resolves the grant, UNSUBSCRIBE records the row', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-toggle',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    rig.push(acceptedConnack);

    const subscribing = setActiveMqttSubscription('send-mqtt-toggle', {
      topicFilter: 'probe/{{team}}/live',
      subscribe: true,
      qos: 1,
      userProperties: [
        { uid: 'up000001', key: 'trace', value: '{{team}}' },
        { uid: 'up000002', key: 'off', value: 'x', enabled: false },
      ],
    });
    const subscribePacket = rig.written.at(-1);
    if (subscribePacket?.type !== 'subscribe') throw new Error('expected SUBSCRIBE');
    expect(subscribePacket.subscriptions[0].topicFilter).toBe('probe/alpha/live');
    expect(subscribePacket.properties?.userProperties).toEqual([{ key: 'trace', value: 'alpha' }]);
    rig.push({ type: 'suback', packetId: subscribePacket.packetId, reasonCodes: [1] });
    await expect(subscribing).resolves.toEqual({ success: true, grantCode: 1 });

    const unsubscribing = setActiveMqttSubscription('send-mqtt-toggle', {
      topicFilter: 'probe/alpha/live',
      subscribe: false,
    });
    const unsubscribePacket = rig.written.at(-1);
    if (unsubscribePacket?.type !== 'unsubscribe') throw new Error('expected UNSUBSCRIBE');
    rig.push({ type: 'unsuback', packetId: unsubscribePacket.packetId, reasonCodes: [0] });
    await expect(unsubscribing).resolves.toEqual({ success: true, grantCode: 0 });

    closeActiveMqttSession('send-mqtt-toggle');
    const snapshot = await settled;
    expect(snapshot.events.map((e) => e.kind)).toEqual(['subscribed', 'unsubscribed']);
  });

  it('settles a rider still waiting on its ack when the session ends', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-hang',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    rig.push(acceptedConnack);
    const waiting = setActiveMqttSubscription('send-mqtt-hang', { topicFilter: 'probe/never', subscribe: true });
    closeActiveMqttSession('send-mqtt-hang');
    await settled;
    const result = await waiting;
    expect(result.success).toBe(false);
    expect(result.error).toContain('session ended');
  });
});

describe('executeMqttSession — messages and QoS flows', () => {
  it('captures inbound publishes with flags verbatim and answers the QoS 1/2 acks', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-inbound',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    rig.push(acceptedConnack);

    const payload = new TextEncoder().encode('tick');
    rig.push({ type: 'publish', topic: 'probe/retained', payload, qos: 0, retain: true, dup: false, packetId: null });
    rig.push({ type: 'publish', topic: 'probe/q1', payload, qos: 1, retain: false, dup: false, packetId: 41 });
    rig.push({ type: 'publish', topic: 'probe/q2', payload, qos: 2, retain: false, dup: false, packetId: 42 });
    // Redelivery of the same QoS 2 id before PUBREL: PUBREC answers
    // again, the capture records ONCE (exactly-once display truth).
    rig.push({ type: 'publish', topic: 'probe/q2', payload, qos: 2, retain: false, dup: true, packetId: 42 });
    rig.push({ type: 'pubrel', packetId: 42, reasonCode: 0 });

    const ackTypes = rig.written.slice(1).map((p) => p.type);
    expect(ackTypes).toEqual(['puback', 'pubrec', 'pubrec', 'pubcomp']);

    closeActiveMqttSession('send-mqtt-inbound');
    const snapshot = await settled;
    const messages = snapshot.events.filter((e) => e.kind === 'message');
    expect(messages.map((m) => m.topic)).toEqual(['probe/retained', 'probe/q1', 'probe/q2']);
    expect(messages[0]).toMatchObject({ retain: true, qos: 0, direction: 'down' });
  });

  it('publishes through the rider — per-send resolution, ENCODING decode, the outbound QoS 2 flow', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-publish',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    rig.push(acceptedConnack);

    const bad = publishActiveMqttMessage('send-mqtt-publish', { topic: 'probe/bin', payload: '!!!', format: 'base64' });
    expect(bad.success).toBe(false);
    expect(bad.error).toContain('Base64');

    const ok = publishActiveMqttMessage('send-mqtt-publish', {
      topic: 'probe/{{team}}/out',
      payload: '48656c6c6f',
      format: 'hex',
      qos: 2,
      retain: true,
      properties: { contentType: 'text/plain', userProperties: [{ uid: 'up000001', key: 'k', value: '{{team}}' }] },
    });
    expect(ok).toEqual({ success: true });
    const publish = rig.written.at(-1);
    if (publish?.type !== 'publish') throw new Error('expected PUBLISH');
    expect(publish.topic).toBe('probe/alpha/out');
    expect(new TextDecoder().decode(publish.payload)).toBe('Hello');
    expect(publish.qos).toBe(2);
    expect(publish.retain).toBe(true);
    expect(publish.properties?.contentType).toBe('text/plain');
    expect(publish.properties?.userProperties).toEqual([{ key: 'k', value: 'alpha' }]);
    if (publish.packetId === null) throw new Error('QoS 2 publish needs a packet id');
    rig.push({ type: 'pubrec', packetId: publish.packetId, reasonCode: 0 });
    expect(rig.written.at(-1)?.type).toBe('pubrel');
    rig.push({ type: 'pubcomp', packetId: publish.packetId, reasonCode: 0 });

    const unresolvedSend = publishActiveMqttMessage('send-mqtt-publish', { topic: 'probe/{{nope}}', payload: 'x' });
    expect(unresolvedSend.success).toBe(false);
    expect(unresolvedSend.error).toContain('nope');

    closeActiveMqttSession('send-mqtt-publish');
    const snapshot = await settled;
    const up = snapshot.events.filter((e) => e.kind === 'message' && e.direction === 'up');
    expect(up).toHaveLength(1);
  });
});

describe('executeMqttSession — 5.0 connect knobs and topic aliases', () => {
  it('offers the alias maximum + request-information flags on CONNECT and resolves aliased inbound topics', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(
      makeMqttRequest({ topicAliasMaximum: 10, requestResponseInformation: true, requestProblemInformation: false }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-alias',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    rig.establish();
    const connect = rig.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT');
    expect(connect.properties).toEqual({
      topicAliasMaximum: 10,
      requestResponseInformation: 1,
      requestProblemInformation: 0,
    });
    rig.push(acceptedConnack);
    // A PUBLISH naming topic + alias binds them; the alias-only one resolves.
    rig.push({
      type: 'publish',
      topic: 'sensors/1/temp',
      payload: new TextEncoder().encode('21'),
      qos: 0,
      retain: false,
      dup: false,
      packetId: null,
      properties: { topicAlias: 2 },
    });
    rig.push({
      type: 'publish',
      topic: '',
      payload: new TextEncoder().encode('22'),
      qos: 0,
      retain: false,
      dup: false,
      packetId: null,
      properties: { topicAlias: 2 },
    });
    closeActiveMqttSession('send-mqtt-alias');
    const snapshot = await settled;
    const topics = snapshot.events.flatMap((e) => (e.kind === 'message' ? [e.topic] : []));
    expect(topics).toEqual(['sensors/1/temp', 'sensors/1/temp']);
  });

  it('hands the TLS trust knobs to the transport — the cert ref passes through bare without a vault', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(
      makeMqttRequest({
        url: 'mqtts://{{host}}',
        clientCertificateRef: 'iot-device',
        sniServerName: 'edge-{{team}}.openheaders.io',
        alpnProtocol: 'mqtt',
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-tls',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    expect(rig.wire()).toMatchObject({
      clientCertificateRef: 'iot-device',
      sniServerName: 'edge-alpha.openheaders.io',
      alpnProtocol: 'mqtt',
    });
    expect(rig.wire().clientCertificatePem).toBeUndefined();
    rig.establish();
    closeActiveMqttSession('send-mqtt-tls');
    await settled;
  });

  it('keeps the flags off CONNECT at their spec defaults', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(
      makeMqttRequest({ requestResponseInformation: false, requestProblemInformation: true }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-alias-default',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    rig.establish();
    const connect = rig.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT');
    expect(connect.properties).toEqual({});
    closeActiveMqttSession('send-mqtt-alias-default');
    await settled;
  });
});

describe('executeMqttSession — version lens and session end', () => {
  it('keeps every 5.0 surface off a 3.1.1 session (properties, options, DISCONNECT body)', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v311);
    const settled = executeMqttSession(
      makeMqttRequest({
        protocolVersion: '3.1.1',
        sessionExpiryInterval: 300,
        receiveMaximum: 20,
        userProperties: [{ uid: 'up000001', key: 'k', value: 'v' }],
        topics: [
          {
            uid: 'row00001',
            topicFilter: 'probe/#',
            qos: 1,
            noLocal: true,
            retainHandling: 2,
            userProperties: [{ uid: 'up000002', key: 'k', value: 'v' }],
          },
        ],
        lastWill: { topic: 'clients/reporter/status', payload: 'gone', properties: { contentType: 'text/plain' } },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-v311',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    rig.establish();
    const connect = rig.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT');
    expect(connect.properties).toBeUndefined();
    expect(connect.will?.properties).toBeUndefined();
    rig.push(acceptedConnack);
    const subscribe = rig.written[1];
    if (subscribe.type !== 'subscribe') throw new Error('expected SUBSCRIBE');
    expect(subscribe.subscriptions[0]).toEqual({ topicFilter: 'probe/#', qos: 1 });
    expect(subscribe.properties).toBeUndefined();

    const publish = publishActiveMqttMessage('send-mqtt-v311', {
      topic: 'probe/out',
      payload: 'x',
      properties: { contentType: 'text/plain' },
    });
    expect(publish.success).toBe(true);
    const published = rig.written.at(-1);
    if (published?.type !== 'publish') throw new Error('expected PUBLISH');
    expect(published.properties).toBeUndefined();

    closeActiveMqttSession('send-mqtt-v311');
    const snapshot = await settled;
    expect(snapshot.end).toEqual({ by: 'client' });
    expect(rig.written.at(-1)).toEqual({ type: 'disconnect', reasonCode: null });
  });

  it('records a broker DISCONNECT reason verbatim and settles', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-brokerbye',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    rig.push(acceptedConnack);
    rig.push({ type: 'disconnect', reasonCode: 0x8b });
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    expect(snapshot.end).toEqual({ by: 'broker', reasonCode: 0x8b });
  });

  it('reassembles packets split across wire chunks — the incremental decoder feeds the driver', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-split',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.establish();
    const encoded = encodeMqttPacket(acceptedConnack, MQTT_PROTOCOL_VERSIONS.v5);
    if (!encoded.ok) throw new Error(encoded.error);
    // Byte-by-byte delivery — no chunk boundary carries meaning.
    for (const byte of encoded.bytes) rig.pushBytes(new Uint8Array([byte]));
    expect(rig.written.length).toBeGreaterThanOrEqual(1);
    closeActiveMqttSession('send-mqtt-split');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
  });
});

/** Multi-dial scripted transport for the auto-reconnect loop — every
 *  `connect` is one numbered dial with its own broker side; the rig
 *  severs, fails or answers any of them. */
function reconnectRig(version: MqttProtocolVersion) {
  const dials: Array<{ request: MqttTransportRequest; callbacks: MqttStreamCallbacks; ended: boolean }> = [];
  const written: MqttPacket[][] = [];
  const transport: MqttByteTransport = {
    connect(request, callbacks, signal) {
      const dial = { request, callbacks, ended: false };
      const index = dials.push(dial) - 1;
      written.push([]);
      const finish = (): void => {
        if (dial.ended) return;
        dial.ended = true;
        queueMicrotask(() => callbacks.onEnd());
      };
      signal?.addEventListener('abort', finish);
      return {
        write: (bytes) => {
          const decoded = decodeMqttPacket(bytes, version);
          if (!decoded.ok) throw new Error(`client wrote a malformed packet: ${decoded.error}`);
          written[index].push(decoded.packet);
        },
        end: finish,
      };
    },
  };
  const dialAt = (n: number) => {
    const dial = dials[n];
    if (dial === undefined) throw new Error(`dial ${n} never happened`);
    return dial;
  };
  return {
    transport,
    written,
    dialCount: () => dials.length,
    establish: (n: number) => dialAt(n).callbacks.onConnect(),
    push: (n: number, packet: MqttPacket) => {
      const encoded = encodeMqttPacket(packet, version);
      if (!encoded.ok) throw new Error(`broker packet did not encode: ${encoded.error}`);
      dialAt(n).callbacks.onData(encoded.bytes);
    },
    /** The socket dropped without a DISCONNECT. */
    sever: (n: number) => {
      const dial = dialAt(n);
      dial.ended = true;
      dial.callbacks.onEnd();
    },
    /** The dial failed before it established. */
    fail: (n: number, message: string) => {
      const dial = dialAt(n);
      dial.ended = true;
      dial.callbacks.onEnd(new MqttTransportError(message));
    },
  };
}

describe('executeMqttSession — auto-reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const tick = () => vi.advanceTimersByTimeAsync(0);

  it('logs the lost connection, redials on the period, replays the wanted subscriptions when the broker kept no session', async () => {
    const rig = reconnectRig(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(
      makeMqttRequest({
        autoReconnect: true,
        reconnectPeriodMs: 2_000,
        clientId: 'reporter-1',
        topics: [
          { uid: 'row1', topicFilter: 'sensors/+/temp', qos: 1 },
          { uid: 'row2', topicFilter: 'alerts/#', qos: 0 },
        ],
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-reconnect',
        resolution: scopedResolution,
      },
    );
    await tick();
    rig.establish(0);
    rig.push(0, acceptedConnack);
    rig.push(0, { type: 'suback', packetId: 1, reasonCodes: [1, 0] });
    // A live toggle turns one open row off — the replay must not bring it back.
    const off = setActiveMqttSubscription('send-mqtt-reconnect', { topicFilter: 'alerts/#', subscribe: false });
    rig.push(0, { type: 'unsuback', packetId: 2, reasonCodes: [0] });
    expect((await off).success).toBe(true);

    rig.sever(0);
    await tick();
    expect(rig.dialCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(rig.dialCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(rig.dialCount()).toBe(2);
    // Publishing between connections reports honestly instead of writing into the void.
    expect(publishActiveMqttMessage('send-mqtt-reconnect', { topic: 'x', payload: 'y' }).success).toBe(false);

    rig.establish(1);
    const connect = rig.written[1][0];
    expect(connect.type).toBe('connect');
    if (connect.type === 'connect') expect(connect.clientId).toBe('reporter-1');
    rig.push(1, { type: 'connack', sessionPresent: false, reasonCode: 0 });
    const replay = rig.written[1][1];
    expect(replay.type).toBe('subscribe');
    if (replay.type === 'subscribe') {
      expect(replay.subscriptions.map((sub) => sub.topicFilter)).toEqual(['sensors/+/temp']);
    }
    rig.push(1, { type: 'suback', packetId: 1, reasonCodes: [1] });
    // The new connection publishes again.
    expect(publishActiveMqttMessage('send-mqtt-reconnect', { topic: 'sensors/1/temp', payload: '21' }).success).toBe(
      true,
    );
    closeActiveMqttSession('send-mqtt-reconnect');
    await tick();
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    expect(snapshot.connack).toEqual({ sessionPresent: false, reasonCode: 0, remainingLength: 3 });
    expect(snapshot.end).toEqual({ by: 'client' });
    expect(snapshot.stopped).toBeUndefined();
    expect(snapshot.reconnectRefused).toBeUndefined();
    expect(snapshot.events.map((event) => event.kind)).toEqual([
      'subscribed',
      'unsubscribed',
      'lost',
      'reconnecting',
      'reconnected',
      'subscribed',
      'message',
    ]);
    expect(snapshot.events[2]).toEqual({ kind: 'lost', end: null });
    expect(snapshot.events[3]).toEqual({ kind: 'reconnecting', attempt: 1 });
    expect(snapshot.events[4]).toEqual({
      kind: 'reconnected',
      attempt: 1,
      sessionPresent: false,
      reasonCode: 0,
      remainingLength: 3,
    });
  });

  it('skips the replay when the reconnect CONNACK kept the session, and carries a failed dial onto the next attempt', async () => {
    const rig = reconnectRig(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(
      makeMqttRequest({ autoReconnect: true, topics: [{ uid: 'row1', topicFilter: 'sensors/+/temp', qos: 1 }] }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-mqtt-reconnect-kept',
        resolution: scopedResolution,
      },
    );
    await tick();
    rig.establish(0);
    rig.push(0, acceptedConnack);
    rig.push(0, { type: 'suback', packetId: 1, reasonCodes: [1] });
    rig.push(0, { type: 'disconnect', reasonCode: 0x8b });
    await tick();
    // The empty knob waits the 5 s reference default.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(rig.dialCount()).toBe(2);
    rig.fail(1, 'Connection refused by broker.openheaders.io:1883. Is the MQTT broker running on that host/port?');
    await tick();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(rig.dialCount()).toBe(3);
    rig.establish(2);
    rig.push(2, { type: 'connack', sessionPresent: true, reasonCode: 0 });
    expect(rig.written[2].map((packet) => packet.type)).toEqual(['connect']);
    closeActiveMqttSession('send-mqtt-reconnect-kept');
    await tick();
    const snapshot = await settled;
    expect(snapshot.events.map((event) => event.kind)).toEqual([
      'subscribed',
      'lost',
      'reconnecting',
      'reconnecting',
      'reconnected',
    ]);
    expect(snapshot.events[1]).toEqual({ kind: 'lost', end: { by: 'broker', reasonCode: 0x8b } });
    expect(snapshot.events[3]).toEqual({
      kind: 'reconnecting',
      attempt: 2,
      error: 'Connection refused by broker.openheaders.io:1883. Is the MQTT broker running on that host/port?',
    });
    expect(snapshot.end).toEqual({ by: 'client' });
  });

  it('never reconnects a session the broker took over, nor a session with the knob off', async () => {
    const taken = reconnectRig(MQTT_PROTOCOL_VERSIONS.v5);
    const takenSettled = executeMqttSession(makeMqttRequest({ autoReconnect: true }), {
      workspaceId: null,
      environmentId: undefined,
      transport: taken.transport,
      sendId: 'send-mqtt-taken-over',
      resolution: scopedResolution,
    });
    await tick();
    taken.establish(0);
    taken.push(0, acceptedConnack);
    taken.push(0, { type: 'disconnect', reasonCode: 0x8e });
    await tick();
    const takenSnapshot = await takenSettled;
    expect(taken.dialCount()).toBe(1);
    expect(takenSnapshot.end).toEqual({ by: 'broker', reasonCode: 0x8e });
    expect(takenSnapshot.events).toEqual([]);

    const off = reconnectRig(MQTT_PROTOCOL_VERSIONS.v5);
    const offSettled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: off.transport,
      sendId: 'send-mqtt-reconnect-off',
      resolution: scopedResolution,
    });
    await tick();
    off.establish(0);
    off.push(0, acceptedConnack);
    off.sever(0);
    await tick();
    const offSnapshot = await offSettled;
    expect(off.dialCount()).toBe(1);
    expect(offSnapshot.outcome).toEqual({ kind: 'connected' });
    expect(offSnapshot.end).toBeNull();
    expect(offSnapshot.events).toEqual([]);
  });

  it('ends the loop on a refused reconnect CONNACK — the refusal verbatim, the lost end kept', async () => {
    const rig = reconnectRig(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest({ autoReconnect: true, reconnectPeriodMs: 1_000 }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-reconnect-refused',
      resolution: scopedResolution,
    });
    await tick();
    rig.establish(0);
    rig.push(0, acceptedConnack);
    rig.sever(0);
    await tick();
    await vi.advanceTimersByTimeAsync(1_000);
    rig.establish(1);
    rig.push(1, { type: 'connack', sessionPresent: false, reasonCode: 0x87 });
    await tick();
    const snapshot = await settled;
    expect(rig.dialCount()).toBe(2);
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    expect(snapshot.end).toBeNull();
    expect(snapshot.reconnectRefused).toEqual({
      attempt: 1,
      error: 'The broker refused the connection: Not authorized (code 135).',
    });
    expect(snapshot.events.map((event) => event.kind)).toEqual(['lost', 'reconnecting']);
  });

  it('a Disconnect between attempts cancels the loop and settles Stopped with the lost end', async () => {
    const rig = reconnectRig(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest({ autoReconnect: true }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-reconnect-cancel',
      resolution: scopedResolution,
    });
    await tick();
    rig.establish(0);
    rig.push(0, acceptedConnack);
    rig.sever(0);
    await tick();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(closeActiveMqttSession('send-mqtt-reconnect-cancel')).toBe(true);
    const snapshot = await settled;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rig.dialCount()).toBe(1);
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    expect(snapshot.stopped).toBe(true);
    expect(snapshot.end).toBeNull();
    expect(snapshot.events).toEqual([{ kind: 'lost', end: null }]);
  });
});
