/**
 * MQTT executor — the inherited settings: a knob the request leaves
 * absent reads the injected ancestor chain (the page-realm twin of
 * the tree-index walk) and reaches the dial (connect deadline, ALPN)
 * and the CONNECT packet (clean start, keep alive, the 5.0 session
 * block); the request's own knob shadows it; the snapshot carries the
 * ancestor-supplied knobs in the MQTT key order on the settled AND the
 * pre-wire failure paths.
 */

import {
  decodeMqttPacket,
  encodeMqttPacket,
  MQTT_PROTOCOL_VERSIONS,
  type MqttPacket,
  type MqttProtocolVersion,
} from '@openheaders/core/mqtt';
import type { SettingsCarrier } from '@openheaders/core/settings-inheritance';
import type { MqttRequest } from '@openheaders/core/types';
import { executeMqttSession } from '@openheaders/oracle/live/mqtt-exec/execute';
import { closeActiveMqttSession } from '@openheaders/oracle/live/mqtt-exec/session-plane';
import type {
  MqttByteTransport,
  MqttStreamCallbacks,
  MqttTransportRequest,
} from '@openheaders/oracle/live/mqtt-exec/transport';
import { describe, expect, it } from 'vitest';

function makeMqttRequest(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqtt0001',
    path: 'requests/suite-col1/probe-mqtt1',
    name: 'Probe MQTT',
    url: 'mqtts://broker.openheaders.io:8883',
    topic: 'probe/echo',
    payload: 'hello',
    topics: [],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  };
}

function plainResolution(template: string): string {
  return template;
}

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
  };
}

const settleTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const COLLECTION: SettingsCarrier = {
  level: 'collection',
  uid: 'rcol0001',
  name: 'Telemetry',
  settings: {
    keepAlive: 15,
    cleanStart: false,
    timeoutMs: 5_000,
    sessionExpiryInterval: 300,
    alpnProtocol: 'mqtt',
    sslVerification: false,
    // Session knobs of other kinds never reach an MQTT session.
    maxMessageBytes: 1_024,
  },
};
const FOLDER: SettingsCarrier = { level: 'folder', uid: 'rfold001', name: 'Sensors', settings: { keepAlive: 45 } };

describe('executeMqttSession — inherited settings', () => {
  it('the injected chain supplies every absent knob to the dial and the CONNECT; the innermost level wins; the snapshot attributes them', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-set-1',
      resolution: plainResolution,
      settingsChain: [COLLECTION, FOLDER],
    });
    await settleTick();
    expect(rig.wire().timeoutMs).toBe(5_000);
    expect(rig.wire().alpnProtocol).toBe('mqtt');
    expect(rig.wire().sslVerification).toBe(false);
    rig.establish();
    const connect = rig.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT first');
    expect(connect.cleanStart).toBe(false);
    expect(connect.keepAlive).toBe(45);
    expect(connect.properties?.sessionExpiryInterval).toBe(300);
    rig.push({ type: 'connack', sessionPresent: false, reasonCode: 0 });
    closeActiveMqttSession('send-mqtt-set-1');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    expect(snapshot.inheritedSettings).toEqual([
      { key: 'sslVerification', level: 'collection', uid: 'rcol0001', name: 'Telemetry' },
      { key: 'alpnProtocol', level: 'collection', uid: 'rcol0001', name: 'Telemetry' },
      { key: 'timeoutMs', level: 'collection', uid: 'rcol0001', name: 'Telemetry' },
      { key: 'cleanStart', level: 'collection', uid: 'rcol0001', name: 'Telemetry' },
      { key: 'keepAlive', level: 'folder', uid: 'rfold001', name: 'Sensors' },
      { key: 'sessionExpiryInterval', level: 'collection', uid: 'rcol0001', name: 'Telemetry' },
    ]);
  });

  it("the request's own knob shadows the chain's and drops out of the attribution", async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest({ keepAlive: 120, cleanStart: true, timeoutMs: 1_000 }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-set-2',
      resolution: plainResolution,
      settingsChain: [COLLECTION, FOLDER],
    });
    await settleTick();
    expect(rig.wire().timeoutMs).toBe(1_000);
    rig.establish();
    const connect = rig.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT first');
    expect(connect.cleanStart).toBe(true);
    expect(connect.keepAlive).toBe(120);
    closeActiveMqttSession('send-mqtt-set-2');
    const snapshot = await settled;
    expect(snapshot.inheritedSettings?.map((s) => s.key)).toEqual([
      'sslVerification',
      'alpnProtocol',
      'sessionExpiryInterval',
    ]);
  });

  it('a pre-wire failure stamps the attribution too; no chain and no own knobs = no attribution', async () => {
    const rig = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const failed = await executeMqttSession(makeMqttRequest({ url: '' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-set-3',
      resolution: plainResolution,
      settingsChain: [FOLDER],
    });
    expect(failed.outcome).toEqual({ kind: 'failed', error: 'URL is empty' });
    expect(failed.inheritedSettings).toEqual([{ key: 'keepAlive', level: 'folder', uid: 'rfold001', name: 'Sensors' }]);

    const bare = scriptedTransport(MQTT_PROTOCOL_VERSIONS.v5);
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: bare.transport,
      sendId: 'send-mqtt-set-4',
      resolution: plainResolution,
    });
    await settleTick();
    // The reference defaults still dial and CONNECT when nobody sets a knob.
    expect(bare.wire().timeoutMs).toBe(30_000);
    closeActiveMqttSession('send-mqtt-set-4');
    expect((await settled).inheritedSettings).toBeUndefined();
  });
});
