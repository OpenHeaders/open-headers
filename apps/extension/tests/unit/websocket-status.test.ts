import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let settingsStore: Record<string, unknown> = {};

vi.mock('@/workbench/settings/store', () => ({
  get: vi.fn((key: string) => settingsStore[key]),
  subscribeKey: vi.fn(() => () => undefined),
}));

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
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@utils/bridge', () => ({
  broadcast: vi.fn(),
}));

vi.mock('@/background/modules/recording-sync', () => ({
  handleRecordingInboundMessage: vi.fn(() => false),
  requestInitialRecordingSync: vi.fn(),
}));

vi.mock('@/background/safari-websocket-adapter', () => ({
  adaptWebSocketUrl: vi.fn((url: string) => url),
  safariPreCheck: vi.fn(() => Promise.resolve(true)),
}));

import { connectWebSocket } from '@/background/websocket';
import { __resetStatusForTests, getStatusSnapshot } from '@/shared/status';

function syncEntry() {
  return getStatusSnapshot().sync;
}

describe('websocket sync Status subsystem', () => {
  beforeEach(() => {
    __resetStatusForTests();
    settingsStore = {
      'desktop.connection.autoConnect': true,
      'desktop.connection.url': 'ws://127.0.0.1:59210',
      'desktop.connection.reconnectDelayMs': 1000,
      'desktop.connection.maxReconnectDelayMs': 30000,
      'desktop.connection.pingIntervalMs': 0,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    __resetStatusForTests();
  });

  it('reports green "Desktop sync disabled" when autoConnect is off', async () => {
    settingsStore['desktop.connection.autoConnect'] = false;
    const result = await connectWebSocket();
    expect(result).toBe(false);
    const entry = syncEntry();
    expect(entry?.state).toBe('green');
    expect(entry?.message).toBe('Desktop sync disabled');
  });

  it('reports yellow "URL rejected" when settings returns empty url', async () => {
    settingsStore['desktop.connection.url'] = '';
    const result = await connectWebSocket();
    expect(result).toBe(false);
    const entry = syncEntry();
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toBe('Desktop URL rejected by settings');
  });

  it('reports green "Connected to desktop" when the socket opens', async () => {
    const fakeSockets: FakeSocket[] = [];
    class FakeSocket {
      onopen: (() => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      onclose: (() => void) | null = null;
      onmessage: ((e: MessageEvent) => void) | null = null;
      readyState = 0;
      url: string;
      constructor(url: string) {
        this.url = url;
        fakeSockets.push(this);
      }
      send(): void {}
      close(): void {
        this.readyState = 3;
        this.onclose?.();
      }
    }
    const prevWS = globalThis.WebSocket;
    const prevFetch = globalThis.fetch;
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response())) as typeof fetch;

    try {
      await connectWebSocket();
      // Let the `checkServerReachable` → `connectStandardWebSocket` chain resolve.
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      expect(fakeSockets).toHaveLength(1);
      fakeSockets[0].readyState = 1;
      fakeSockets[0].onopen?.();
      const entry = syncEntry();
      expect(entry?.state).toBe('green');
      expect(entry?.message).toBe('Connected to desktop');
    } finally {
      globalThis.WebSocket = prevWS;
      globalThis.fetch = prevFetch;
    }
  });

  it('reports yellow "Connecting…" on first failure, "Reconnecting (attempt N)" after more', async () => {
    const fakeSockets: FakeSocket[] = [];
    class FakeSocket {
      onopen: (() => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      onclose: (() => void) | null = null;
      onmessage: ((e: MessageEvent) => void) | null = null;
      readyState = 0;
      url: string;
      constructor(url: string) {
        this.url = url;
        fakeSockets.push(this);
      }
      send(): void {}
      close(): void {
        this.readyState = 3;
        this.onclose?.();
      }
    }
    const prevWS = globalThis.WebSocket;
    const prevFetch = globalThis.fetch;
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response())) as typeof fetch;

    try {
      await connectWebSocket();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      expect(fakeSockets.length).toBeGreaterThanOrEqual(1);
      // First close — handleConnectionFailure runs, attempts becomes 1
      fakeSockets[0].onclose?.();
      let entry = syncEntry();
      expect(entry?.state).toBe('yellow');
      expect(entry?.message).toBe('Connecting to desktop…');
      // Force another attempt sequence; fast-forward by directly calling connectWebSocket again
      await connectWebSocket();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      const latest = fakeSockets[fakeSockets.length - 1];
      latest.onclose?.();
      entry = syncEntry();
      expect(entry?.state).toBe('yellow');
      expect(entry?.message).toMatch(/Reconnecting \(attempt \d+\)/);
    } finally {
      globalThis.WebSocket = prevWS;
      globalThis.fetch = prevFetch;
    }
  });
});
