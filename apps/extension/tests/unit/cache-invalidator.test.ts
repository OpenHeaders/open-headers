/**
 * Cache-invalidator — debouncing, scope heuristic, graceful failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Hoist the browsingData mock so the factory can read it.
const { removeSpy, handlerBehaviorChangedSpy } = vi.hoisted(() => ({
  removeSpy: vi.fn(() => Promise.resolve()),
  handlerBehaviorChangedSpy: vi.fn(),
}));

beforeEach(() => {
  removeSpy.mockReset();
  removeSpy.mockImplementation(() => Promise.resolve());
  handlerBehaviorChangedSpy.mockReset();
  (globalThis as unknown as Record<string, unknown>).chrome = {
    browsingData: { remove: removeSpy },
    webRequest: { handlerBehaviorChanged: handlerBehaviorChangedSpy },
  };
  vi.useFakeTimers();
});

afterEach(() => {
  __resetPendingForTests();
  vi.useRealTimers();
});

import { __resetPendingForTests, enqueueInvalidation, flushPending } from '@/background/modules/cache-invalidator';

describe('enqueueInvalidation', () => {
  it('is a no-op when called with empty origins and broad=false', async () => {
    enqueueInvalidation([], false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('fires scoped eviction after the debounce window', async () => {
    enqueueInvalidation(['https://api.openheaders.io']);
    expect(removeSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(750);
    expect(removeSpy).toHaveBeenCalledWith({ origins: ['https://api.openheaders.io'] }, { cache: true });
  });

  it('coalesces rapid calls into a single eviction with unioned origins', async () => {
    enqueueInvalidation(['https://a.openheaders.io']);
    await vi.advanceTimersByTimeAsync(200);
    enqueueInvalidation(['https://b.openheaders.io']);
    await vi.advanceTimersByTimeAsync(200);
    enqueueInvalidation(['https://c.openheaders.io']);
    await vi.advanceTimersByTimeAsync(750);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    const calls = removeSpy.mock.calls as unknown as unknown[][];
    const arg = calls[0]![0] as { origins: string[] };
    expect(new Set(arg.origins)).toEqual(
      new Set(['https://a.openheaders.io', 'https://b.openheaders.io', 'https://c.openheaders.io']),
    );
  });

  it('switches to global wipe when origin count exceeds the threshold', async () => {
    const origins = Array.from({ length: 15 }, (_, i) => `https://host-${i}.openheaders.io`);
    enqueueInvalidation(origins);
    await vi.advanceTimersByTimeAsync(750);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith({}, { cache: true });
  });

  it('switches to global wipe when any call flags broad', async () => {
    enqueueInvalidation(['https://api.openheaders.io']);
    enqueueInvalidation([], true);
    await vi.advanceTimersByTimeAsync(750);
    expect(removeSpy).toHaveBeenCalledWith({}, { cache: true });
  });

  it('calls handlerBehaviorChanged after every eviction', async () => {
    enqueueInvalidation(['https://api.openheaders.io']);
    await vi.advanceTimersByTimeAsync(750);
    expect(handlerBehaviorChangedSpy).toHaveBeenCalledTimes(1);
  });

  it('gracefully no-ops when browsingData API is unavailable', async () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      webRequest: { handlerBehaviorChanged: handlerBehaviorChangedSpy },
    };
    enqueueInvalidation(['https://api.openheaders.io']);
    await vi.advanceTimersByTimeAsync(750);
    expect(removeSpy).not.toHaveBeenCalled();
    // handlerBehaviorChanged still fires — webRequest listener
    // consistency is a separate concern from HTTP cache eviction.
    expect(handlerBehaviorChangedSpy).toHaveBeenCalledTimes(1);
  });

  it('swallows errors from browsingData.remove and still calls handlerBehaviorChanged', async () => {
    removeSpy.mockImplementationOnce(() => Promise.reject(new Error('permission denied')));
    enqueueInvalidation(['https://api.openheaders.io']);
    await vi.advanceTimersByTimeAsync(750);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(handlerBehaviorChangedSpy).toHaveBeenCalledTimes(1);
  });
});

describe('flushPending', () => {
  it('fires the pending batch immediately instead of waiting', async () => {
    enqueueInvalidation(['https://api.openheaders.io']);
    await flushPending();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('no-op when nothing is pending', async () => {
    await flushPending();
    expect(removeSpy).not.toHaveBeenCalled();
  });
});

describe('serialized flushes', () => {
  it('chains sequential flushes so browsingData.remove never runs in parallel', async () => {
    // Use real timers so we can interleave enqueues and flushes naturally.
    vi.useRealTimers();

    let firstFlushResolve!: () => void;
    const firstFlushInflight = new Promise<void>((resolve) => {
      firstFlushResolve = resolve;
    });
    // Capture the order of calls and simulate a slow first flush so we
    // can verify the second one truly waits.
    const callOrder: string[] = [];
    removeSpy.mockImplementationOnce(() => {
      callOrder.push('first-start');
      return firstFlushInflight.then(() => {
        callOrder.push('first-end');
      });
    });
    removeSpy.mockImplementationOnce(() => {
      callOrder.push('second-start');
      return Promise.resolve();
    });

    enqueueInvalidation(['https://a.openheaders.io']);
    await new Promise((r) => setTimeout(r, 760));
    // First flush is now in flight.
    expect(callOrder).toEqual(['first-start']);

    // While it's in flight, enqueue a second batch.
    enqueueInvalidation(['https://b.openheaders.io']);
    await new Promise((r) => setTimeout(r, 760));
    // Second flush must NOT have started yet — first still in flight.
    expect(callOrder).toEqual(['first-start']);

    // Release the first flush; the second now runs, after it.
    firstFlushResolve();
    await flushPending();
    expect(callOrder).toEqual(['first-start', 'first-end', 'second-start']);
  });
});
