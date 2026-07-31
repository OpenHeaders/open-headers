/**
 * WS session plane — the flush-batched `wsStreamEvent` emitter (open
 * immediate, messages pooled by the time window with an eager bound,
 * end flushes then settles, per-send monotonic seq) and the
 * active-session registry behind the `sendWsMessage` /
 * `closeWsSession` riders.
 */

import type { WsStreamEventWire } from '@openheaders/core/bridge';
import {
  closeActiveWsSession,
  createWsStreamEmitter,
  registerActiveWsSession,
  sendActiveWsSessionMessage,
} from '@openheaders/oracle/live/ws-exec/session-plane';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const msg = (direction: 'up' | 'down', dataBase64 = 'AA==') => ({
  direction,
  dataBase64,
  binary: false,
  atMs: 1_700_000_000_000,
});

describe('createWsStreamEmitter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits open immediately and pools messages until the flush window', () => {
    const events: WsStreamEventWire[] = [];
    const emitter = createWsStreamEmitter('send-1', (e) => events.push(e));
    emitter.open('chat.v2', 'permessage-deflate');
    emitter.message(msg('down'));
    emitter.message(msg('up'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'open', seq: 0, protocol: 'chat.v2', extensions: 'permessage-deflate' });
    vi.advanceTimersByTime(100);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: 'messages', seq: 1 });
    if (events[1].kind !== 'messages') throw new Error('expected messages frame');
    expect(events[1].items.map((i) => i.direction)).toEqual(['down', 'up']);
  });

  it('carries the proxy route on the open frame and omits it for a direct session', () => {
    const events: WsStreamEventWire[] = [];
    const emitter = createWsStreamEmitter('send-1', (e) => events.push(e));
    emitter.open('chat.v2', '', { plane: 'system', proxyUrl: 'http://proxy.openheaders.io:3128', source: 'system' });
    expect(events[0]).toMatchObject({
      kind: 'open',
      proxyRoute: { plane: 'system', proxyUrl: 'http://proxy.openheaders.io:3128', source: 'system' },
    });

    const directEvents: WsStreamEventWire[] = [];
    const directEmitter = createWsStreamEmitter('send-2', (e) => directEvents.push(e));
    directEmitter.open('', '');
    expect(directEvents[0]).not.toHaveProperty('proxyRoute');
  });

  it('flushes eagerly on the message bound instead of pooling a burst', () => {
    const events: WsStreamEventWire[] = [];
    const emitter = createWsStreamEmitter('send-1', (e) => events.push(e));
    for (let i = 0; i < 256; i++) emitter.message(msg('down'));
    expect(events).toHaveLength(1);
    if (events[0].kind !== 'messages') throw new Error('expected messages frame');
    expect(events[0].items).toHaveLength(256);
  });

  it('end flushes pending messages first, then settles with the end frame', () => {
    const events: WsStreamEventWire[] = [];
    const emitter = createWsStreamEmitter('send-1', (e) => events.push(e));
    emitter.message(msg('up'));
    emitter.end();
    expect(events.map((e) => e.kind)).toEqual(['messages', 'end']);
    expect(events.map((e) => e.seq)).toEqual([0, 1]);
    emitter.message(msg('down'));
    emitter.open('', '');
    emitter.end();
    expect(events).toHaveLength(2);
  });
});

describe('active WS session registry', () => {
  it('routes sends and close to the registered handle until unregistered', () => {
    const sent: string[] = [];
    let closedCount = 0;
    const unregister = registerActiveWsSession('send-2', {
      send: (text) => {
        sent.push(text);
        return { success: true };
      },
      close: () => {
        closedCount++;
      },
    });
    expect(sendActiveWsSessionMessage('send-2', 'hello')).toEqual({ success: true });
    expect(sent).toEqual(['hello']);
    expect(closeActiveWsSession('send-2')).toBe(true);
    expect(closedCount).toBe(1);
    unregister();
    expect(sendActiveWsSessionMessage('send-2', 'late').success).toBe(false);
    expect(closeActiveWsSession('send-2')).toBe(false);
  });

  it('answers an unknown id without touching any handle', () => {
    const result = sendActiveWsSessionMessage('missing', 'x');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No open WebSocket session');
  });
});
