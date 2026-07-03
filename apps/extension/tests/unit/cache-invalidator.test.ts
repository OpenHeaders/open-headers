/**
 * Cache-invalidator — fires immediately on each enqueue, serializes
 * via flushChain. No local debouncing (rule-engine handles that
 * upstream at 150ms).
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
});

afterEach(async () => {
  await flushPending();
  __resetPendingForTests();
});

import { __resetPendingForTests, enqueueInvalidation, flushPending } from '@/background/modules/net/cache-invalidator';

describe('enqueueInvalidation', () => {
  it('is a no-op when called with empty origins and broad=false', async () => {
    enqueueInvalidation([], false);
    await flushPending();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('fires scoped eviction immediately (no debounce)', async () => {
    enqueueInvalidation(['https://api.openheaders.io']);
    await flushPending();
    expect(removeSpy).toHaveBeenCalledWith({ origins: ['https://api.openheaders.io'] }, { cache: true });
  });

  it('each enqueue fires its own eviction in order', async () => {
    enqueueInvalidation(['https://a.openheaders.io']);
    enqueueInvalidation(['https://b.openheaders.io']);
    enqueueInvalidation(['https://c.openheaders.io']);
    await flushPending();
    expect(removeSpy).toHaveBeenCalledTimes(3);
    const calls = removeSpy.mock.calls as unknown as unknown[][];
    const origins = calls.map((c) => (c[0] as { origins: string[] }).origins[0]);
    expect(origins).toEqual(['https://a.openheaders.io', 'https://b.openheaders.io', 'https://c.openheaders.io']);
  });

  it('switches to global wipe when origin count exceeds the threshold', async () => {
    const origins = Array.from({ length: 15 }, (_, i) => `https://host-${i}.openheaders.io`);
    enqueueInvalidation(origins);
    await flushPending();
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith({}, { cache: true });
  });

  it('switches to global wipe when the caller flags broad=true', async () => {
    enqueueInvalidation([], true);
    await flushPending();
    expect(removeSpy).toHaveBeenCalledWith({}, { cache: true });
  });

  it('calls handlerBehaviorChanged after every eviction', async () => {
    enqueueInvalidation(['https://api.openheaders.io']);
    await flushPending();
    expect(handlerBehaviorChangedSpy).toHaveBeenCalledTimes(1);
  });

  it('gracefully no-ops when browsingData API is unavailable', async () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      webRequest: { handlerBehaviorChanged: handlerBehaviorChangedSpy },
    };
    enqueueInvalidation(['https://api.openheaders.io']);
    await flushPending();
    expect(removeSpy).not.toHaveBeenCalled();
    // handlerBehaviorChanged still fires — webRequest listener
    // consistency is a separate concern from HTTP cache eviction.
    expect(handlerBehaviorChangedSpy).toHaveBeenCalledTimes(1);
  });

  it('swallows errors from browsingData.remove and still calls handlerBehaviorChanged', async () => {
    removeSpy.mockImplementationOnce(() => Promise.reject(new Error('permission denied')));
    enqueueInvalidation(['https://api.openheaders.io']);
    await flushPending();
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(handlerBehaviorChangedSpy).toHaveBeenCalledTimes(1);
  });
});

describe('serialized flushes', () => {
  it('chains sequential flushes so browsingData.remove never runs in parallel', async () => {
    let firstFlushResolve!: () => void;
    const firstFlushInflight = new Promise<void>((resolve) => {
      firstFlushResolve = resolve;
    });
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
    // Give the first flush a tick to start.
    await Promise.resolve();
    await Promise.resolve();
    expect(callOrder).toEqual(['first-start']);

    // While first is in flight, enqueue a second batch. The new flush
    // is chained behind the in-flight one, not parallel to it.
    enqueueInvalidation(['https://b.openheaders.io']);
    await Promise.resolve();
    await Promise.resolve();
    expect(callOrder).toEqual(['first-start']);

    // Release the first; the second runs after it.
    firstFlushResolve();
    await flushPending();
    expect(callOrder).toEqual(['first-start', 'first-end', 'second-start']);
  });
});
