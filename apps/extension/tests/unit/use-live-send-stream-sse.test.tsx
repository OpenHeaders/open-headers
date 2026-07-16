// @vitest-environment jsdom
/**
 * useLiveSendStream — the SSE leg of the live-tail feed: an SSE head
 * initializes the event feed, chunk frames run the incremental block
 * parse (carry across arbitrary flush cuts, one timestamp per parsed
 * event), non-SSE sends stay on the text tail only, and
 * `takeSseSession()` hands the editor the session timing — including a
 * slot for a trailing block still in the carry, so the positional join
 * onto the snapshot parse stays aligned. rAF is stubbed as a manual
 * queue flushed inside act() — a synchronous stub would run commit
 * before the handle assignment lands and wedge the schedule gate.
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

import { useLiveSendStream } from '@openheaders/ui/workbench/components/request-editor/useLiveSendStream';

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
    if (type === 'requestStreamEvent') streamHandler = handler;
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

const toBase64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

function head(seq: number, contentType: string) {
  return {
    sendId: 'send-1',
    seq,
    kind: 'head',
    head: {
      status: 200,
      statusText: 'OK',
      url: 'https://api.openheaders.io/stream',
      headers: [{ key: 'Content-Type', value: contentType }],
    },
  };
}

function chunk(seq: number, text: string, totalBytes: number) {
  return { sendId: 'send-1', seq, kind: 'chunk', chunkBase64: toBase64(text), totalBytes };
}

describe('useLiveSendStream — SSE event feed', () => {
  it('initializes the feed on an SSE head and parses complete blocks across chunk cuts', () => {
    const { result } = renderHook(() => useLiveSendStream());
    act(() => result.current.beginStream('send-1'));
    act(() => emit(head(0, 'text/event-stream; charset=utf-8')));
    expect(result.current.live?.sse).not.toBeNull();
    expect(result.current.live?.sse?.count).toBe(0);

    // The cut splits mid-block: only the complete block parses now.
    act(() => emit(chunk(1, 'event: tick\ndata: {"seq":1}\n\nevent: ti', 40)));
    expect(result.current.live?.sse?.count).toBe(1);
    expect(result.current.live?.sse?.items[0].record).toEqual({ event: 'tick', data: { seq: 1 } });
    expect(result.current.live?.sse?.timestamps).toHaveLength(1);

    // The rest of the block arrives — the carry completes.
    act(() => emit(chunk(2, 'ck\ndata: {"seq":2}\n\n', 60)));
    expect(result.current.live?.sse?.count).toBe(2);
    expect(result.current.live?.sse?.items[1].record).toEqual({ event: 'tick', data: { seq: 2 } });
  });

  it('keeps non-SSE sends on the text tail with no event feed', () => {
    const { result } = renderHook(() => useLiveSendStream());
    act(() => result.current.beginStream('send-1'));
    act(() => emit(head(0, 'application/json')));
    act(() => emit(chunk(1, '{"a":1}', 7)));
    expect(result.current.live?.sse).toBeNull();
    expect(result.current.live?.tailText).toBe('{"a":1}');
    expect(result.current.takeSseSession()).toBeNull();
  });

  it('takeSseSession returns the timing, minting a slot for a trailing carry block', () => {
    const { result } = renderHook(() => useLiveSendStream());
    act(() => result.current.beginStream('send-1'));
    act(() => emit(head(0, 'text/event-stream')));
    act(() => emit(chunk(1, 'data: {"seq":1}\n\ndata: {"seq":2}\n\ndata: {"se', 44)));
    expect(result.current.live?.sse?.count).toBe(2);

    // Two parsed events + one trailing block still in the carry — the
    // materialized parse mints three records, so three slots.
    const session = result.current.takeSseSession();
    expect(session).not.toBeNull();
    expect(session?.eventTimestamps).toHaveLength(3);
    expect(session?.connectedAt).toBeGreaterThan(0);
    // The live feed itself is untouched by the take.
    expect(result.current.live?.sse?.count).toBe(2);
  });

  it('endStream drops the feed and the session', () => {
    const { result } = renderHook(() => useLiveSendStream());
    act(() => result.current.beginStream('send-1'));
    act(() => emit(head(0, 'text/event-stream')));
    act(() => result.current.endStream());
    expect(result.current.live).toBeNull();
    expect(result.current.takeSseSession()).toBeNull();
  });
});
