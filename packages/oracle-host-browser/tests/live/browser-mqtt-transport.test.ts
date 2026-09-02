/**
 * Browser MQTT transport — real-wire pins against a live in-test
 * broker speaking through the SAME `@openheaders/core/mqtt` codec (the
 * node twin's discipline: no mocked sockets). The test runtime's
 * global `WebSocket` is the same platform-constructor contract the
 * page realm exposes — url + subprotocols only. Covers the full driver
 * round trip over MQTT-over-WebSocket (the `mqtt` subprotocol offered,
 * packets riding BINARY frames both ways — the broker throws on a text
 * frame), the honest tcp-scheme refusal (mqtt:// dials a raw TCP
 * socket no browser page can open), and the classified no-detail dial
 * failure.
 */

import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import {
  createMqttStreamDecoder,
  encodeMqttPacket,
  MQTT_PROTOCOL_VERSIONS,
  type MqttPacket,
} from '@openheaders/core/mqtt';
import type { MqttRequest } from '@openheaders/core/types';
import { executeMqttSession } from '@openheaders/oracle/live/mqtt-exec/execute';
import { closeActiveMqttSession, publishActiveMqttMessage } from '@openheaders/oracle/live/mqtt-exec/session-plane';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { createBrowserMqttTransport } from '../../src/live/browser-mqtt-transport';

const closers: Array<() => void> = [];

afterEach(() => {
  for (const close of closers.splice(0)) close();
});

/** Broker-side packet logic: accept the CONNECT, grant SUBSCRIBEs at
 *  the requested QoS, echo QoS 0 publishes back on their topic, close
 *  on DISCONNECT — the node twin's rig. */
function brokerAnswer(packet: MqttPacket, write: (packet: MqttPacket) => void, close: () => void): void {
  switch (packet.type) {
    case 'connect':
      write({ type: 'connack', sessionPresent: false, reasonCode: 0 });
      return;
    case 'subscribe':
      write({ type: 'suback', packetId: packet.packetId, reasonCodes: packet.subscriptions.map((s) => s.qos) });
      return;
    case 'publish':
      if (packet.qos === 0) {
        write({
          type: 'publish',
          topic: packet.topic,
          payload: packet.payload,
          qos: 0,
          retain: false,
          dup: false,
          packetId: null,
        });
      }
      return;
    case 'disconnect':
      close();
      return;
    default:
      return;
  }
}

async function startWsBroker(): Promise<{ port: number; seenProtocol: () => string | false }> {
  const httpServer: HttpServer = createHttpServer();
  let protocol: string | false = false;
  const wss = new WebSocketServer({
    server: httpServer,
    handleProtocols: (protocols) => {
      protocol = protocols.has('mqtt') ? 'mqtt' : false;
      return protocol;
    },
  });
  wss.on('connection', (ws) => {
    const decoder = createMqttStreamDecoder(MQTT_PROTOCOL_VERSIONS.v5);
    const write = (packet: MqttPacket): void => {
      const encoded = encodeMqttPacket(packet, MQTT_PROTOCOL_VERSIONS.v5);
      if (!encoded.ok) throw new Error(encoded.error);
      ws.send(encoded.bytes, { binary: true });
    };
    ws.on('message', (data, isBinary) => {
      if (!isBinary) throw new Error('MQTT-over-WebSocket packets must ride binary frames');
      const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as Buffer);
      for (const event of decoder.push(new Uint8Array(bytes))) {
        if (!event.ok) throw new Error(`broker saw a malformed packet: ${event.error}`);
        brokerAnswer(event.packet, write, () => ws.close());
      }
    });
  });
  closers.push(() => {
    wss.close();
    httpServer.close();
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const address = httpServer.address();
  if (address === null || typeof address === 'string') throw new Error('no listen address');
  return { port: address.port, seenProtocol: () => protocol };
}

function makeMqttRequest(url: string, overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqttbrsr',
    path: 'requests/suite-col1/probe-browser',
    name: 'Probe Browser',
    url,
    topic: 'probe/echo',
    payload: 'hello',
    topics: [{ uid: 'row00001', topicFilter: 'probe/#', qos: 1 }],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  };
}

const passthroughResolution = (template: string): string => template;

/** Poll until the predicate holds — real-wire arrival timing. */
async function until(predicate: () => boolean, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('condition never held');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('createBrowserMqttTransport', () => {
  it('runs the full session in the page realm: mqtt subprotocol, binary frames, echo, clean DISCONNECT', async () => {
    const broker = await startWsBroker();
    const items: string[] = [];
    const settled = executeMqttSession(makeMqttRequest(`ws://127.0.0.1:${broker.port}/mqtt`), {
      workspaceId: null,
      environmentId: undefined,
      transport: createBrowserMqttTransport(),
      sendId: 'browser-mqtt-ws',
      resolution: passthroughResolution,
      emitStreamEvent: (event) => {
        if (event.kind === 'items') for (const item of event.items) items.push(item.kind);
      },
    });
    await until(() => items.includes('subscribed'));
    expect(broker.seenProtocol()).toBe('mqtt');
    const published = await publishActiveMqttMessage('browser-mqtt-ws', { topic: 'probe/echo', payload: 'over-page' });
    expect(published).toEqual({ success: true });
    await until(() => items.filter((k) => k === 'message').length >= 2);
    closeActiveMqttSession('browser-mqtt-ws');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    expect(snapshot.end).toEqual({ by: 'client' });
    const subscribed = snapshot.events.find((e) => e.kind === 'subscribed');
    expect(subscribed).toEqual({ kind: 'subscribed', grants: [{ topicFilter: 'probe/#', reasonCode: 1 }] });
    const messages = snapshot.events.filter((e) => e.kind === 'message');
    expect(messages.map((m) => `${m.direction}:${Buffer.from(m.payloadBase64, 'base64').toString('utf8')}`)).toEqual([
      'up:over-page',
      'down:over-page',
    ]);
  });

  it('refuses a tcp scheme honestly — no silent downgrade to ws', async () => {
    const snapshot = await executeMqttSession(makeMqttRequest('mqtt://broker.openheaders.io:1883'), {
      workspaceId: null,
      environmentId: undefined,
      transport: createBrowserMqttTransport(),
      sendId: 'browser-mqtt-tcp',
      resolution: passthroughResolution,
    });
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain('raw TCP socket, which a browser page cannot open');
    expect(snapshot.outcome.error).toContain('ws:// or wss://');
  });

  it('classifies a refused dial with the platform-honest no-detail message', async () => {
    const snapshot = await executeMqttSession(makeMqttRequest('ws://127.0.0.1:59996/mqtt'), {
      workspaceId: null,
      environmentId: undefined,
      transport: createBrowserMqttTransport(),
      sendId: 'browser-mqtt-refused',
      resolution: passthroughResolution,
    });
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain('Could not open a WebSocket session to 127.0.0.1:59996');
  });
});
