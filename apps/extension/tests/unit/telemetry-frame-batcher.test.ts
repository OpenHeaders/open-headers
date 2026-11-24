/**
 * Frame batcher — a stream session's run, cut into frames by size.
 * Asserts:
 *   - a tick's messages leave as one frame in the batch envelope
 *   - a run over the budget leaves as several frames, in order, none
 *     over the budget
 *   - the budget follows a smaller host limit, at three bytes a unit
 *   - a message larger than the budget travels alone
 *   - a message `fit` reduces crosses reduced; one it cannot fit is
 *     left out and reported, and the rest of the run still crosses
 *   - a refused send drops the rest of the run
 *   - each message is serialised once
 */

import { fitsFrame } from '@openheaders/core/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFrameBatcher, FRAME_BUDGET_CHARS } from '@/background/telemetry-stream-host/frame-batcher';

interface Note {
  readonly id: number;
  readonly text: string;
}

interface ParsedFrame {
  type: string;
  tabId: number;
  consumerId: string;
  messages: Note[];
}

const ENVELOPE = { type: 'oh.telemetry.lifecycle.batch', tabId: 7, consumerId: 'c1' };
const TICK_MS = 25;

function note(id: number, chars: number): Note {
  return { id, text: 'x'.repeat(chars) };
}

function rig(options: { maxFrameBytes?: number; accept?: (frame: string) => boolean } = {}) {
  const frames: string[] = [];
  const leftOut: Note[] = [];
  const maxFrameBytes = options.maxFrameBytes ?? 8 * 1024 * 1024;
  const batcher = createFrameBatcher<Note>({
    envelope: ENVELOPE,
    flushIntervalMs: TICK_MS,
    maxFrameBytes: () => maxFrameBytes,
    send: (frame) => {
      if (options.accept && !options.accept(frame)) return false;
      frames.push(frame);
      return true;
    },
    fit: (message, serialized, maxBytes) => {
      if (fitsFrame(serialized, maxBytes)) return serialized;
      // The reducible kind in this rig: an even id sheds its text.
      return message.id % 2 === 0 ? JSON.stringify({ id: message.id, text: '' }) : null;
    },
    onLeftOut: (message) => leftOut.push(message),
  });
  return { batcher, frames, leftOut, parsed: () => frames.map((frame) => JSON.parse(frame) as ParsedFrame) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createFrameBatcher', () => {
  it('sends nothing before the tick, then one frame in the batch envelope', () => {
    const r = rig();
    r.batcher.enqueue(note(1, 10));
    r.batcher.enqueue(note(2, 10));
    expect(r.frames).toEqual([]);

    vi.advanceTimersByTime(TICK_MS);
    expect(r.frames).toEqual([
      `{"type":"oh.telemetry.lifecycle.batch","tabId":7,"consumerId":"c1","messages":[${JSON.stringify(note(1, 10))},${JSON.stringify(note(2, 10))}]}`,
    ]);
  });

  it('cuts a run over the budget into frames, in order, none over the budget', () => {
    const r = rig();
    const each = 100_000;
    const count = 40;
    for (let i = 0; i < count; i++) r.batcher.enqueue(note(i, each));
    vi.advanceTimersByTime(TICK_MS);

    expect(r.frames.length).toBeGreaterThan(1);
    for (const frame of r.frames) expect(frame.length).toBeLessThanOrEqual(FRAME_BUDGET_CHARS + 200);
    expect(
      r
        .parsed()
        .flatMap((frame) => frame.messages)
        .map((m) => m.id),
    ).toEqual(Array.from({ length: count }, (_, i) => i));
    for (const frame of r.parsed()) expect(frame).toMatchObject(ENVELOPE);
  });

  it('keeps a frame of several messages to a third of a smaller host limit', () => {
    const maxFrameBytes = 30_000;
    const r = rig({ maxFrameBytes });
    for (let i = 0; i < 30; i++) r.batcher.enqueue(note(i, 1_000));
    vi.advanceTimersByTime(TICK_MS);

    expect(r.frames.length).toBeGreaterThan(3);
    // Every character could be three bytes and the frame would still fit.
    for (const frame of r.frames) expect(frame.length * 3).toBeLessThanOrEqual(maxFrameBytes);
    expect(r.parsed().flatMap((frame) => frame.messages)).toHaveLength(30);
  });

  it('sends a message larger than the budget alone, between its neighbours', () => {
    const r = rig();
    r.batcher.enqueue(note(1, 10));
    r.batcher.enqueue(note(3, FRAME_BUDGET_CHARS + 10));
    r.batcher.enqueue(note(5, 10));
    vi.advanceTimersByTime(TICK_MS);

    expect(r.parsed().map((frame) => frame.messages.map((m) => m.id))).toEqual([[1], [3], [5]]);
    expect(r.leftOut).toEqual([]);
  });

  it('a message over the limit crosses reduced when it can be, and is left out when it cannot', () => {
    const r = rig({ maxFrameBytes: 3_000 });
    r.batcher.enqueue(note(1, 10));
    r.batcher.enqueue(note(2, 5_000));
    r.batcher.enqueue(note(3, 5_000));
    r.batcher.enqueue(note(5, 10));
    vi.advanceTimersByTime(TICK_MS);

    expect(r.parsed().flatMap((frame) => frame.messages)).toEqual([note(1, 10), { id: 2, text: '' }, note(5, 10)]);
    expect(r.leftOut.map((m) => m.id)).toEqual([3]);
  });

  it('a message left out alone schedules no empty frame', () => {
    const r = rig({ maxFrameBytes: 3_000 });
    r.batcher.enqueue(note(3, 5_000));
    vi.advanceTimersByTime(TICK_MS);
    expect(r.frames).toEqual([]);
  });

  it('drops the rest of a run once the wire refuses a frame', () => {
    let taken = 0;
    const r = rig({ accept: () => ++taken <= 1 });
    for (let i = 0; i < 40; i++) r.batcher.enqueue(note(i, 100_000));
    vi.advanceTimersByTime(TICK_MS);
    expect(r.frames).toHaveLength(1);

    // The next run starts clean.
    taken = -100;
    r.batcher.enqueue(note(99, 10));
    vi.advanceTimersByTime(TICK_MS);
    expect(r.parsed()[1].messages).toEqual([note(99, 10)]);
  });

  it('clear drops what is queued and stops the tick', () => {
    const r = rig();
    r.batcher.enqueue(note(1, 10));
    r.batcher.clear();
    vi.advanceTimersByTime(TICK_MS * 4);
    expect(r.frames).toEqual([]);

    r.batcher.enqueue(note(2, 10));
    vi.advanceTimersByTime(TICK_MS);
    expect(r.parsed()[0].messages).toEqual([note(2, 10)]);
  });

  it('serialises each message once', () => {
    const r = rig();
    let reads = 0;
    const counted = {
      get id() {
        reads++;
        return 1;
      },
      text: 'x',
    };
    r.batcher.enqueue(counted);
    vi.advanceTimersByTime(TICK_MS);
    expect(reads).toBe(1);
    expect(r.parsed()[0].messages).toEqual([{ id: 1, text: 'x' }]);
  });
});
