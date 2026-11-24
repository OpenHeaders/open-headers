/**
 * Oracle WS server — the inbound frame limit, against a real bound
 * server. Asserts:
 *   - the WELCOME states the limit the server enforces
 *   - a frame at the limit is taken
 *   - a frame over it closes the peer, and the disconnect event says the
 *     server closed it for frame size
 *   - an ordinary disconnect carries no cause
 *
 * Runs under Electron's Node ABI via this package's test script, like
 * the other real-server suites.
 */

import { createServer } from 'node:net';
import { ensureSyntheticIdentity, mintDaemonAuthToken } from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import {
  DEFAULT_MAX_FRAME_BYTES,
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_WELCOME_TYPE,
} from '@openheaders/core/protocol';
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

/** Connect a loopback client; resolve with it and its accepting WELCOME. */
async function connectWelcomed(port: number): Promise<{ client: WebSocket; welcome: Record<string, unknown> }> {
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  clients.push(client);
  // The server closing this socket is the point of two cases below.
  client.on('error', () => undefined);
  await new Promise<void>((resolve, reject) => {
    client.once('open', () => resolve());
    client.once('error', reject);
  });
  const welcomed = new Promise<Record<string, unknown>>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (msg.type === SYNC_WELCOME_TYPE) resolve(msg);
    });
  });
  client.send(
    JSON.stringify({
      type: SYNC_HELLO_TYPE,
      protocolVersion: PROTOCOL_VERSION,
      role: 'extension',
      nodeId: 'ext-node-1',
      workspaceId: 'ws-1',
      agent: '@openheaders/extension@test',
      authToken: authSecret,
    }),
  );
  const welcome = await welcomed;
  expect(welcome.accepted).toBe(true);
  return { client, welcome };
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

/** A frame no handler owns, padded to exactly `bytes` on the wire. */
function paddedFrame(bytes: number): string {
  const shell = JSON.stringify({ type: 'oh.test.padding', pad: '' });
  return JSON.stringify({ type: 'oh.test.padding', pad: 'x'.repeat(bytes - shell.length) });
}

beforeAll(() => {
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

beforeEach(async () => {
  server = null;
  clients.length = 0;
  setHostStorage(createHostStorageFake());
  await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
  authSecret = (await mintDaemonAuthToken({ label: 'frame-limit-test' })).secret;
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

describe('OracleWsServer — the inbound frame limit', () => {
  it('states its limit on the WELCOME', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const { welcome } = await connectWelcomed(port);
    expect(welcome.maxFrameBytes).toBe(DEFAULT_MAX_FRAME_BYTES);
  });

  it('takes a frame at the limit and keeps the peer', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const connected = nextEvent(server, 'connect');
    const { client } = await connectWelcomed(port);
    await connected;

    client.send(paddedFrame(DEFAULT_MAX_FRAME_BYTES));
    // A ping the server answers proves the big frame before it was taken.
    const ponged = new Promise<void>((resolve) => {
      client.on('message', (raw) => {
        if ((JSON.parse(raw.toString()) as { type?: string }).type === 'pong') resolve();
      });
    });
    client.send(JSON.stringify({ type: 'ping', t: 1 }));
    await ponged;
    expect(server.connectedCount()).toBe(1);
  });

  it('closes a peer whose frame is over the limit, and says why', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const connected = nextEvent(server, 'connect');
    const { client } = await connectWelcomed(port);
    await connected;

    const disconnected = nextEvent(server, 'disconnect');
    client.send(paddedFrame(DEFAULT_MAX_FRAME_BYTES + 1));
    const event = await disconnected;
    expect(event.cause).toBe('frame-too-large');
    expect(server.connectedCount()).toBe(0);
  });

  it('an ordinary disconnect carries no cause', async () => {
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const connected = nextEvent(server, 'connect');
    const { client } = await connectWelcomed(port);
    await connected;

    const disconnected = nextEvent(server, 'disconnect');
    client.close();
    const event = await disconnected;
    expect(event.cause).toBeUndefined();
  });
});
