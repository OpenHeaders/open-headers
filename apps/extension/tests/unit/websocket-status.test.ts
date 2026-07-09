/**
 * websocket.ts — sync Status subsystem wiring.
 *
 * The connection manager's wire map is module-level state, so each case
 * `resetModules()` + re-imports `websocket.ts` and the status module
 * together: a fresh import graph means fresh wires + a status snapshot
 * the re-imported manager writes (via the per-backend aggregate) into
 * the same instance the test reads back.
 */
import type { BackendConnection } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let settingsStore: Record<string, unknown> = {};
let primary: BackendConnection | null = null;

vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn((key: string) => settingsStore[key]),
  subscribeKey: vi.fn(() => () => undefined),
}));

vi.mock('@openheaders/core/backends', () => ({
  getBackends: vi.fn(() => (primary ? [primary] : [])),
  isLoopbackBackendUrl: vi.fn((url: string) => /127\.|localhost|\[?::1\]?/.test(url)),
  subscribeBackends: vi.fn(() => () => undefined),
  updateBackend: vi.fn(() => Promise.resolve(primary)),
}));

function makePrimary(overrides: Partial<BackendConnection> = {}): BackendConnection {
  return {
    id: 'backend-1',
    label: '',
    url: 'ws://127.0.0.1:8137',
    authToken: '',
    autoConnect: true,
    enabled: true,
    addedAt: '2026-07-01T00:00:00.000Z',
    lastConnectedAt: null,
    ...overrides,
  };
}

vi.mock('@utils/browser-api', () => ({
  isChrome: true,
  isEdge: false,
  isFirefox: false,
  isSafari: false,
  runtime: { getManifest: vi.fn(() => ({ version: '5.0.0' })) },
  storage: {
    local: {
      set: vi.fn((_i: unknown, cb?: () => void) => cb?.()),
      get: vi.fn((_k: unknown, cb?: (r: Record<string, unknown>) => void) => cb?.({})),
    },
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@utils/bridge', () => ({ broadcast: vi.fn() }));

vi.mock('@/background/safari-websocket-adapter', () => ({
  adaptWebSocketUrl: vi.fn((url: string) => url),
  safariPreCheck: vi.fn(() => Promise.resolve(true)),
}));

/** A re-import of `websocket.ts` plus the status reader it shares. */
async function loadWebsocket() {
  vi.resetModules();
  const status = await import('@openheaders/ui/shared/status');
  status.__resetStatusForTests();
  const { connectWebSocket } = await import('@/background/websocket');
  // The roll-up sink lives in the aggregate's extension install — the
  // manager writes slots, this maps them onto the `sync` subsystem.
  await import('@/background/sync-status-aggregate');
  return { connectWebSocket, syncEntry: () => status.getStatusSnapshot().sync };
}

/** A WebSocket stand-in the transport drives via the handlers it assigns. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e?: CloseEvent) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  readyState = 0;
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  send(): void {}

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

/** Run `fn` with `WebSocket` + `fetch` faked so the connect path resolves. */
async function withFakeSocket<T>(fn: () => Promise<T>): Promise<T> {
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

/** Let the `probeReachable` → `openSocket` async chain settle. */
async function flushMicrotasks(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('websocket sync Status subsystem', () => {
  beforeEach(() => {
    settingsStore = {
      'backend.reconnectDelayMs': 1000,
      'backend.maxReconnectDelayMs': 30000,
      'backend.pingIntervalMs': 0,
    };
    primary = makePrimary();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const status = await import('@openheaders/ui/shared/status');
    status.__resetStatusForTests();
  });

  it('reports green "Running in this browser" when no backend is enabled', async () => {
    primary = null;
    const { connectWebSocket, syncEntry } = await loadWebsocket();
    const result = await connectWebSocket();
    expect(result).toBe(false);
    expect(syncEntry()?.state).toBe('green');
    expect(syncEntry()?.message).toBe('Running in this browser');
  });

  it('reports green "Back-end sync disabled" when autoConnect is off', async () => {
    primary = makePrimary({ autoConnect: false });
    const { connectWebSocket, syncEntry } = await loadWebsocket();
    const result = await connectWebSocket();
    expect(result).toBe(false);
    expect(syncEntry()?.state).toBe('green');
    expect(syncEntry()?.message).toBe('Back-end sync disabled');
  });

  it('reports yellow "URL rejected" when the primary record has an empty url', async () => {
    primary = makePrimary({ url: '' });
    const { connectWebSocket, syncEntry } = await loadWebsocket();
    const result = await connectWebSocket();
    expect(result).toBe(false);
    expect(syncEntry()?.state).toBe('yellow');
    expect(syncEntry()?.message).toBe('Desktop URL rejected by settings');
  });

  it('reports green "Connected to back-end" when the socket opens', async () => {
    const { connectWebSocket, syncEntry } = await loadWebsocket();
    await withFakeSocket(async () => {
      await connectWebSocket();
      await flushMicrotasks();
      expect(FakeSocket.instances).toHaveLength(1);
      FakeSocket.instances[0].readyState = 1;
      FakeSocket.instances[0].onopen?.();
      expect(syncEntry()?.state).toBe('green');
      expect(syncEntry()?.message).toBe('Connected to back-end');
    });
  });

  it('reports "Connecting…" on the first failure, "Reconnecting (attempt N)" after more', async () => {
    const { connectWebSocket, syncEntry } = await loadWebsocket();
    await withFakeSocket(async () => {
      await connectWebSocket();
      await flushMicrotasks();
      expect(FakeSocket.instances.length).toBeGreaterThanOrEqual(1);

      // First close → backoff, attempts = 1.
      FakeSocket.instances[0].close();
      expect(syncEntry()?.state).toBe('yellow');
      expect(syncEntry()?.message).toBe('Connecting to back-end…');

      // Fast-forward the pending backoff with a fresh connect, then fail again.
      await connectWebSocket();
      await flushMicrotasks();
      FakeSocket.instances[FakeSocket.instances.length - 1].close();
      expect(syncEntry()?.state).toBe('yellow');
      expect(syncEntry()?.message).toMatch(/Reconnecting \(attempt \d+\)/);
    });
  });
});
