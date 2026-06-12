/**
 * WebSocket / EventSource wrapper — runtime contract for ws and sse rules.
 *
 * Asserts the constructor wrappers installed by content-scripts.ts:
 *
 *   - URL gate: only sockets/streams matching the rule's URL conditions
 *     are intercepted; everything else passes through untouched.
 *   - modify: matching frames/events are replaced (re-dispatched with the
 *     rule payload); non-matching ones flow through.
 *   - drop: matching frames/events never reach page listeners; a content
 *     filter only matches string data, so binary frames pass through.
 *   - inject: synthesizes a frame/event on open or after a matching
 *     message (auto-responder).
 *   - constructor statics survive wrapping; instances come from the
 *     original constructor so `instanceof` keeps working.
 *   - every action fires the `__ohFire` postMessage bridge with the rule
 *     uid.
 */

import type { SseRule, WsRule } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildSseInjection, buildWsInjection, type FuncInjection } from '@openheaders/rule-engine/content-scripts';

// ── Fakes (jsdom ships neither WebSocket nor EventSource) ──────────

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  url: string;
  readyState = FakeWebSocket.OPEN;
  sent: unknown[] = [];
  constructor(url: string | URL, _protocols?: string | string[]) {
    super();
    this.url = typeof url === 'string' ? url : url.href;
  }
  send(data: unknown): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  url: string;
  readyState = FakeEventSource.OPEN;
  constructor(url: string | URL, _init?: EventSourceInit) {
    super();
    this.url = typeof url === 'string' ? url : url.href;
  }
  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }
}

interface WindowWithStreams {
  WebSocket: typeof FakeWebSocket;
  EventSource: typeof FakeEventSource;
}

const win = window as unknown as WindowWithStreams;
let postMessageSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  win.WebSocket = FakeWebSocket;
  win.EventSource = FakeEventSource;
  postMessageSpy = vi.spyOn(window, 'postMessage');
});

afterEach(() => {
  postMessageSpy.mockRestore();
});

function installFunc(injection: FuncInjection): void {
  (injection.func as (cfg: unknown) => void)(injection.args[0]);
}

function firedUids(): string[] {
  const calls = postMessageSpy.mock.calls as unknown[][];
  return calls
    .map((c: unknown[]) => c[0] as { __ohFire?: boolean; ruleUid?: string })
    .filter((p: { __ohFire?: boolean }) => p && p.__ohFire === true)
    .map((p: { ruleUid?: string }) => p.ruleUid ?? '');
}

const WS_URL = 'wss://stream.openheaders.io/feed';
const SSE_URL = 'https://api.openheaders.io/events';

function wsRule(action: WsRule['action']): WsRule {
  return {
    schemaVersion: 5,
    uid: 'wsr00001',
    path: 'rules/ws',
    name: 'WS',
    type: 'ws',
    enabled: true,
    conditions: [{ uid: 'tcd00050', type: 'url-filter', values: ['wss://stream.openheaders.io/*'] }],
    action,
  };
}

function sseRule(action: SseRule['action']): SseRule {
  return {
    schemaVersion: 5,
    uid: 'sse00001',
    path: 'rules/sse',
    name: 'SSE',
    type: 'sse',
    enabled: true,
    conditions: [{ uid: 'tcd00051', type: 'request-domains', values: ['api.openheaders.io'] }],
    action,
  };
}

function message(data: unknown): MessageEvent {
  return new MessageEvent('message', { data });
}

/** Injection delivery is deferred one tick (lands after its trigger). */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1));
}

// ── WebSocket ───────────────────────────────────────────────────────

describe('ws wrapper — receive side', () => {
  it('modify replaces matching incoming frames; page listener sees the payload', () => {
    installFunc(buildWsInjection(wsRule({ operation: 'modify', direction: 'receive', payload: '{"mocked":1}' })));
    const ws = new win.WebSocket(WS_URL);
    const seen: unknown[] = [];
    ws.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    ws.dispatchEvent(message('{"real":1}'));
    expect(seen).toEqual(['{"mocked":1}']);
    expect(firedUids()).toEqual(['wsr00001']);
  });

  it('drop with a contains filter swallows matching frames only', () => {
    installFunc(
      buildWsInjection(
        wsRule({
          operation: 'drop',
          direction: 'receive',
          messageFilter: { matchType: 'contains', value: 'heartbeat' },
        }),
      ),
    );
    const ws = new win.WebSocket(WS_URL);
    const seen: unknown[] = [];
    ws.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    ws.dispatchEvent(message('{"type":"heartbeat"}'));
    ws.dispatchEvent(message('{"type":"tick"}'));
    expect(seen).toEqual(['{"type":"tick"}']);
    expect(firedUids()).toEqual(['wsr00001']);
  });

  it('a filtered drop passes binary frames through untouched', () => {
    installFunc(
      buildWsInjection(
        wsRule({ operation: 'drop', direction: 'receive', messageFilter: { matchType: 'contains', value: 'x' } }),
      ),
    );
    const ws = new win.WebSocket(WS_URL);
    const seen: unknown[] = [];
    ws.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    const blob = new ArrayBuffer(4);
    ws.dispatchEvent(message(blob));
    expect(seen).toEqual([blob]);
    expect(firedUids()).toEqual([]);
  });

  it('non-matching socket URLs are untouched', () => {
    installFunc(buildWsInjection(wsRule({ operation: 'modify', direction: 'receive', payload: 'X' })));
    const ws = new win.WebSocket('wss://other.openheaders.dev/feed');
    const seen: unknown[] = [];
    ws.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    ws.dispatchEvent(message('original'));
    expect(seen).toEqual(['original']);
    expect(firedUids()).toEqual([]);
  });
});

describe('ws wrapper — send side', () => {
  it('modify rewrites matching outgoing frames at the wire', () => {
    installFunc(buildWsInjection(wsRule({ operation: 'modify', direction: 'send', payload: '{"patched":1}' })));
    const ws = new win.WebSocket(WS_URL);
    ws.send('{"orig":1}');
    expect(ws.sent).toEqual(['{"patched":1}']);
    expect(firedUids()).toEqual(['wsr00001']);
  });

  it('drop suppresses matching outgoing frames; others pass', () => {
    installFunc(
      buildWsInjection(
        wsRule({ operation: 'drop', direction: 'send', messageFilter: { matchType: 'regex', value: '^secret' } }),
      ),
    );
    const ws = new win.WebSocket(WS_URL);
    ws.send('secret-token');
    ws.send('public');
    expect(ws.sent).toEqual(['public']);
  });
});

describe('ws wrapper — inject', () => {
  it('delivers a synthetic incoming frame on connection open', async () => {
    installFunc(buildWsInjection(wsRule({ operation: 'inject', direction: 'receive', payload: '{"hello":1}' })));
    const ws = new win.WebSocket(WS_URL);
    const seen: unknown[] = [];
    ws.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    ws.dispatchEvent(new Event('open'));
    await nextTick();
    expect(seen).toEqual(['{"hello":1}']);
  });

  it('auto-responds on a matching incoming message (send + message trigger)', async () => {
    installFunc(
      buildWsInjection(
        wsRule({
          operation: 'inject',
          direction: 'send',
          payload: 'pong',
          injectTrigger: 'message',
          messageFilter: { matchType: 'contains', value: 'ping' },
        }),
      ),
    );
    const ws = new win.WebSocket(WS_URL);
    ws.dispatchEvent(message('ping'));
    ws.dispatchEvent(message('other'));
    await nextTick();
    expect(ws.sent).toEqual(['pong']);
  });

  it('synthetic frames land after their trigger and are not reprocessed (no loop)', async () => {
    installFunc(
      buildWsInjection(
        wsRule({
          operation: 'inject',
          direction: 'receive',
          payload: 'echo',
          injectTrigger: 'message',
        }),
      ),
    );
    const ws = new win.WebSocket(WS_URL);
    const seen: unknown[] = [];
    ws.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    ws.dispatchEvent(message('real'));
    await nextTick();
    // one real + one synthetic AFTER it; the synthetic did not retrigger
    expect(seen).toEqual(['real', 'echo']);
  });
});

describe('ws wrapper — constructor surface', () => {
  it('preserves statics and instanceof through wrapping', () => {
    installFunc(buildWsInjection(wsRule({ operation: 'modify', direction: 'receive', payload: 'X' })));
    expect(win.WebSocket).not.toBe(FakeWebSocket);
    expect(win.WebSocket.OPEN).toBe(FakeWebSocket.OPEN);
    expect(win.WebSocket.CLOSED).toBe(FakeWebSocket.CLOSED);
    const ws = new win.WebSocket(WS_URL);
    expect(ws instanceof FakeWebSocket).toBe(true);
  });
});

// ── EventSource ─────────────────────────────────────────────────────

describe('sse wrapper', () => {
  it('modify replaces default message events', () => {
    installFunc(buildSseInjection(sseRule({ operation: 'modify', payload: '{"px":42}' })));
    const es = new win.EventSource(SSE_URL);
    const seen: unknown[] = [];
    es.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    es.dispatchEvent(message('{"px":1}'));
    expect(seen).toEqual(['{"px":42}']);
    expect(firedUids()).toEqual(['sse00001']);
  });

  it('eventName-gated rules leave default message events alone', () => {
    installFunc(buildSseInjection(sseRule({ operation: 'drop', eventName: 'price-update' })));
    const es = new win.EventSource(SSE_URL);
    const seenNamed: unknown[] = [];
    const seenDefault: unknown[] = [];
    es.addEventListener('price-update', (ev) => seenNamed.push((ev as MessageEvent).data));
    es.addEventListener('message', (ev) => seenDefault.push((ev as MessageEvent).data));

    es.dispatchEvent(new MessageEvent('price-update', { data: 'dropme' }));
    es.dispatchEvent(message('keep'));
    expect(seenNamed).toEqual([]);
    expect(seenDefault).toEqual(['keep']);
  });

  it('regex filters select which events are modified', () => {
    installFunc(
      buildSseInjection(
        sseRule({
          operation: 'modify',
          payload: 'REPLACED',
          messageFilter: { matchType: 'regex', value: '"sym":"OH"' },
        }),
      ),
    );
    const es = new win.EventSource(SSE_URL);
    const seen: unknown[] = [];
    es.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    es.dispatchEvent(message('{"sym":"OH","px":1}'));
    es.dispatchEvent(message('{"sym":"AA","px":2}'));
    expect(seen).toEqual(['REPLACED', '{"sym":"AA","px":2}']);
  });

  it('injects a named event on stream open', async () => {
    installFunc(
      buildSseInjection(sseRule({ operation: 'inject', eventName: 'price-update', payload: '{"px":9}' })),
    );
    const es = new win.EventSource(SSE_URL);
    const seen: unknown[] = [];
    es.addEventListener('price-update', (ev) => seen.push((ev as MessageEvent).data));

    es.dispatchEvent(new Event('open'));
    await nextTick();
    expect(seen).toEqual(['{"px":9}']);
  });

  it('non-matching stream URLs are untouched', () => {
    installFunc(buildSseInjection(sseRule({ operation: 'drop' })));
    const es = new win.EventSource('https://elsewhere.openheaders.dev/events');
    const seen: unknown[] = [];
    es.addEventListener('message', (ev) => seen.push((ev as MessageEvent).data));

    es.dispatchEvent(message('keep'));
    expect(seen).toEqual(['keep']);
  });

  it('preserves statics through wrapping', () => {
    installFunc(buildSseInjection(sseRule({ operation: 'modify', payload: 'X' })));
    expect(win.EventSource).not.toBe(FakeEventSource);
    expect(win.EventSource.OPEN).toBe(FakeEventSource.OPEN);
    const es = new win.EventSource(SSE_URL);
    expect(es instanceof FakeEventSource).toBe(true);
  });
});
