/**
 * Oracle WS server — peer registry surface.
 *
 * Exercises `listConnectedPeers()` / `subscribePeerChange()` end-to-end
 * against a real bound server: a loopback `ws` client completes the
 * HELLO handshake and we assert the peer shows up in the snapshot and
 * fires a connect event, then drops on disconnect. Auth is mandatory on
 * every connection — loopback included — so each client presents a
 * paired token; we mint a real `DaemonAuthToken` against an in-memory
 * `HostStorage` fake and pass its secret as `hello.authToken`, then
 * assert the connected peer carries the minted token id.
 *
 * Runs under Electron's Node ABI via this package's test script (the
 * `ws` dependency is pure JS, but the server shares the build with the
 * SQLite-backed log that needs the Electron ABI).
 */

import { createServer } from 'node:net';
import { mintDaemonAuthToken } from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { PROTOCOL_VERSION, SYNC_HELLO_TYPE, SYNC_WELCOME_TYPE } from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import {
  type OracleWsServer,
  type PeerChangeEvent,
  startOracleWsServer,
} from '@openheaders/oracle-host-node/host-runtime/ws-server';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ClientOptions } from 'ws';
import { WebSocket } from 'ws';
import { createHostStorageFake } from './_host-storage-fake';

const IDENTITY = { role: 'desktop' as const, nodeId: 'host-node-1', agent: '@openheaders/desktop@test' };

let server: OracleWsServer | null = null;
const clients: WebSocket[] = [];
let authSecret = '';
let authTokenId = '';

async function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function hello(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: SYNC_HELLO_TYPE,
    protocolVersion: PROTOCOL_VERSION,
    role: 'extension',
    nodeId: 'ext-node-1',
    workspaceId: 'ws-1',
    agent: '@openheaders/extension@test',
    authToken: authSecret,
    ...overrides,
  });
}

/** Connect a loopback client and resolve once its HELLO is accepted. */
async function connectAccepted(port: number, helloFrame: string, options?: ClientOptions): Promise<WebSocket> {
  const client = new WebSocket(`ws://127.0.0.1:${port}`, options);
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once('open', () => resolve());
    client.once('error', reject);
  });
  const welcome = new Promise<{ accepted: boolean }>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === SYNC_WELCOME_TYPE) resolve(msg);
    });
  });
  client.send(helloFrame);
  const result = await welcome;
  expect(result.accepted).toBe(true);
  return client;
}

function waitForFrame(client: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === type) resolve(msg);
    });
  });
}

function nextEvent(srv: OracleWsServer, kind: PeerChangeEvent['kind']): Promise<PeerChangeEvent> {
  return new Promise<PeerChangeEvent>((resolve) => {
    const unsubscribe = srv.subscribePeerChange((event) => {
      if (event.kind === kind) {
        unsubscribe();
        resolve(event);
      }
    });
  });
}

beforeAll(() => {
  // The server logs at boot; install a silent host logger so the
  // `requireHostLogger` guard is satisfied without console noise.
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

beforeEach(async () => {
  server = null;
  clients.length = 0;
  // Mandatory auth: provision a fresh token ledger + one paired token
  // whose secret the test clients present in HELLO.
  setHostStorage(createHostStorageFake());
  const minted = await mintDaemonAuthToken({ label: 'peer-test' });
  authSecret = minted.secret;
  authTokenId = minted.record.id;
});

afterEach(async () => {
  for (const client of clients) {
    try {
      client.close();
    } catch {
      // ignore
    }
  }
  clients.length = 0;
  await server?.close();
  server = null;
});

describe('OracleWsServer — peer registry', () => {
  it('lists a loopback peer and fires a connect event after handshake', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const connected = nextEvent(server, 'connect');
    await connectAccepted(port, hello());
    const event = await connected;

    expect(event.peer.role).toBe('extension');
    expect(event.peer.isLoopback).toBe(true);
    expect(event.peer.tokenId).toBe(authTokenId);

    const peers = server.listConnectedPeers();
    expect(peers).toHaveLength(1);
    expect(peers[0]).toMatchObject({
      role: 'extension',
      agent: '@openheaders/extension@test',
      workspaceId: 'ws-1',
      isLoopback: true,
      tokenId: authTokenId,
    });
    expect(server.connectedCount()).toBe(1);
  });

  it('drops the peer and fires a disconnect event when the client closes', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const connected = nextEvent(server, 'connect');
    const client = await connectAccepted(port, hello());
    await connected;
    expect(server.listConnectedPeers()).toHaveLength(1);

    const disconnected = nextEvent(server, 'disconnect');
    client.close();
    const event = await disconnected;

    expect(event.kind).toBe('disconnect');
    expect(event.peer.role).toBe('extension');
    expect(server.listConnectedPeers()).toHaveLength(0);
    expect(server.connectedCount()).toBe(0);
  });

  it('tracks multiple concurrent peers independently', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const firstConnected = nextEvent(server, 'connect');
    await connectAccepted(port, hello({ nodeId: 'ext-a' }));
    await firstConnected;

    const secondConnected = nextEvent(server, 'connect');
    await connectAccepted(port, hello({ nodeId: 'ext-b', workspaceId: 'ws-2' }));
    await secondConnected;

    const peers = server.listConnectedPeers();
    expect(peers).toHaveLength(2);
    expect(peers.every((p) => p.isLoopback)).toBe(true);
    expect(new Set(peers.map((p) => p.workspaceId))).toEqual(new Set(['ws-1', 'ws-2']));
  });

  it('rejects a loopback HELLO that presents no paired token (mandatory auth)', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('open', () => resolve());
      client.once('error', reject);
    });
    const welcome = await new Promise<{ accepted: boolean; reason?: string }>((resolve) => {
      client.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === SYNC_WELCOME_TYPE) resolve(msg);
      });
      // No token — trust-by-process is gone, so even loopback is gated.
      client.send(hello({ authToken: undefined }));
    });
    expect(welcome.accepted).toBe(false);
    expect(welcome.reason).toBe('auth-required');
    expect(server.connectedCount()).toBe(0);
  });

  it('rejects a loopback HELLO that presents an unknown token', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('open', () => resolve());
      client.once('error', reject);
    });
    const welcome = await new Promise<{ accepted: boolean; reason?: string }>((resolve) => {
      client.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === SYNC_WELCOME_TYPE) resolve(msg);
      });
      client.send(hello({ authToken: 'oh_not-a-real-token' }));
    });
    expect(welcome.accepted).toBe(false);
    expect(welcome.reason).toBe('auth-required');
    // Auth refusal is retriable — 1008, never the 4001 protocol-mismatch
    // code the client latches on and stops redialing.
    const closeCode = await new Promise<number>((resolve) => {
      client.once('close', (code) => resolve(code));
    });
    expect(closeCode).toBe(1008);
    expect(server.connectedCount()).toBe(0);
  });

  it('closes an oversized inbound frame (maxPayload DoS bound) pre-handshake', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('open', () => resolve());
      client.once('error', reject);
    });
    // An over-cap socket close arrives as a transport error and/or a 1009
    // close on the client; swallow the error so it doesn't go unhandled.
    client.on('error', () => {});
    const closed = new Promise<number>((resolve) => {
      client.once('close', (code) => resolve(code));
    });
    // One byte past the 8 MiB inbound cap, sent BEFORE the HELLO — the
    // frame is rejected at the WS layer before any application parsing,
    // which is the pre-auth memory-amplification bound A-4 closes.
    client.send(Buffer.alloc(8 * 1024 * 1024 + 1));
    expect(await closed).toBe(1009);
    expect(server.connectedCount()).toBe(0);
  });

  it('stops notifying after the subscription is dropped', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    let calls = 0;
    const unsubscribe = server.subscribePeerChange(() => {
      calls += 1;
    });
    unsubscribe();

    const connected = nextEvent(server, 'connect');
    await connectAccepted(port, hello());
    await connected;

    expect(calls).toBe(0);
  });
});

describe('OracleWsServer — WS-B reach gate (loopbackOnly broadcast)', () => {
  it('delivers a loopback-only frame to a same-device peer', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const connected = nextEvent(server, 'connect');
    const client = await connectAccepted(port, hello());
    expect((await connected).peer.isLoopback).toBe(true);

    const got = waitForFrame(client, 'test.vault');
    server.broadcastFrame({ type: 'test.vault', secret: 'seed' }, { loopbackOnly: true });
    expect((await got).secret).toBe('seed');
  });

  it('withholds a loopback-only frame from an off-device peer but still delivers unrestricted frames', async () => {
    const port = await freePort();
    // Inject an off-device classification so a real loopback client is
    // treated as a LAN/WAN peer (plan §10 fault injection).
    server = await startOracleWsServer({
      host: '127.0.0.1',
      port,
      handshakeIdentity: IDENTITY,
      classifyLoopback: () => false,
    });

    const connected = nextEvent(server, 'connect');
    const client = await connectAccepted(port, hello());
    expect((await connected).peer.isLoopback).toBe(false);

    const received: string[] = [];
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'test.vault' || msg.type === 'test.rule') received.push(msg.type);
    });

    // Restricted frame goes first; the unrestricted sentinel follows on the
    // same ordered socket. If the gate holds, only the sentinel arrives.
    const sentinel = waitForFrame(client, 'test.rule');
    server.broadcastFrame({ type: 'test.vault', secret: 'seed' }, { loopbackOnly: true });
    server.broadcastFrame({ type: 'test.rule', id: 'r1' }, { loopbackOnly: false });
    await sentinel;

    expect(received).toEqual(['test.rule']);
  });
});

describe('OracleWsServer — closePeersByTokenId (revocation eviction)', () => {
  it('evicts the live peer authenticated with the given token and fires disconnect', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const connected = nextEvent(server, 'connect');
    await connectAccepted(port, hello());
    await connected;
    expect(server.connectedCount()).toBe(1);

    const disconnected = nextEvent(server, 'disconnect');
    const evicted = server.closePeersByTokenId(authTokenId);
    expect(evicted).toBe(1);

    const event = await disconnected;
    expect(event.kind).toBe('disconnect');
    expect(event.peer.tokenId).toBe(authTokenId);
    expect(server.connectedCount()).toBe(0);
    expect(server.listConnectedPeers()).toHaveLength(0);
  });

  it('leaves peers authenticated with a different token connected', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    // A second paired device with its own token id.
    const other = await mintDaemonAuthToken({ label: 'peer-other' });

    const firstConnected = nextEvent(server, 'connect');
    await connectAccepted(port, hello({ nodeId: 'ext-a' }));
    await firstConnected;

    const secondConnected = nextEvent(server, 'connect');
    await connectAccepted(port, hello({ nodeId: 'ext-b', authToken: other.secret }));
    await secondConnected;
    expect(server.connectedCount()).toBe(2);

    const disconnected = nextEvent(server, 'disconnect');
    const evicted = server.closePeersByTokenId(authTokenId);
    expect(evicted).toBe(1);
    await disconnected;

    const survivors = server.listConnectedPeers();
    expect(survivors).toHaveLength(1);
    expect(survivors[0].tokenId).toBe(other.record.id);
  });

  it('returns 0 when no peer holds the token', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const connected = nextEvent(server, 'connect');
    await connectAccepted(port, hello());
    await connected;

    expect(server.closePeersByTokenId('token-nobody-holds')).toBe(0);
    expect(server.connectedCount()).toBe(1);
  });
});

describe('OracleWsServer — heartbeat liveness sweep', () => {
  it('terminates a peer that stops answering heartbeats and fires disconnect', async () => {
    const port = await freePort();
    server = await startOracleWsServer({
      host: '127.0.0.1',
      port,
      handshakeIdentity: IDENTITY,
      // Fast sweep so eviction lands in ~2 ticks instead of 30s.
      heartbeatIntervalMs: 40,
    });

    const connected = nextEvent(server, 'connect');
    // `autoPong: false` → the client receives the server's protocol PING
    // but never replies, simulating a half-dead peer (TCP up, app
    // unresponsive). No clean close is sent, so only the heartbeat sweep
    // can reap it.
    await connectAccepted(port, hello(), { autoPong: false });
    await connected;
    expect(server.connectedCount()).toBe(1);

    const event = await nextEvent(server, 'disconnect');
    expect(event.kind).toBe('disconnect');
    expect(event.peer.role).toBe('extension');
    expect(server.connectedCount()).toBe(0);
    expect(server.listConnectedPeers()).toHaveLength(0);
  });

  it('keeps an auto-ponging peer connected across multiple sweeps', async () => {
    const port = await freePort();
    server = await startOracleWsServer({
      host: '127.0.0.1',
      port,
      handshakeIdentity: IDENTITY,
      heartbeatIntervalMs: 30,
    });

    const connected = nextEvent(server, 'connect');
    // Default client auto-pongs at the protocol layer, so it must survive
    // several sweep cycles — no false-positive eviction of a live peer.
    await connectAccepted(port, hello());
    await connected;

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(server.connectedCount()).toBe(1);
    expect(server.listConnectedPeers()).toHaveLength(1);
  });
});
