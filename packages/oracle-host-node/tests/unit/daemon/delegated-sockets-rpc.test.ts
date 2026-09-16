/**
 * The DELEGATED socket plane's laws: the context family's gate on the
 * two OPEN channels (opt-in first, the frame's workspace required,
 * `workspace.write` audited, the structural check); a valid open
 * dials the seam's transport and fans the socket's events to the
 * opener's peers alone, tagged by the caller-minted id with a
 * per-socket sequence; the riders write into the socket by its id
 * and answer only its owner; the abort tears it down; a user's
 * sockets die with their last peer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  decision: { allow: true } as { allow: boolean; reason?: string },
  resolveSnapshot: vi.fn(async (_userId: string) => ({ kind: 'fake-snapshot' })),
  hasCapability: vi.fn((_snapshot: unknown, _capability: string, _ctx?: unknown) => h.decision),
  audits: [] as Record<string, unknown>[],
}));

vi.mock('@openheaders/core/identity', () => ({
  resolveDaemonPeerIdentitySnapshot: (userId: string) => h.resolveSnapshot(userId),
  hasCapability: (snapshot: unknown, capability: string, ctx?: unknown) => h.hasCapability(snapshot, capability, ctx),
  emitAuditEntry: (entry: Record<string, unknown>) => {
    h.audits.push(entry);
  },
}));
vi.mock('@openheaders/core/storage', () => ({
  hostStorage: { get: async () => h.settings },
  OH: { settingsUser: 'oh.settingsUser' },
}));

import type { DelegatedSocketEvent, DelegatedSocketOpenResult } from '@openheaders/core/protocol';
import { REMOTE_PEER_EXECUTE_DISABLED_MESSAGE } from '@openheaders/core/protocol';
import type {
  MqttByteTransport,
  MqttStreamCallbacks,
  MqttTransportRequest,
} from '@openheaders/oracle/live/mqtt-exec/transport';
import {
  type WsSessionCallbacks,
  type WsTransport,
  WsTransportError,
  type WsTransportRequest,
} from '@openheaders/oracle/live/ws-exec/transport';
import { createDelegatedSocketsRpc } from '../../../src/daemon/delegated-sockets-rpc';
import { setWsPeerServer } from '../../../src/daemon/ws-peer-slot';
import type { OracleWsServer, PeerChangeListener, PeerSummary } from '../../../src/host-runtime/ws-server';

const PEER = { userId: 'user-1' };
const OTHER = { userId: 'user-2' };

const WS_REQUEST: WsTransportRequest = { url: 'wss://echo.openheaders.io/ws', headers: [], subprotocols: [] };
const MQTT_REQUEST: MqttTransportRequest = { url: 'mqtts://broker.openheaders.io:8883' };

interface FakeWsTransport extends WsTransport {
  sessions: Array<{ request: WsTransportRequest; callbacks: WsSessionCallbacks; signal: AbortSignal | undefined }>;
  sent: string[];
  binary: Uint8Array[];
  closed: Array<{ code: number; reason: string }>;
}

function fakeWsTransport(): FakeWsTransport {
  const t: FakeWsTransport = {
    sessions: [],
    sent: [],
    binary: [],
    closed: [],
    connect: (request, callbacks, signal) => {
      t.sessions.push({ request, callbacks, signal });
      signal?.addEventListener('abort', () => callbacks.onEnd());
      return {
        send: (text) => {
          t.sent.push(text);
        },
        sendBinary: (data) => {
          t.binary.push(data);
        },
        close: (code, reason) => {
          t.closed.push({ code, reason });
        },
      };
    },
  };
  return t;
}

interface FakeMqttTransport extends MqttByteTransport {
  streams: Array<{ request: MqttTransportRequest; callbacks: MqttStreamCallbacks }>;
  written: Uint8Array[];
  ended: number;
}

function fakeMqttTransport(): FakeMqttTransport {
  const t: FakeMqttTransport = {
    streams: [],
    written: [],
    ended: 0,
    connect: (request, callbacks, signal) => {
      t.streams.push({ request, callbacks });
      signal?.addEventListener('abort', () => callbacks.onEnd());
      return {
        write: (bytes) => {
          t.written.push(bytes);
        },
        end: () => {
          t.ended += 1;
        },
      };
    },
  };
  return t;
}

interface FakeServer {
  frames: Array<{ payload: DelegatedSocketEvent; filterPeer?: (p: PeerSummary) => boolean }>;
  peers: PeerSummary[];
  listeners: PeerChangeListener[];
}

function installFakeServer(): FakeServer {
  const fake: FakeServer = { frames: [], peers: [{ userId: 'user-1' } as PeerSummary], listeners: [] };
  setWsPeerServer({
    broadcastFrame: (frame: Record<string, unknown>, opts?: { filterPeer?: (p: PeerSummary) => boolean }) => {
      fake.frames.push({
        payload: frame.payload as DelegatedSocketEvent,
        ...(opts?.filterPeer !== undefined ? { filterPeer: opts.filterPeer } : {}),
      });
    },
    listConnectedPeers: () => fake.peers,
    subscribePeerChange: (listener: PeerChangeListener) => {
      fake.listeners.push(listener);
      return () => {};
    },
  } as unknown as OracleWsServer);
  return fake;
}

function openWs(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: 'delegateWsOpen', socketId: 'sock-1', workspaceId: 'ws-1', request: WS_REQUEST, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.settings = { 'backend.allowRemotePeerExecute': true };
  h.decision = { allow: true };
  h.audits = [];
  setWsPeerServer(null);
});

describe('createDelegatedSocketsRpc — ownership and the gate', () => {
  it('owns the two opens and the five riders', () => {
    const rpc = createDelegatedSocketsRpc({ wsTransport: fakeWsTransport(), mqttTransport: fakeMqttTransport() });
    for (const type of [
      'delegateWsOpen',
      'delegateMqttOpen',
      'delegateWsSend',
      'delegateWsClose',
      'delegateMqttWrite',
      'delegateMqttEnd',
      'delegateSocketAbort',
    ]) {
      expect(rpc.owns(type)).toBe(true);
    }
    expect(rpc.owns('delegateRequest')).toBe(false);
    expect(rpc.owns('executeWebSocketRequest')).toBe(false);
  });

  it('refuses an open while the opt-in is off, requires the workspace, gates on workspace.write audited', async () => {
    const ws = fakeWsTransport();
    const rpc = createDelegatedSocketsRpc({ wsTransport: ws, mqttTransport: fakeMqttTransport() });
    h.settings = {};
    await expect(rpc.dispatch(openWs(), PEER)).rejects.toThrow(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
    h.settings = { 'backend.allowRemotePeerExecute': true };
    await expect(rpc.dispatch(openWs({ workspaceId: undefined }), PEER)).rejects.toThrow(/must name its workspace/);
    h.decision = { allow: false, reason: 'no-workspace-role-assignment' };
    await expect(rpc.dispatch(openWs(), PEER)).rejects.toThrow(
      'permission denied: workspace.write on ws-1 (no-workspace-role-assignment)',
    );
    expect(h.audits).toHaveLength(1);
    expect(ws.sessions).toHaveLength(0);
  });

  it('answers a structured refusal for a malformed open, stamped, without dialing', async () => {
    const ws = fakeWsTransport();
    const rpc = createDelegatedSocketsRpc({ wsTransport: ws, mqttTransport: fakeMqttTransport() });
    const result = (await rpc.dispatch(openWs({ request: { url: 'wss://x' } }), PEER)) as DelegatedSocketOpenResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/^Malformed delegated WebSocket open frame at request\./);
    expect(result.executedOn.kind).toBe('backend');
    expect(ws.sessions).toHaveLength(0);
  });
});

describe('createDelegatedSocketsRpc — a WebSocket', () => {
  it("dials the seam and fans the socket's events to the opener's peers, sequenced; the riders write in", async () => {
    const server = installFakeServer();
    const ws = fakeWsTransport();
    const rpc = createDelegatedSocketsRpc({ wsTransport: ws, mqttTransport: fakeMqttTransport() });
    const opened = (await rpc.dispatch(openWs(), PEER)) as DelegatedSocketOpenResult;
    expect(opened.success).toBe(true);
    expect(ws.sessions[0].request).toEqual(WS_REQUEST);
    const { callbacks } = ws.sessions[0];
    callbacks.onOpen('chat', '', { plane: 'request', proxyUrl: 'http://p:1' });
    callbacks.onMessage({ data: new Uint8Array([104, 105]), binary: false });
    await expect(rpc.dispatch({ type: 'delegateWsSend', socketId: 'sock-1', text: 'hello' }, PEER)).resolves.toEqual({
      success: true,
    });
    await expect(
      rpc.dispatch({ type: 'delegateWsSend', socketId: 'sock-1', binaryBase64: 'AQI=' }, PEER),
    ).resolves.toEqual({ success: true });
    await expect(
      rpc.dispatch({ type: 'delegateWsClose', socketId: 'sock-1', code: 1000, reason: 'bye' }, PEER),
    ).resolves.toEqual({ success: true });
    callbacks.onClose({ code: 1000, reason: 'bye', wasClean: true });
    callbacks.onEnd();
    expect(ws.sent).toEqual(['hello']);
    expect(Array.from(ws.binary[0])).toEqual([1, 2]);
    expect(ws.closed).toEqual([{ code: 1000, reason: 'bye' }]);
    expect(server.frames.map((f) => f.payload.kind)).toEqual(['open', 'message', 'close', 'end']);
    expect(server.frames.map((f) => f.payload.seq)).toEqual([0, 1, 2, 3]);
    expect(server.frames[0].payload).toMatchObject({
      socketId: 'sock-1',
      protocol: 'chat',
      proxyRoute: { plane: 'request' },
    });
    expect(server.frames[1].payload).toMatchObject({ dataBase64: 'aGk=', binary: false });
    for (const frame of server.frames) {
      expect(frame.filterPeer?.({ userId: 'user-1' } as PeerSummary)).toBe(true);
      expect(frame.filterPeer?.({ userId: 'user-2' } as PeerSummary)).toBe(false);
    }
    // Settled sockets forget their riders.
    await expect(rpc.dispatch({ type: 'delegateWsSend', socketId: 'sock-1', text: 'late' }, PEER)).resolves.toEqual({
      success: false,
      error: 'No such socket',
    });
  });

  it("answers another user's rider as no such socket and aborts the opener's", async () => {
    const server = installFakeServer();
    const ws = fakeWsTransport();
    const rpc = createDelegatedSocketsRpc({ wsTransport: ws, mqttTransport: fakeMqttTransport() });
    await rpc.dispatch(openWs(), PEER);
    await expect(rpc.dispatch({ type: 'delegateWsSend', socketId: 'sock-1', text: 'x' }, OTHER)).resolves.toEqual({
      success: false,
      error: 'No such socket',
    });
    await expect(rpc.dispatch({ type: 'delegateSocketAbort', socketId: 'sock-1' }, PEER)).resolves.toEqual({
      success: true,
    });
    expect(ws.sessions[0].signal?.aborted).toBe(true);
    expect(server.frames.at(-1)?.payload.kind).toBe('end');
  });

  it("carries the seam's classified failure on end, hint included, and refuses a duplicate id", async () => {
    const server = installFakeServer();
    const ws = fakeWsTransport();
    const rpc = createDelegatedSocketsRpc({ wsTransport: ws, mqttTransport: fakeMqttTransport() });
    await rpc.dispatch(openWs(), PEER);
    const duplicate = (await rpc.dispatch(openWs(), PEER)) as DelegatedSocketOpenResult;
    expect(duplicate.success).toBe(false);
    ws.sessions[0].callbacks.onEnd(
      new WsTransportError('self signed certificate', {
        kind: 'trust-certificate',
        host: 'echo.openheaders.io',
        port: 443,
        code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
      }),
    );
    expect(server.frames.at(-1)?.payload).toMatchObject({
      kind: 'end',
      error: { message: 'self signed certificate', hint: { kind: 'trust-certificate' } },
    });
  });

  it("tears a user's sockets down when their last peer leaves", async () => {
    const server = installFakeServer();
    const ws = fakeWsTransport();
    const rpc = createDelegatedSocketsRpc({ wsTransport: ws, mqttTransport: fakeMqttTransport() });
    await rpc.dispatch(openWs(), PEER);
    expect(server.listeners).toHaveLength(1);
    server.peers = [];
    server.listeners[0]({ kind: 'disconnect', peer: { userId: 'user-1' } as PeerSummary });
    expect(ws.sessions[0].signal?.aborted).toBe(true);
  });
});

describe('createDelegatedSocketsRpc — an MQTT byte stream', () => {
  it('dials the seam with the resolved mqtts:// dial, fans connect and data, writes and ends by the riders', async () => {
    const server = installFakeServer();
    const mqtt = fakeMqttTransport();
    const rpc = createDelegatedSocketsRpc({ wsTransport: fakeWsTransport(), mqttTransport: mqtt });
    const opened = (await rpc.dispatch(
      { type: 'delegateMqttOpen', socketId: 'sock-m', workspaceId: 'ws-1', request: MQTT_REQUEST },
      PEER,
    )) as DelegatedSocketOpenResult;
    expect(opened.success).toBe(true);
    expect(mqtt.streams[0].request).toEqual(MQTT_REQUEST);
    const { callbacks } = mqtt.streams[0];
    callbacks.onConnect();
    callbacks.onData(new Uint8Array([32, 2, 0, 0]));
    await expect(
      rpc.dispatch({ type: 'delegateMqttWrite', socketId: 'sock-m', bytesBase64: 'EAA=' }, PEER),
    ).resolves.toEqual({ success: true });
    await expect(rpc.dispatch({ type: 'delegateMqttEnd', socketId: 'sock-m' }, PEER)).resolves.toEqual({
      success: true,
    });
    callbacks.onEnd();
    expect(Array.from(mqtt.written[0])).toEqual([16, 0]);
    expect(mqtt.ended).toBe(1);
    expect(server.frames.map((f) => f.payload.kind)).toEqual(['connect', 'data', 'end']);
    expect(server.frames[1].payload).toMatchObject({ dataBase64: 'IAIAAA==' });
  });

  it('refuses a WebSocket rider on an MQTT stream by name', async () => {
    installFakeServer();
    const rpc = createDelegatedSocketsRpc({ wsTransport: fakeWsTransport(), mqttTransport: fakeMqttTransport() });
    await rpc.dispatch(
      { type: 'delegateMqttOpen', socketId: 'sock-m', workspaceId: 'ws-1', request: MQTT_REQUEST },
      PEER,
    );
    await expect(rpc.dispatch({ type: 'delegateWsSend', socketId: 'sock-m', text: 'x' }, PEER)).resolves.toEqual({
      success: false,
      error: 'Not a WebSocket',
    });
  });
});
