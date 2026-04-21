/**
 * Shared per-host rate limiter — the token bucket that gates OAuth
 * token refreshes + Live Workflow chain step fetches so a provider
 * serving 20 workflows against one host doesn't rocket to 429.
 *
 * Contract:
 *   - Keyed by `URL.origin` — different schemes / ports get different
 *     buckets.
 *   - Concurrency ≤ `maxConcurrent` per origin.
 *   - Starts ≤ `maxPerMinute` in any sliding 60-second window per
 *     origin.
 *   - Non-HTTP URLs (data:, about:, malformed) bypass the bucket.
 *   - Exceptions thrown by the wrapped `fn` still release the slot.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
  inspectRateLimiter,
  withRefreshRateLimit,
} from '@/background/modules/refresh-scheduler';

function defer<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((r, e) => {
    resolve = r;
    reject = e;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  __resetRateLimiterForTests();
});

describe('withRefreshRateLimit', () => {
  it('runs fn immediately when no backpressure', async () => {
    const out = await withRefreshRateLimit('https://openheaders.io/a', async () => 'ok');
    expect(out).toBe('ok');
    const snap = inspectRateLimiter('https://openheaders.io');
    expect(snap).toEqual({ inFlight: 0, recentStartsInMinute: 1, queued: 0 });
  });

  it('serializes concurrent calls to the same origin at maxConcurrent=1', async () => {
    __configureRateLimiterForTests({ maxConcurrent: 1, maxPerMinute: 100 });
    const first = defer<string>();
    const second = defer<string>();

    const a = withRefreshRateLimit('https://openheaders.io/a', () => first.promise);
    // Give microtask queue time to let `a` enter the critical section.
    await Promise.resolve();
    const b = withRefreshRateLimit('https://openheaders.io/b', () => second.promise);
    await Promise.resolve();

    // `a` is in-flight; `b` is queued.
    const mid = inspectRateLimiter('https://openheaders.io');
    expect(mid).toEqual(expect.objectContaining({ inFlight: 1, queued: 1 }));

    first.resolve('A');
    expect(await a).toBe('A');

    // After `a` completes, `b` starts.
    await Promise.resolve();
    const after = inspectRateLimiter('https://openheaders.io');
    expect(after?.inFlight).toBe(1);

    second.resolve('B');
    expect(await b).toBe('B');
  });

  it('releases the slot when fn throws', async () => {
    __configureRateLimiterForTests({ maxConcurrent: 1, maxPerMinute: 10 });
    await expect(
      withRefreshRateLimit('https://openheaders.io/x', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const snap = inspectRateLimiter('https://openheaders.io');
    expect(snap?.inFlight).toBe(0);
    expect(snap?.queued).toBe(0);
  });

  it('different origins get independent buckets', async () => {
    __configureRateLimiterForTests({ maxConcurrent: 1, maxPerMinute: 10 });
    const first = defer<void>();
    const second = defer<void>();

    const a = withRefreshRateLimit('https://a.openheaders.io/x', () => first.promise);
    await Promise.resolve();
    const b = withRefreshRateLimit('https://b.openheaders.io/x', () => second.promise);
    await Promise.resolve();

    // Both are in-flight because they hit different origins.
    expect(inspectRateLimiter('https://a.openheaders.io')?.inFlight).toBe(1);
    expect(inspectRateLimiter('https://b.openheaders.io')?.inFlight).toBe(1);

    first.resolve();
    second.resolve();
    await Promise.all([a, b]);
  });

  it('bypasses limiting for non-HTTP URLs', async () => {
    __configureRateLimiterForTests({ maxConcurrent: 0, maxPerMinute: 0 });
    // Even with a fully locked-out config, a data: URL should run.
    const out = await withRefreshRateLimit('data:text/plain,hi', async () => 'direct');
    expect(out).toBe('direct');
  });

  it('honors maxPerMinute even when concurrency is free', async () => {
    vi.useFakeTimers();
    try {
      __configureRateLimiterForTests({ maxConcurrent: 10, maxPerMinute: 2 });
      // Two fast calls consume the minute budget.
      await withRefreshRateLimit('https://openheaders.io/a', async () => 1);
      await withRefreshRateLimit('https://openheaders.io/b', async () => 2);
      const afterBurst = inspectRateLimiter('https://openheaders.io');
      expect(afterBurst?.recentStartsInMinute).toBe(2);

      // The third call must wait for the minute window to age out.
      let resolved = false;
      const third = withRefreshRateLimit('https://openheaders.io/c', async () => {
        resolved = true;
        return 3;
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved).toBe(false);
      expect(inspectRateLimiter('https://openheaders.io')?.queued).toBe(1);

      // Age past the 60-second window. The limiter's internal setTimeout
      // drains the waiter.
      await vi.advanceTimersByTimeAsync(61_000);
      await third;
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
