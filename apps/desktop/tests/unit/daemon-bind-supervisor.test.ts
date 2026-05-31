/**
 * Desktop daemon WS-bind supervisor — bind lifecycle signalling.
 *
 * Pins the `onBindStateChange` contract that the sync status reporter
 * depends on: a healthy boot emits binding→bound, a failed bind emits
 * binding→failed (and leaves no server), and a `backend.bindAddress` /
 * `backend.bindPort` change rebinds in place — closing the old server
 * and emitting a fresh binding→bound for the new host:port.
 *
 * `startOracleWsServer` and host storage are mocked; no real socket is
 * bound.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type DaemonBindState, startDaemonBindSupervisor } from '../../src/main/daemon-bind-supervisor';

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let settingsValue: Record<string, unknown> = {};
let settingsListener: ((next: Record<string, unknown> | undefined) => void) | null = null;

vi.mock('@openheaders/core/storage', () => ({
  OH: { settingsUser: 'oh.settings.user' },
  hostStorage: {
    get: vi.fn(async () => settingsValue),
    subscribe: vi.fn((_key: string, cb: (next: Record<string, unknown> | undefined) => void) => {
      settingsListener = cb;
      return () => {
        settingsListener = null;
      };
    }),
  },
}));

interface FakeServer {
  host: string;
  port: number;
  close: ReturnType<typeof vi.fn>;
}

const startMock = vi.fn<(opts: { host: string; port: number }) => Promise<FakeServer>>();

vi.mock('@openheaders/oracle-host-node/host-runtime/ws-server', () => ({
  startOracleWsServer: (opts: { host: string; port: number }) => startMock(opts),
}));

const IDENTITY = { role: 'desktop' as const, nodeId: 'node-1', agent: '@openheaders/desktop@test' };

/** Let the inflight reconcile chain (start + close promises) drain. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function makeServer(host: string, port: number): FakeServer {
  return { host, port, close: vi.fn(async () => undefined) };
}

beforeEach(() => {
  settingsValue = {};
  settingsListener = null;
  startMock.mockReset();
  startMock.mockImplementation(async ({ host, port }) => makeServer(host, port));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('daemon-bind-supervisor — bind lifecycle', () => {
  it('emits binding→bound and hands over the server on a healthy boot', async () => {
    const states: DaemonBindState[] = [];
    const servers: Array<{ host: string } | null> = [];

    const supervisor = await startDaemonBindSupervisor({
      handshakeIdentity: IDENTITY,
      onServerChange: (s) => servers.push(s as { host: string } | null),
      onBindStateChange: (s) => states.push(s),
    });

    expect(states).toEqual([
      { kind: 'binding', host: '127.0.0.1', port: 8137 },
      { kind: 'bound', host: '127.0.0.1', port: 8137 },
    ]);
    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({ host: '127.0.0.1', port: 8137 });

    await supervisor.dispose();
  });

  it('honours an initial 0.0.0.0 setting', async () => {
    settingsValue = { 'backend.bindAddress': '0.0.0.0' };
    const states: DaemonBindState[] = [];

    const supervisor = await startDaemonBindSupervisor({
      handshakeIdentity: IDENTITY,
      onServerChange: () => {},
      onBindStateChange: (s) => states.push(s),
    });

    expect(states).toEqual([
      { kind: 'binding', host: '0.0.0.0', port: 8137 },
      { kind: 'bound', host: '0.0.0.0', port: 8137 },
    ]);

    await supervisor.dispose();
  });

  it('honours an initial backend.bindPort setting', async () => {
    settingsValue = { 'backend.bindPort': 9000 };
    const states: DaemonBindState[] = [];

    const supervisor = await startDaemonBindSupervisor({
      handshakeIdentity: IDENTITY,
      onServerChange: () => {},
      onBindStateChange: (s) => states.push(s),
    });

    expect(states).toEqual([
      { kind: 'binding', host: '127.0.0.1', port: 9000 },
      { kind: 'bound', host: '127.0.0.1', port: 9000 },
    ]);
    expect(startMock).toHaveBeenCalledWith(expect.objectContaining({ host: '127.0.0.1', port: 9000 }));

    await supervisor.dispose();
  });

  it('falls back to the default port when the stored port is unbindable', async () => {
    // 80 is privileged → `validatePort` rejects → supervisor uses WS_PORT.
    settingsValue = { 'backend.bindPort': 80 };
    const states: DaemonBindState[] = [];

    const supervisor = await startDaemonBindSupervisor({
      handshakeIdentity: IDENTITY,
      onServerChange: () => {},
      onBindStateChange: (s) => states.push(s),
    });

    expect(states).toEqual([
      { kind: 'binding', host: '127.0.0.1', port: 8137 },
      { kind: 'bound', host: '127.0.0.1', port: 8137 },
    ]);

    await supervisor.dispose();
  });

  it('emits binding→failed and leaves no server when the bind throws', async () => {
    const cause = new Error('EADDRINUSE');
    startMock.mockRejectedValueOnce(cause);
    const states: DaemonBindState[] = [];
    const servers: Array<{ host: string } | null> = [];

    const supervisor = await startDaemonBindSupervisor({
      handshakeIdentity: IDENTITY,
      onServerChange: (s) => servers.push(s as { host: string } | null),
      onBindStateChange: (s) => states.push(s),
    });

    expect(states).toEqual([
      { kind: 'binding', host: '127.0.0.1', port: 8137 },
      { kind: 'failed', host: '127.0.0.1', port: 8137, error: cause },
    ]);
    // Catch path calls setServer(null); no server was ever handed over.
    expect(servers).toEqual([null]);

    await supervisor.dispose();
  });

  it('rebinds in place when backend.bindAddress flips, closing the old server', async () => {
    const states: DaemonBindState[] = [];
    const servers: Array<FakeServer | null> = [];

    const supervisor = await startDaemonBindSupervisor({
      handshakeIdentity: IDENTITY,
      onServerChange: (s) => servers.push(s as FakeServer | null),
      onBindStateChange: (s) => states.push(s),
    });

    const firstServer = servers[0];
    expect(firstServer).toMatchObject({ host: '127.0.0.1', port: 8137 });

    // User flips "Allow LAN peers" → setting changes to 0.0.0.0.
    settingsListener?.({ 'backend.bindAddress': '0.0.0.0' });
    await flush();

    expect(states).toEqual([
      { kind: 'binding', host: '127.0.0.1', port: 8137 },
      { kind: 'bound', host: '127.0.0.1', port: 8137 },
      { kind: 'binding', host: '0.0.0.0', port: 8137 },
      { kind: 'bound', host: '0.0.0.0', port: 8137 },
    ]);
    // Old server torn down: null handed over before the new server.
    expect(firstServer?.close).toHaveBeenCalledTimes(1);
    expect(servers).toEqual([
      expect.objectContaining({ host: '127.0.0.1', port: 8137 }),
      null,
      expect.objectContaining({ host: '0.0.0.0', port: 8137 }),
    ]);

    await supervisor.dispose();
  });

  it('rebinds in place when backend.bindPort changes, closing the old server', async () => {
    const states: DaemonBindState[] = [];
    const servers: Array<FakeServer | null> = [];

    const supervisor = await startDaemonBindSupervisor({
      handshakeIdentity: IDENTITY,
      onServerChange: (s) => servers.push(s as FakeServer | null),
      onBindStateChange: (s) => states.push(s),
    });

    const firstServer = servers[0];

    // User changes the daemon port in Settings → Backend.
    settingsListener?.({ 'backend.bindPort': 9000 });
    await flush();

    expect(states).toEqual([
      { kind: 'binding', host: '127.0.0.1', port: 8137 },
      { kind: 'bound', host: '127.0.0.1', port: 8137 },
      { kind: 'binding', host: '127.0.0.1', port: 9000 },
      { kind: 'bound', host: '127.0.0.1', port: 9000 },
    ]);
    expect(firstServer?.close).toHaveBeenCalledTimes(1);
    expect(servers).toEqual([expect.objectContaining({ port: 8137 }), null, expect.objectContaining({ port: 9000 })]);

    await supervisor.dispose();
  });

  it('ignores a setting change that does not move the bind target', async () => {
    const states: DaemonBindState[] = [];

    const supervisor = await startDaemonBindSupervisor({
      handshakeIdentity: IDENTITY,
      onServerChange: () => {},
      onBindStateChange: (s) => states.push(s),
    });

    settingsListener?.({ 'backend.bindAddress': '127.0.0.1', 'backend.bindPort': 8137 });
    await flush();

    // No rebind — still just the boot pair.
    expect(states).toEqual([
      { kind: 'binding', host: '127.0.0.1', port: 8137 },
      { kind: 'bound', host: '127.0.0.1', port: 8137 },
    ]);

    await supervisor.dispose();
  });
});
