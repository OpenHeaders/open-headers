/**
 * websocket.ts — the N-socket connection manager (MULTI_BACKEND_PLAN.md
 * §3). Pins the reconcile behavior the cap lift introduced:
 *
 *   - one socket per enabled registry record, dialed concurrently
 *   - removing / disabling a record tears down ITS socket only
 *   - a shape change (url/token/autoConnect) re-dials only its wire;
 *     bookkeeping writes (label, lastConnectedAt) never re-dial
 *   - `sendToBackend` routes to the addressed wire's socket
 *   - inbound frames reach handlers with the delivering wire's handle
 *
 * The manager's wire map is module-level state, so each case
 * `resetModules()` + re-imports `websocket.ts` with a scripted registry
 * mirror (list + notify) and a socket fake.
 */
import type { BackendConnection } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let settingsStore: Record<string, unknown> = {};
let backends: BackendConnection[] = [];
const registrySubscribers = new Set<() => void>();

function notifyBackends(): void {
  for (const fn of [...registrySubscribers]) fn();
}

vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn((key: string) => settingsStore[key]),
  subscribeKey: vi.fn(() => () => undefined),
}));

vi.mock('@openheaders/core/backends', () => ({
  getBackends: vi.fn(() => backends),
  isLoopbackBackendUrl: vi.fn((url: string) => /127\.|localhost|\[?::1\]?/.test(url)),
  subscribeBackends: vi.fn((fn: () => void) => {
    registrySubscribers.add(fn);
    return () => registrySubscribers.delete(fn);
  }),
  updateBackend: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@utils/browser-api', () => ({
  isChrome: true,
  isEdge: false,
  isFirefox: false,
  isSafari: false,
  runtime: { getManifest: vi.fn(() => ({ version: '5.0.0' })) },
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@utils/bridge', () => ({ broadcast: vi.fn() }));

vi.mock('@/background/safari-websocket-adapter', () => ({
  adaptWebSocketUrl: vi.fn((url: string) => url),
  safariPreCheck: vi.fn(() => Promise.resolve(true)),
}));

function makeRecord(id: string, overrides: Partial<BackendConnection> = {}): BackendConnection {
  return {
    id,
    label: '',
    url: `ws://127.0.0.1:59210`,
    authToken: '',
    autoConnect: true,
    enabled: true,
    addedAt: '2026-07-01T00:00:00.000Z',
    lastConnectedAt: null,
    ...overrides,
  };
}

/** A WebSocket stand-in the transport drives via the handlers it assigns. */
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e?: CloseEvent) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  readyState = 0;
  url: string;
  sentFrames: string[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentFrames.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }
}

async function loadManager() {
  vi.resetModules();
  const status = await import('@openheaders/ui/shared/status');
  status.__resetStatusForTests();
  // The adapter install wires the chrome-bound deps; the manager API
  // itself comes from the canonical oracle module.
  await import('@/background/websocket');
  return import('@openheaders/oracle/sync/client/backend-connection-manager');
}

/** Let the `probeReachable` → `openSocket` async chain settle. */
async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

async function withFakeSockets<T>(fn: () => Promise<T>): Promise<T> {
  FakeSocket.instances = [];
  const prevWS = globalThis.WebSocket;
  const prevFetch = globalThis.fetch;
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  globalThis.fetch = vi.fn(() => Promise.resolve(new Response())) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.WebSocket = prevWS;
    globalThis.fetch = prevFetch;
  }
}

const socketFor = (url: string): FakeSocket | undefined => FakeSocket.instances.find((s) => s.url === url && !s.closed);

beforeEach(() => {
  settingsStore = {
    'backend.reconnectDelayMs': 1000,
    'backend.maxReconnectDelayMs': 30000,
    'backend.pingIntervalMs': 0,
  };
  backends = [];
  registrySubscribers.clear();
  vi.clearAllMocks();
});

describe('backend connection manager — N-socket reconcile', () => {
  it('dials one socket per enabled record and skips disabled ones', async () => {
    backends = [
      makeRecord('a', { url: 'ws://127.0.0.1:59210' }),
      makeRecord('b', { url: 'ws://192.168.1.50:59210' }),
      makeRecord('c', { url: 'ws://10.0.0.7:59210', enabled: false }),
    ];
    const ws = await loadManager();
    await withFakeSockets(async () => {
      await ws.connectWebSocket();
      await flush();
      expect(FakeSocket.instances.map((s) => s.url).sort()).toEqual([
        'ws://127.0.0.1:59210',
        'ws://192.168.1.50:59210',
      ]);
    });
  });

  it('tears down exactly the removed record’s socket; the other wire stays live', async () => {
    backends = [makeRecord('a', { url: 'ws://127.0.0.1:59210' }), makeRecord('b', { url: 'ws://192.168.1.50:59210' })];
    const ws = await loadManager();
    await withFakeSockets(async () => {
      await ws.connectWebSocket();
      await flush();
      socketFor('ws://127.0.0.1:59210')!.open();
      socketFor('ws://192.168.1.50:59210')!.open();
      expect(ws.isBackendConnected('a')).toBe(true);
      expect(ws.isBackendConnected('b')).toBe(true);

      const socketA = socketFor('ws://127.0.0.1:59210')!;
      const socketB = socketFor('ws://192.168.1.50:59210')!;
      backends = [backends[0]!];
      notifyBackends();
      await flush();

      expect(socketB.closed).toBe(true);
      expect(socketA.closed).toBe(false);
      expect(ws.isBackendConnected('a')).toBe(true);
      expect(ws.isBackendConnected('b')).toBe(false);
    });
  });

  it('disabling a record is the same teardown as removing it', async () => {
    backends = [makeRecord('a', { url: 'ws://127.0.0.1:59210' }), makeRecord('b', { url: 'ws://192.168.1.50:59210' })];
    const ws = await loadManager();
    await withFakeSockets(async () => {
      await ws.connectWebSocket();
      await flush();
      const socketB = socketFor('ws://192.168.1.50:59210')!;
      backends = [backends[0]!, { ...backends[1]!, enabled: false }];
      notifyBackends();
      await flush();
      expect(socketB.closed).toBe(true);
      expect(socketFor('ws://127.0.0.1:59210')!.closed).toBe(false);
      expect(ws.shouldAttemptBackendConnection()).toBe(true);
    });
  });

  it('re-dials only the wire whose connection shape changed; bookkeeping never re-dials', async () => {
    backends = [makeRecord('a', { url: 'ws://127.0.0.1:59210' }), makeRecord('b', { url: 'ws://192.168.1.50:59210' })];
    const ws = await loadManager();
    await withFakeSockets(async () => {
      await ws.connectWebSocket();
      await flush();
      const socketA = socketFor('ws://127.0.0.1:59210')!;
      const socketB = socketFor('ws://192.168.1.50:59210')!;
      socketA.open();
      socketB.open();

      // Bookkeeping write — lastConnectedAt stamp. No socket churn.
      backends = [{ ...backends[0]!, lastConnectedAt: '2026-07-08T00:00:00.000Z' }, backends[1]!];
      notifyBackends();
      await flush();
      expect(socketA.closed).toBe(false);
      expect(socketB.closed).toBe(false);

      // Shape change on B — only B's socket is torn down + re-dialed.
      backends = [backends[0]!, { ...backends[1]!, url: 'ws://192.168.1.51:59210' }];
      notifyBackends();
      await flush();
      expect(socketA.closed).toBe(false);
      expect(socketB.closed).toBe(true);
      expect(socketFor('ws://192.168.1.51:59210')).toBeDefined();
    });
  });

  it('sendToBackend routes to the addressed wire; sendViaWebSocket prefers the loopback wire', async () => {
    backends = [
      makeRecord('lan', { url: 'ws://192.168.1.50:59210' }),
      makeRecord('loop', { url: 'ws://127.0.0.1:59210' }),
    ];
    const ws = await loadManager();
    await withFakeSockets(async () => {
      await ws.connectWebSocket();
      await flush();
      const socketLan = socketFor('ws://192.168.1.50:59210')!;
      const socketLoop = socketFor('ws://127.0.0.1:59210')!;
      socketLan.open();
      socketLoop.open();

      expect(ws.sendToBackend('lan', { type: 'x' })).toBe(true);
      expect(socketLan.sentFrames).toEqual([JSON.stringify({ type: 'x' })]);
      expect(socketLoop.sentFrames).toEqual([]);

      expect(ws.sendToBackend('missing', { type: 'x' })).toBe(false);

      // Device-local seam: the loopback wire wins over the LAN wire.
      expect(ws.getDefaultWireBackendId()).toBe('loop');
      expect(ws.sendViaWebSocket({ type: 'focusApp' })).toBe(true);
      expect(socketLoop.sentFrames).toEqual([JSON.stringify({ type: 'focusApp' })]);
    });
  });

  it('routes inbound frames with the delivering wire’s handle', async () => {
    backends = [makeRecord('a', { url: 'ws://127.0.0.1:59210' }), makeRecord('b', { url: 'ws://192.168.1.50:59210' })];
    const ws = await loadManager();
    await withFakeSockets(async () => {
      const seen: Array<{ backendId: string; type: unknown }> = [];
      ws.registerInboundFrameHandler((frame, wire) => {
        seen.push({ backendId: wire.backendId, type: (frame as { type?: unknown }).type });
        return true;
      });
      await ws.connectWebSocket();
      await flush();
      const socketA = socketFor('ws://127.0.0.1:59210')!;
      const socketB = socketFor('ws://192.168.1.50:59210')!;
      socketA.open();
      socketB.open();

      socketA.onmessage?.({ data: JSON.stringify({ type: 'from-a' }) } as MessageEvent);
      socketB.onmessage?.({ data: JSON.stringify({ type: 'from-b' }) } as MessageEvent);
      await flush();

      expect(seen).toEqual([
        { backendId: 'a', type: 'from-a' },
        { backendId: 'b', type: 'from-b' },
      ]);
    });
  });

  it('open/close subscribers receive the wire that transitioned', async () => {
    backends = [makeRecord('a', { url: 'ws://127.0.0.1:59210' }), makeRecord('b', { url: 'ws://192.168.1.50:59210' })];
    const ws = await loadManager();
    await withFakeSockets(async () => {
      const opened: string[] = [];
      const closed: string[] = [];
      ws.subscribeOnWebSocketOpen((wire) => opened.push(wire.backendId));
      ws.subscribeOnWebSocketClose((wire) => closed.push(wire.backendId));
      await ws.connectWebSocket();
      await flush();
      socketFor('ws://127.0.0.1:59210')!.open();
      socketFor('ws://192.168.1.50:59210')!.open();
      expect(opened.sort()).toEqual(['a', 'b']);

      socketFor('ws://192.168.1.50:59210')!.close();
      expect(closed).toEqual(['b']);
    });
  });

  it('wire lifecycle events fire on create + remove with the wire handle', async () => {
    const ws = await loadManager();
    const events: string[] = [];
    ws.subscribeWireLifecycle((event) => events.push(`${event.kind}:${event.wire.backendId}`));
    await withFakeSockets(async () => {
      backends = [makeRecord('a')];
      notifyBackends();
      await flush();
      expect(events).toEqual(['created:a']);

      backends = [];
      notifyBackends();
      await flush();
      expect(events).toEqual(['created:a', 'removed:a']);
    });
  });
});
