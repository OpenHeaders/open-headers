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
async function connectAccepted(port: number, helloFrame: string): Promise<WebSocket> {
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
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
