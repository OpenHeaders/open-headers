/**
 * gRPC stream plane — the flush-batched `grpcStreamEvent` emitter
 * (head immediate, messages pooled by the time window with an eager
 * bound, end flushes then settles, per-send monotonic seq) and the
 * active-stream registry behind the upstream riders.
 */

import type { GrpcStreamEventWire } from '@openheaders/core/bridge';
import {
  createGrpcStreamEmitter,
  endActiveGrpcClientStream,
  registerActiveGrpcStream,
  sendActiveGrpcStreamMessage,
} from '@openheaders/oracle/live/grpc-exec/stream-plane';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const msg = (direction: 'up' | 'down', dataBase64 = 'AA==') => ({
  direction,
  dataBase64,
  compressed: false,
  atMs: 1_700_000_000_000,
});

describe('createGrpcStreamEmitter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits the head immediately and pools messages until the flush window', () => {
    const events: GrpcStreamEventWire[] = [];
    const emitter = createGrpcStreamEmitter('send-1', (e) => events.push(e));
    emitter.head(200, [{ key: 'content-type', value: 'application/grpc+proto' }], 1);
    emitter.message(msg('down'));
    emitter.message(msg('down'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'head', httpStatus: 200, seq: 0, afterMessages: 1 });
    vi.advanceTimersByTime(100);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: 'messages', seq: 1 });
    if (events[1].kind !== 'messages') throw new Error('expected messages frame');
    expect(events[1].items).toHaveLength(2);
  });

  it('carries the proxy route on the head frame and omits it for a direct call', () => {
    const events: GrpcStreamEventWire[] = [];
    const emitter = createGrpcStreamEmitter('send-1', (e) => events.push(e));
    emitter.head(200, [], 0, { plane: 'system', proxyUrl: 'http://proxy.openheaders.io:3128', source: 'system' });
    expect(events[0]).toMatchObject({
      kind: 'head',
      proxyRoute: { plane: 'system', proxyUrl: 'http://proxy.openheaders.io:3128', source: 'system' },
    });

    const directEvents: GrpcStreamEventWire[] = [];
    const directEmitter = createGrpcStreamEmitter('send-2', (e) => directEvents.push(e));
    directEmitter.head(200, [], 0);
    expect(directEvents[0]).not.toHaveProperty('proxyRoute');
  });

  it('flushes eagerly on the message bound instead of pooling a burst', () => {
    const events: GrpcStreamEventWire[] = [];
    const emitter = createGrpcStreamEmitter('send-1', (e) => events.push(e));
    for (let i = 0; i < 256; i++) emitter.message(msg('down'));
    expect(events).toHaveLength(1);
    if (events[0].kind !== 'messages') throw new Error('expected messages frame');
    expect(events[0].items).toHaveLength(256);
  });

  it('end flushes pending messages first, then settles with the end frame', () => {
    const events: GrpcStreamEventWire[] = [];
    const emitter = createGrpcStreamEmitter('send-1', (e) => events.push(e));
    emitter.message(msg('up'));
    emitter.end();
    expect(events.map((e) => e.kind)).toEqual(['messages', 'end']);
    expect(events.map((e) => e.seq)).toEqual([0, 1]);
    emitter.message(msg('down'));
    emitter.head(200, [], 0);
    emitter.end();
    expect(events).toHaveLength(2);
  });

  it('emits the dispatched metadata immediately as the sent frame', () => {
    const events: GrpcStreamEventWire[] = [];
    const emitter = createGrpcStreamEmitter('send-1', (e) => events.push(e));
    emitter.sent([{ key: 'wat', value: 'wat' }]);
    emitter.head(200, [], 0);
    expect(events.map((e) => e.kind)).toEqual(['sent', 'head']);
    if (events[0].kind !== 'sent') throw new Error('expected sent frame');
    expect(events[0].metadata).toEqual([{ key: 'wat', value: 'wat' }]);
  });

  it('stamps the lifecycle frames with the host wall-clock — the message frames atMs law', () => {
    vi.setSystemTime(1_700_000_111_222);
    const events: GrpcStreamEventWire[] = [];
    const emitter = createGrpcStreamEmitter('send-1', (e) => events.push(e));
    emitter.head(200, [], 0);
    vi.setSystemTime(1_700_000_333_444);
    emitter.end();
    expect(events.map((e) => e.kind)).toEqual(['head', 'end']);
    if (events[0].kind !== 'head' || events[1].kind !== 'end') throw new Error('expected head then end');
    expect(events[0].atMs).toBe(1_700_000_111_222);
    expect(events[1].atMs).toBe(1_700_000_333_444);
  });
});

describe('active gRPC stream registry', () => {
  it('routes sends and half-close to the registered handle until unregistered', () => {
    const sent: string[] = [];
    let endedCount = 0;
    const unregister = registerActiveGrpcStream('send-2', {
      send: (text) => {
        sent.push(text);
        return { success: true };
      },
      end: () => {
        endedCount++;
      },
    });
    expect(sendActiveGrpcStreamMessage('send-2', '{"a":1}')).toEqual({ success: true });
    expect(sent).toEqual(['{"a":1}']);
    expect(endActiveGrpcClientStream('send-2')).toBe(true);
    expect(endedCount).toBe(1);
    unregister();
    expect(sendActiveGrpcStreamMessage('send-2', '{}').success).toBe(false);
    expect(endActiveGrpcClientStream('send-2')).toBe(false);
  });

  it('answers an unknown id without touching any handle', () => {
    const result = sendActiveGrpcStreamMessage('missing', '{}');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No open gRPC stream');
  });
});
