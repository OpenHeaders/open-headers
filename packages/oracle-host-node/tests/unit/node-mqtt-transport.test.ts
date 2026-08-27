/**
 * Node MQTT transport — real-wire pins against a live in-test broker
 * speaking through the SAME `@openheaders/core/mqtt` codec (no mocked
 * sockets, the actual byte stream): the full driver round trip over
 * raw TCP (CONNECT/CONNACK, open-time SUBSCRIBE with SUBACK grants,
 * publish echo both directions, clean DISCONNECT), the refused-dial
 * classification, and the MQTT-over-WebSocket leg (the `mqtt`
 * subprotocol offered, packets riding BINARY frames both ways over the
 * reused node WS transport).
 */

import 'reflect-metadata';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import * as net from 'node:net';
import * as tls from 'node:tls';
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
import { mintLeafCertificate, mintProxyCa } from '../../src/daemon/proxy/ca-store';
import { createNodeMqttTransport } from '../../src/live/node-mqtt-transport';

const closers: Array<() => void> = [];

afterEach(() => {
  for (const close of closers.splice(0)) close();
});

/** Broker-side packet logic shared by the TCP and WS rigs: accept the
 *  CONNECT, grant SUBSCRIBEs at the requested QoS, echo QoS 0
 *  publishes back on their topic, close on DISCONNECT. */
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

function keyPem(pkcs8B64: string): string {
  const body = pkcs8B64.match(/.{1,64}/g)?.join('\n') ?? pkcs8B64;
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

/** An `mqtts:` listener whose leaf chains to a freshly minted private
 *  CA — nothing in the runtime bundle vouches for it. The handshake is
 *  the whole proof; it never has to speak MQTT. */
async function startPrivateCaTlsListener(): Promise<{ port: number; rootPem: string }> {
  const ca = await mintProxyCa();
  const leaf = await mintLeafCertificate(ca, ['127.0.0.1']);
  const server = tls.createServer({ key: keyPem(leaf.privateKeyPkcs8B64), cert: leaf.certPem }, (socket) => {
    socket.on('error', () => {});
  });
  closers.push(() => server.close());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no listen address');
  return { port: address.port, rootPem: ca.certPem };
}

/** Dial the byte transport once and report how the handshake settled. */
function dialOnce(url: string, trustedRootsPem?: string[]): Promise<{ connected: boolean; error?: string }> {
  return new Promise((resolve) => {
    let connected = false;
    const writer = createNodeMqttTransport().connect(
      { url, timeoutMs: 5_000, ...(trustedRootsPem !== undefined ? { trustedRootsPem } : {}) },
      {
        onConnect: () => {
          connected = true;
          writer.end();
        },
        onData: () => {},
        onEnd: (error) => resolve({ connected, ...(error !== undefined ? { error: error.message } : {}) }),
      },
    );
  });
}

async function startTcpBroker(): Promise<number> {
  const server = net.createServer((socket) => {
    const decoder = createMqttStreamDecoder(MQTT_PROTOCOL_VERSIONS.v5);
    const write = (packet: MqttPacket): void => {
      const encoded = encodeMqttPacket(packet, MQTT_PROTOCOL_VERSIONS.v5);
      if (!encoded.ok) throw new Error(encoded.error);
      socket.write(encoded.bytes);
    };
    socket.on('data', (chunk) => {
      for (const event of decoder.push(new Uint8Array(chunk))) {
        if (!event.ok) throw new Error(`broker saw a malformed packet: ${event.error}`);
        brokerAnswer(event.packet, write, () => socket.end());
      }
    });
  });
  closers.push(() => server.close());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no listen address');
  return address.port;
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
    uid: 'mqttnode',
    path: 'requests/suite-col1/probe-node',
    name: 'Probe Node',
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

describe('createNodeMqttTransport', () => {
  it('runs the full session over raw TCP: CONNACK open, SUBACK grants, publish echo, clean DISCONNECT', async () => {
    const port = await startTcpBroker();
    const items: string[] = [];
    const settled = executeMqttSession(makeMqttRequest(`mqtt://127.0.0.1:${port}`), {
      workspaceId: null,
      environmentId: undefined,
      transport: createNodeMqttTransport(),
      sendId: 'node-mqtt-tcp',
      resolution: passthroughResolution,
      emitStreamEvent: (event) => {
        if (event.kind === 'items') for (const item of event.items) items.push(item.kind);
      },
    });
    await until(() => items.includes('subscribed'));
    const published = publishActiveMqttMessage('node-mqtt-tcp', { topic: 'probe/echo', payload: 'over-tcp' });
    expect(published).toEqual({ success: true });
    await until(() => items.filter((k) => k === 'message').length >= 2);
    closeActiveMqttSession('node-mqtt-tcp');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    expect(snapshot.end).toEqual({ by: 'client' });
    const subscribed = snapshot.events.find((e) => e.kind === 'subscribed');
    expect(subscribed).toEqual({ kind: 'subscribed', grants: [{ topicFilter: 'probe/#', reasonCode: 1 }] });
    const messages = snapshot.events.filter((e) => e.kind === 'message');
    expect(messages.map((m) => m.direction)).toEqual(['up', 'down']);
  });

  it('classifies a refused dial as the user-actionable connection error', async () => {
    // Bind then close — the port is free and refuses.
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', () => resolve()));
    const address = probe.address();
    if (address === null || typeof address === 'string') throw new Error('no listen address');
    const deadPort = address.port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const snapshot = await executeMqttSession(makeMqttRequest(`mqtt://127.0.0.1:${deadPort}`), {
      workspaceId: null,
      environmentId: undefined,
      transport: createNodeMqttTransport(),
      sendId: 'node-mqtt-refused',
      resolution: passthroughResolution,
    });
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain(`Connection refused by 127.0.0.1:${deadPort}`);
  });

  it('rides MQTT-over-WebSocket: the mqtt subprotocol offered, packets on binary frames both ways', async () => {
    const broker = await startWsBroker();
    const items: string[] = [];
    const settled = executeMqttSession(makeMqttRequest(`ws://127.0.0.1:${broker.port}/mqtt`), {
      workspaceId: null,
      environmentId: undefined,
      transport: createNodeMqttTransport(),
      sendId: 'node-mqtt-ws',
      resolution: passthroughResolution,
      emitStreamEvent: (event) => {
        if (event.kind === 'items') for (const item of event.items) items.push(item.kind);
      },
    });
    await until(() => items.includes('subscribed'));
    expect(broker.seenProtocol()).toBe('mqtt');
    const published = publishActiveMqttMessage('node-mqtt-ws', { topic: 'probe/echo', payload: 'over-ws' });
    expect(published).toEqual({ success: true });
    await until(() => items.filter((k) => k === 'message').length >= 2);
    closeActiveMqttSession('node-mqtt-ws');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    const messages = snapshot.events.filter((e) => e.kind === 'message');
    expect(messages.map((m) => `${m.direction}:${Buffer.from(m.payloadBase64, 'base64').toString('utf8')}`)).toEqual([
      'up:over-ws',
      'down:over-ws',
    ]);
  });
});

describe('createNodeMqttTransport — workspace trusted roots', () => {
  it('a private-CA mqtts: listener handshakes once its root rides the request; the bare dial fails', async () => {
    const { port, rootPem } = await startPrivateCaTlsListener();
    const bare = await dialOnce(`mqtts://127.0.0.1:${port}`);
    expect(bare.connected).toBe(false);
    expect(bare.error).toBeDefined();
    const rooted = await dialOnce(`mqtts://127.0.0.1:${port}`, [rootPem]);
    expect(rooted.connected).toBe(true);
  });
});
