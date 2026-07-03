/**
 * Notify-scheduler — the store→React coalescing seam. Asserts that the
 * rAF scheduler collapses a burst into one flush per frame, that distinct
 * publishers each flush once, that the hidden-tab timeout fallback fires
 * when no frame arrives, and that the sync / manual variants and the seam
 * accessors behave as documented.
 */

import {
  createManualNotifyScheduler,
  createRafNotifyScheduler,
  createSyncNotifyScheduler,
  getNotifyScheduler,
  type NotifyScheduler,
  setNotifyScheduler,
} from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Controllable rAF: callbacks queue until `flushFrame()` runs them. */
function installFakeRaf(): { flushFrame: () => void; pending: () => number; restore: () => void } {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const realRaf = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number): void => {
    callbacks.delete(id);
  }) as typeof globalThis.cancelAnimationFrame;
  return {
    flushFrame: () => {
      const due = [...callbacks.values()];
      callbacks.clear();
      for (const cb of due) cb(0);
    },
    pending: () => callbacks.size,
    restore: () => {
      globalThis.requestAnimationFrame = realRaf;
      globalThis.cancelAnimationFrame = realCancel;
    },
  };
}

describe('createRafNotifyScheduler', () => {
  let raf: ReturnType<typeof installFakeRaf>;

  beforeEach(() => {
    vi.useFakeTimers();
    raf = installFakeRaf();
  });

  afterEach(() => {
    raf.restore();
    vi.useRealTimers();
  });

  it('coalesces a burst of one publisher into a single flush per frame', () => {
    const scheduler = createRafNotifyScheduler();
    const notify = vi.fn();

    for (let i = 0; i < 50; i++) scheduler.schedule(notify);
    // Nothing runs until the frame.
    expect(notify).not.toHaveBeenCalled();
    expect(raf.pending()).toBe(1);

    raf.flushFrame();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('flushes each distinct publisher exactly once', () => {
    const scheduler = createRafNotifyScheduler();
    const a = vi.fn();
    const b = vi.fn();

    scheduler.schedule(a);
    scheduler.schedule(b);
    scheduler.schedule(a);
    raf.flushFrame();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('re-arms for the next frame after a flush', () => {
    const scheduler = createRafNotifyScheduler();
    const notify = vi.fn();

    scheduler.schedule(notify);
    raf.flushFrame();
    scheduler.schedule(notify);
    raf.flushFrame();

    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('falls back to a timeout when no frame arrives (hidden tab)', () => {
    const scheduler = createRafNotifyScheduler({ hiddenFallbackMs: 250 });
    const notify = vi.fn();

    scheduler.schedule(notify);
    // The frame never comes (tab hidden) — the timeout fires instead.
    vi.advanceTimersByTime(250);

    expect(notify).toHaveBeenCalledTimes(1);
    // The frame request was canceled by the fallback, so a later frame is a noop.
    raf.flushFrame();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('frame and fallback race: whichever fires first wins, the other is a noop', () => {
    const scheduler = createRafNotifyScheduler({ hiddenFallbackMs: 250 });
    const notify = vi.fn();

    scheduler.schedule(notify);
    raf.flushFrame(); // frame wins
    expect(notify).toHaveBeenCalledTimes(1);

    // The fallback timer was canceled when the frame flushed.
    vi.advanceTimersByTime(250);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('flushNow drains the queue synchronously and cancels pending frame/timer', () => {
    const scheduler = createRafNotifyScheduler();
    const notify = vi.fn();

    scheduler.schedule(notify);
    scheduler.flushNow();
    expect(notify).toHaveBeenCalledTimes(1);

    // Neither the frame nor the fallback re-fires it.
    raf.flushFrame();
    vi.advanceTimersByTime(1000);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});

describe('createSyncNotifyScheduler', () => {
  it('runs each flush immediately on schedule (no coalescing)', () => {
    const scheduler = createSyncNotifyScheduler();
    const notify = vi.fn();

    scheduler.schedule(notify);
    scheduler.schedule(notify);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});

describe('createManualNotifyScheduler', () => {
  it('queues until flushNow, coalescing repeats of one callback', () => {
    const scheduler = createManualNotifyScheduler();
    const notify = vi.fn();

    scheduler.schedule(notify);
    scheduler.schedule(notify);
    expect(scheduler.pendingCount()).toBe(1);
    expect(notify).not.toHaveBeenCalled();

    scheduler.flushNow();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(scheduler.pendingCount()).toBe(0);
  });
});

describe('notify-scheduler seam', () => {
  afterEach(() => setNotifyScheduler(null));

  it('returns the installed scheduler and restores the lazy default on null', () => {
    const custom: NotifyScheduler = createSyncNotifyScheduler();
    setNotifyScheduler(custom);
    expect(getNotifyScheduler()).toBe(custom);

    setNotifyScheduler(null);
    const fallback = getNotifyScheduler();
    expect(fallback).not.toBe(custom);
    // Lazily created once, then stable.
    expect(getNotifyScheduler()).toBe(fallback);
  });
});
