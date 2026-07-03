/**
 * Tab-overrides module — per-tab system-override store backing the panel's
 * User-Agent control (CDP Control Plane, Phase F3). Covers the in-memory map,
 * the apply-now replay seam, the `chrome.storage.session` persistence
 * round-trip, and SW-wake rehydration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { TabSystemOverrides } from '@openheaders/core/types';
import {
  __resetTabOverridesForTests,
  forgetTabOverridesForTab,
  getActiveTabOverrideTabIds,
  getTabOverridesForTab,
  registerTabOverridesReplay,
  rehydrateTabOverridesFromSession,
  setTabOverridesForTab,
} from '@/background/modules/tabs/tab-overrides';

const UA: TabSystemOverrides = { userAgent: 'Test-Agent/1.0 (openheaders.io)' };

const STORAGE_KEY = 'cdp.tabOverrides';

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
  __resetTabOverridesForTests();
});

afterEach(() => {
  __resetTabOverridesForTests();
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

describe('set / get / forget', () => {
  it('stores and reads a per-tab override', () => {
    installFakeSession();
    expect(getTabOverridesForTab(42)).toBeNull();
    setTabOverridesForTab(42, UA);
    expect(getTabOverridesForTab(42)).toEqual(UA);
  });

  it('clears an override when set to null', () => {
    installFakeSession();
    setTabOverridesForTab(42, UA);
    setTabOverridesForTab(42, null);
    expect(getTabOverridesForTab(42)).toBeNull();
    expect(getActiveTabOverrideTabIds()).toEqual([]);
  });

  it('tracks active tab ids independently', () => {
    installFakeSession();
    setTabOverridesForTab(1, UA);
    setTabOverridesForTab(2, UA);
    expect(new Set(getActiveTabOverrideTabIds())).toEqual(new Set([1, 2]));
    forgetTabOverridesForTab(1);
    expect(getActiveTabOverrideTabIds()).toEqual([2]);
  });
});

describe('apply-now replay seam', () => {
  it('replays the tab on a set and on a clear', () => {
    installFakeSession();
    const replay = vi.fn();
    registerTabOverridesReplay(replay);

    setTabOverridesForTab(7, UA);
    expect(replay).toHaveBeenCalledWith(7);

    replay.mockClear();
    setTabOverridesForTab(7, null);
    expect(replay).toHaveBeenCalledWith(7);
  });
});

describe('persistence', () => {
  it('persists the map to session storage (debounced)', async () => {
    const fake = installFakeSession();
    setTabOverridesForTab(42, UA);
    await flushPersist();
    expect(fake.set).toHaveBeenCalled();
    expect(fake.store[STORAGE_KEY]).toEqual({ '42': UA });
  });

  it('survives a simulated SW wake via rehydrate', async () => {
    installFakeSession({ [STORAGE_KEY]: { '42': UA } });
    await rehydrateTabOverridesFromSession();
    expect(getTabOverridesForTab(42)).toEqual(UA);
  });

  it('ignores malformed persisted entries on rehydrate', async () => {
    installFakeSession({
      // valid; non-string facet (drops); all-empty bag (collapses to null); non-numeric key (drops).
      [STORAGE_KEY]: { '42': UA, '7': { userAgent: 123 }, '9': {}, bad: UA },
    });
    await rehydrateTabOverridesFromSession();
    expect(getTabOverridesForTab(42)).toEqual(UA);
    expect(getActiveTabOverrideTabIds()).toEqual([42]);
  });

  it('is a no-op when session storage is unavailable', async () => {
    await rehydrateTabOverridesFromSession();
    setTabOverridesForTab(42, UA);
    expect(getTabOverridesForTab(42)).toEqual(UA);
  });
});
