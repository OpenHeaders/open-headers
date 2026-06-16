/**
 * Network-conditions module — per-tab throttle store backing the panel's
 * throttle dropdown. Covers the in-memory map, the apply-now replay seam, the
 * `chrome.storage.session` persistence round-trip, and SW-wake rehydration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { NetworkThrottleConditions } from '@openheaders/core/types';
import {
  __resetNetworkConditionsForTests,
  forgetNetworkConditionsForTab,
  getActiveNetworkConditionTabIds,
  getNetworkConditionsForTab,
  registerNetworkConditionsReplay,
  rehydrateNetworkConditionsFromSession,
  setNetworkConditionsForTab,
} from '@/background/modules/network-conditions';

const SLOW_3G: NetworkThrottleConditions = {
  offline: false,
  latencyMs: 2000,
  downloadThroughputBps: 50000,
  uploadThroughputBps: 50000,
};

const STORAGE_KEY = 'cdp.networkConditions';

interface FakeSession {
  store: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

function installFakeSession(seed: Record<string, unknown> = {}): FakeSession {
  const store: Record<string, unknown> = { ...seed };
  const fake: FakeSession = {
    store,
    get: vi.fn((key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {})),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    }),
  };
  (globalThis as unknown as Record<string, unknown>).chrome = { storage: { session: fake } };
  return fake;
}

async function flushPersist(): Promise<void> {
  await new Promise((r) => setTimeout(r, 60));
}

beforeEach(() => {
  __resetNetworkConditionsForTests();
});

afterEach(() => {
  __resetNetworkConditionsForTests();
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

describe('set / get / forget', () => {
  it('stores and reads a per-tab profile', () => {
    installFakeSession();
    expect(getNetworkConditionsForTab(42)).toBeNull();
    setNetworkConditionsForTab(42, SLOW_3G);
    expect(getNetworkConditionsForTab(42)).toEqual(SLOW_3G);
  });

  it('clears a profile when set to null', () => {
    installFakeSession();
    setNetworkConditionsForTab(42, SLOW_3G);
    setNetworkConditionsForTab(42, null);
    expect(getNetworkConditionsForTab(42)).toBeNull();
    expect(getActiveNetworkConditionTabIds()).toEqual([]);
  });

  it('tracks active tab ids independently', () => {
    installFakeSession();
    setNetworkConditionsForTab(1, SLOW_3G);
    setNetworkConditionsForTab(2, SLOW_3G);
    expect(new Set(getActiveNetworkConditionTabIds())).toEqual(new Set([1, 2]));
    forgetNetworkConditionsForTab(1);
    expect(getActiveNetworkConditionTabIds()).toEqual([2]);
  });
});

describe('apply-now replay seam', () => {
  it('replays the tab on a set and on a clear', () => {
    installFakeSession();
    const replay = vi.fn();
    registerNetworkConditionsReplay(replay);

    setNetworkConditionsForTab(7, SLOW_3G);
    expect(replay).toHaveBeenCalledWith(7);

    replay.mockClear();
    setNetworkConditionsForTab(7, null);
    expect(replay).toHaveBeenCalledWith(7);
  });
});

describe('persistence', () => {
  it('persists the map to session storage (debounced)', async () => {
    const fake = installFakeSession();
    setNetworkConditionsForTab(42, SLOW_3G);
    await flushPersist();
    expect(fake.set).toHaveBeenCalled();
    expect(fake.store[STORAGE_KEY]).toEqual({ '42': SLOW_3G });
  });

  it('survives a simulated SW wake via rehydrate', async () => {
    // Pre-wake: a profile was persisted for tab 42.
    installFakeSession({ [STORAGE_KEY]: { '42': SLOW_3G } });
    // Cold module — rehydrate rebuilds the in-memory map from the store.
    await rehydrateNetworkConditionsFromSession();
    expect(getNetworkConditionsForTab(42)).toEqual(SLOW_3G);
  });

  it('ignores malformed persisted entries on rehydrate', async () => {
    installFakeSession({
      [STORAGE_KEY]: { '42': SLOW_3G, '7': { offline: 'nope' }, bad: SLOW_3G },
    });
    await rehydrateNetworkConditionsFromSession();
    // The valid entry survives; the malformed value and non-numeric key drop.
    expect(getNetworkConditionsForTab(42)).toEqual(SLOW_3G);
    expect(getActiveNetworkConditionTabIds()).toEqual([42]);
  });

  it('is a no-op when session storage is unavailable', async () => {
    // No chrome.storage.session installed — must not throw.
    await rehydrateNetworkConditionsFromSession();
    setNetworkConditionsForTab(42, SLOW_3G);
    expect(getNetworkConditionsForTab(42)).toEqual(SLOW_3G);
  });
});
