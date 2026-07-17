// @vitest-environment jsdom
/**
 * useLiveGrpcStream — the gRPC message timeline's live feed. Pins the
 * accumulator laws: the head event carries the executor's
 * `afterMessages` position into `headAtMessage` (the timeline's
 * "Response received" interleave — batching means the head can outrun
 * pooled messages on the wire, so the recorded position, not arrival
 * order, is the truth), message batches append with positional
 * timestamps, stale seq drops, and `takeSession()` snapshots the
 * session timing. rAF is stubbed as a manual queue flushed inside
 * act() — the HTTP twin's rig.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StreamHandler = (event: unknown) => void;

const { mockSubscribe } = vi.hoisted(() => ({ mockSubscribe: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: {
      call: vi.fn(),
      subscribe: mockSubscribe,
      broadcast: vi.fn(),
      presence: vi.fn(),
    },
  };
});

import { useLiveGrpcStream } from '@openheaders/ui/workbench/components/grpc-request-editor/useLiveGrpcStream';

let streamHandler: StreamHandler | null = null;
let rafQueue: FrameRequestCallback[] = [];

const flushRaf = () => {
  const queue = rafQueue;
  rafQueue = [];
  for (const cb of queue) cb(0);
};

/** Deliver a frame and flush the rAF commit, like a real frame tick. */
const emit = (event: unknown) => {
  streamHandler?.(event);
  flushRaf();
};

beforeEach(() => {
  streamHandler = null;
  rafQueue = [];
  mockSubscribe.mockReset();
  mockSubscribe.mockImplementation((type: string, handler: StreamHandler) => {
    if (type === 'grpcStreamEvent') streamHandler = handler;
    return vi.fn();
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const msg = (direction: 'up' | 'down', atMs: number) => ({ direction, dataBase64: 'AA==', compressed: false, atMs });

describe('useLiveGrpcStream', () => {
  it('carries the head event afterMessages into headAtMessage — the live interleave position', () => {
    const { result } = renderHook(() => useLiveGrpcStream());
    act(() => result.current.beginStream('send-1'));
    // The ↑ message was written before the head but its pooled batch
    // arrives AFTER the head event — the recorded position must win
    // over arrival order.
    act(() => emit({ sendId: 'send-1', seq: 0, kind: 'head', httpStatus: 200, headers: [], afterMessages: 1 }));
    act(() => emit({ sendId: 'send-1', seq: 1, kind: 'messages', items: [msg('up', 100), msg('down', 200)] }));
    expect(result.current.live?.headAtMessage).toBe(1);
    expect(result.current.live?.head?.httpStatus).toBe(200);
    expect(result.current.live?.count).toBe(2);
    expect(result.current.live?.timestamps).toEqual([100, 200]);
  });

  it('drops stale seq frames and ignores foreign sendIds', () => {
    const { result } = renderHook(() => useLiveGrpcStream());
    act(() => result.current.beginStream('send-1'));
    act(() => emit({ sendId: 'send-1', seq: 1, kind: 'messages', items: [msg('down', 100)] }));
    act(() => emit({ sendId: 'send-1', seq: 0, kind: 'messages', items: [msg('down', 50)] }));
    act(() => emit({ sendId: 'other', seq: 2, kind: 'messages', items: [msg('down', 300)] }));
    expect(result.current.live?.count).toBe(1);
  });

  it('takeSession snapshots timing including the head arrival, then endStream clears the feed', () => {
    const { result } = renderHook(() => useLiveGrpcStream());
    act(() => result.current.beginStream('send-1'));
    act(() => emit({ sendId: 'send-1', seq: 0, kind: 'head', httpStatus: 200, headers: [], afterMessages: 0 }));
    act(() => emit({ sendId: 'send-1', seq: 1, kind: 'messages', items: [msg('down', 400)] }));
    const session = result.current.takeSession();
    expect(session?.connectedAt).toBeDefined();
    expect(session?.messageTimestamps).toEqual([400]);
    act(() => result.current.endStream());
    expect(result.current.live).toBeNull();
  });
});
