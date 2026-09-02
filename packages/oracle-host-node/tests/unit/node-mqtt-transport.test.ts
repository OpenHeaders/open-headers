/**
 * Node MQTT transport — real-wire pins against a live in-test broker
 * speaking through the SAME `@openheaders/core/mqtt` codec (no mocked
 * sockets, the actual byte stream): the full driver round trip over
 * raw TCP (CONNECT/CONNACK, open-time SUBSCRIBE with SUBACK grants,
 * publish echo both directions, clean DISCONNECT), the refused-dial
 * classification, the MQTT-over-WebSocket leg (the `mqtt` subprotocol
 * offered, packets riding BINARY frames both ways over the reused node
 * WS transport, the whole TLS policy handed through to a `wss:` dial),
 * and the dial policy on the raw socket: the request's own CONNECT
 * proxy (the rig records the tunnel target and the credential), the
 * ambient chain, the 407 honesty, the SOCKS5 pre-wire refusal, and the
 * address pin dialing where it points.
 */

import 'reflect-metadata';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
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
import type { MqttTransportRequest } from '@openheaders/oracle/live/mqtt-exec/transport';
import type { WsProxyRoute } from '@openheaders/oracle/live/ws-exec/transport';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { mintLeafCertificate, mintProxyCa } from '../../src/daemon/proxy/ca-store';
import { createNodeMqttTransport, type NodeMqttTransportOptions } from '../../src/live/node-mqtt-transport';
import type { SystemProxyEntry, SystemProxyResolver } from '../../src/live/system-proxy/types';
import { startConnectProxy } from './request-transport/connect-proxy-rig';

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
function dialOnce(
  url: string,
  trustedRootsPem?: string[],
  request: Partial<MqttTransportRequest> = {},
  options: NodeMqttTransportOptions = { systemProxy: null },
): Promise<{ connected: boolean; error?: string; route?: WsProxyRoute }> {
  return new Promise((resolve) => {
    let connected = false;
    let route: WsProxyRoute | undefined;
    const writer = createNodeMqttTransport(options).connect(
      { url, timeoutMs: 5_000, ...(trustedRootsPem !== undefined ? { trustedRootsPem } : {}), ...request },
      {
        onConnect: (proxyRoute) => {
          connected = true;
          route = proxyRoute;
          writer.end();
        },
        onData: () => {},
        onEnd: (error) =>
          resolve({
            connected,
            ...(error !== undefined ? { error: error.message } : {}),
            ...(route !== undefined ? { route } : {}),
          }),
      },
    );
  });
}

const resolverOf = (entries: SystemProxyEntry[]): SystemProxyResolver => ({
  resolve: () => Promise.resolve({ entries, source: 'system' }),
});

/** A `wss:` broker whose leaf chains to a freshly minted private CA —
 *  the handshake plus the `mqtt` subprotocol accept are the proof. */
async function startPrivateCaWssListener(): Promise<{ port: number; rootPem: string }> {
  const ca = await mintProxyCa();
  const leaf = await mintLeafCertificate(ca, ['127.0.0.1']);
  const httpsServer = createHttpsServer({ key: keyPem(leaf.privateKeyPkcs8B64), cert: leaf.certPem });
  const wss = new WebSocketServer({ server: httpsServer, handleProtocols: () => 'mqtt' });
  wss.on('connection', (ws) => ws.on('error', () => {}));
  closers.push(() => {
    wss.close();
    httpsServer.close();
    httpsServer.closeAllConnections();
  });
  await new Promise<void>((resolve) => httpsServer.listen(0, '127.0.0.1', () => resolve()));
  const address = httpsServer.address();
  if (address === null || typeof address === 'string') throw new Error('no listen address');
  return { port: address.port, rootPem: ca.certPem };
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
    const published = await publishActiveMqttMessage('node-mqtt-tcp', { topic: 'probe/echo', payload: 'over-tcp' });
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
    const published = await publishActiveMqttMessage('node-mqtt-ws', { topic: 'probe/echo', payload: 'over-ws' });
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

describe('createNodeMqttTransport — the dial policy on the raw socket', () => {
  const proxyCleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    await Promise.all(proxyCleanups.splice(0).map((close) => close()));
  });

  it("tunnels mqtt:// through the request's own CONNECT proxy with its credential and stamps the request plane", async () => {
    const port = await startTcpBroker();
    const proxy = await startConnectProxy({ requireAuth: 'corp:secret' });
    proxyCleanups.push(proxy.close);
    const run = await dialOnce(
      `mqtt://127.0.0.1:${port}`,
      undefined,
      { proxyMode: 'url', proxyUrl: proxy.url, proxyCredentialRef: 'corp-proxy', proxyCredential: 'corp:secret' },
      { systemProxy: { resolve: () => Promise.reject(new Error('must not be consulted')) } },
    );
    expect(run.error).toBeUndefined();
    expect(run.connected).toBe(true);
    expect(proxy.tunnels).toEqual([`127.0.0.1:${port}`]);
    expect(proxy.authHeaders[0]).toBe(`Basic ${Buffer.from('corp:secret').toString('base64')}`);
    expect(run.route).toEqual({ plane: 'request', proxyUrl: proxy.url });
  });

  it('rides an ambient CONNECT answer and stamps the system plane; Direct opts out of it', async () => {
    const port = await startTcpBroker();
    const proxy = await startConnectProxy();
    proxyCleanups.push(proxy.close);
    const ambient = await dialOnce(
      `mqtt://127.0.0.1:${port}`,
      undefined,
      {},
      {
        systemProxy: resolverOf([{ kind: 'proxy', url: proxy.url }]),
      },
    );
    expect(ambient.error).toBeUndefined();
    expect(ambient.route).toEqual({ plane: 'system', proxyUrl: proxy.url, source: 'system' });
    const direct = await dialOnce(
      `mqtt://127.0.0.1:${port}`,
      undefined,
      { proxyMode: 'direct' },
      {
        systemProxy: resolverOf([{ kind: 'proxy', url: proxy.url }]),
      },
    );
    expect(direct.error).toBeUndefined();
    expect(direct.route).toEqual({ plane: 'request' });
    expect(proxy.tunnels).toEqual([`127.0.0.1:${port}`]);
  });

  it("classifies a 407 against the request's proxy-credentials setting, and refuses an explicit SOCKS5 proxy before the wire", async () => {
    const port = await startTcpBroker();
    const proxy = await startConnectProxy({ requireAuth: 'corp:secret' });
    proxyCleanups.push(proxy.close);
    const rejected = await dialOnce(`mqtt://127.0.0.1:${port}`, undefined, {
      proxyMode: 'url',
      proxyUrl: proxy.url,
    });
    expect(rejected.connected).toBe(false);
    expect(rejected.error).toContain('requires authentication (407)');
    expect(rejected.error).toContain("request's proxy-credentials setting");
    const socks = await dialOnce(`mqtt://127.0.0.1:${port}`, undefined, {
      proxyMode: 'url',
      proxyUrl: 'socks5://socks.openheaders.io:1080',
    });
    expect(socks.connected).toBe(false);
    expect(socks.error).toContain('HTTP CONNECT only');
  });

  it('the address pin dials where it points while the URL keeps its host', async () => {
    const port = await startTcpBroker();
    const run = await dialOnce(`mqtt://broker.openheaders.io:${port}`, undefined, { resolveToAddress: '127.0.0.1' });
    expect(run.error).toBeUndefined();
    expect(run.connected).toBe(true);
  });

  it('hands the whole TLS policy through to a wss:// dial — the workspace root vouches for the broker', async () => {
    const { port, rootPem } = await startPrivateCaWssListener();
    const untrusted = await dialOnce(`wss://127.0.0.1:${port}/mqtt`);
    expect(untrusted.connected).toBe(false);
    const trusted = await dialOnce(`wss://127.0.0.1:${port}/mqtt`, [rootPem]);
    expect(trusted.error).toBeUndefined();
    expect(trusted.connected).toBe(true);
  });
});
