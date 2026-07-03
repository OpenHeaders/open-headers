/**
 * Cache-bypass module — DNR session rule lifecycle for the panel's
 * "Bypass HTTP Cache" toggle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// `vi.mock` is hoisted above imports; use `vi.hoisted` to share the spy
// with the factory without running into the TDZ.
const { updateSessionRulesSpy, getSessionRulesSpy } = vi.hoisted(() => ({
  updateSessionRulesSpy: vi.fn(() => Promise.resolve()),
  getSessionRulesSpy: vi.fn(() => Promise.resolve([] as chrome.declarativeNetRequest.Rule[])),
}));

vi.mock('@utils/browser-api', () => ({
  declarativeNetRequest: {
    updateSessionRules: updateSessionRulesSpy,
    getSessionRules: getSessionRulesSpy,
  },
}));

import {
  __resetCacheBypassForTests,
  CACHE_BYPASS_ID_BASE,
  disableCacheBypassForTab,
  enableCacheBypassForTab,
  forgetCacheBypassForTab,
  getActiveCacheBypassTabIds,
  isCacheBypassActive,
  registerCacheBypassReplay,
  rehydrateCacheBypassFromSessionRules,
} from '@/background/modules/net/cache-bypass';

interface UpdateSessionRulesArg {
  removeRuleIds: number[];
  addRules: chrome.declarativeNetRequest.Rule[];
}

function firstCallArg(): UpdateSessionRulesArg {
  const calls = updateSessionRulesSpy.mock.calls as unknown as unknown[][];
  return calls[0]![0] as UpdateSessionRulesArg;
}

beforeEach(() => {
  updateSessionRulesSpy.mockClear();
  getSessionRulesSpy.mockReset();
  getSessionRulesSpy.mockResolvedValue([] as chrome.declarativeNetRequest.Rule[]);
});

afterEach(async () => {
  // Clean residual state so tests can't leak into each other.
  for (const id of getActiveCacheBypassTabIds()) {
    await disableCacheBypassForTab(id);
  }
  // Also drops any registered replay so a test's spy can't fire in the next.
  __resetCacheBypassForTests();
  updateSessionRulesSpy.mockClear();
});

describe('enableCacheBypassForTab', () => {
  it('installs a session rule scoped to the tab', async () => {
    await enableCacheBypassForTab(42);

    expect(updateSessionRulesSpy).toHaveBeenCalledTimes(1);
    const call = firstCallArg();
    expect(call.removeRuleIds).toEqual([CACHE_BYPASS_ID_BASE + 42]);
    expect(call.addRules).toHaveLength(1);

    const rule = call.addRules[0]!;
    expect(rule.id).toBe(CACHE_BYPASS_ID_BASE + 42);
    expect(rule.condition.tabIds).toEqual([42]);
    // Omitted resourceTypes → DNR matches every resource type, so the
    // rule stays correct when Chrome adds new types.
    expect(rule.condition.resourceTypes).toBeUndefined();

    const reqHeaders = rule.action.requestHeaders ?? [];
    expect(reqHeaders).toEqual([
      { operation: 'set', header: 'cache-control', value: 'no-cache' },
      { operation: 'set', header: 'pragma', value: 'no-cache' },
    ]);

    expect(isCacheBypassActive(42)).toBe(true);
  });
});

describe('disableCacheBypassForTab', () => {
  it('removes the session rule and clears tracking', async () => {
    await enableCacheBypassForTab(42);
    updateSessionRulesSpy.mockClear();

    await disableCacheBypassForTab(42);

    expect(updateSessionRulesSpy).toHaveBeenCalledTimes(1);
    const call = firstCallArg();
    expect(call.removeRuleIds).toEqual([CACHE_BYPASS_ID_BASE + 42]);
    expect(call.addRules).toEqual([]);
    expect(isCacheBypassActive(42)).toBe(false);
  });
});

describe('forgetCacheBypassForTab', () => {
  it('removes the DNR session rule when a tracked tab closes', async () => {
    await enableCacheBypassForTab(42);
    updateSessionRulesSpy.mockClear();

    await forgetCacheBypassForTab(42);

    // Must actually call Chrome to drop the rule — session rules are
    // NOT auto-evicted on tab close, so explicit removal is required.
    expect(updateSessionRulesSpy).toHaveBeenCalledTimes(1);
    const call = firstCallArg();
    expect(call.removeRuleIds).toEqual([CACHE_BYPASS_ID_BASE + 42]);
    expect(isCacheBypassActive(42)).toBe(false);
  });

  it('is a no-op when the tab was never tracked', async () => {
    await forgetCacheBypassForTab(999);

    expect(updateSessionRulesSpy).not.toHaveBeenCalled();
  });
});

describe('rehydrateCacheBypassFromSessionRules', () => {
  it('rebuilds the activeTabs set from Chrome session rule IDs in our range', async () => {
    getSessionRulesSpy.mockResolvedValueOnce([
      { id: CACHE_BYPASS_ID_BASE + 42 } as chrome.declarativeNetRequest.Rule,
      { id: CACHE_BYPASS_ID_BASE + 7 } as chrome.declarativeNetRequest.Rule,
      { id: 100 } as chrome.declarativeNetRequest.Rule, // unrelated rule, ignored
    ]);

    await rehydrateCacheBypassFromSessionRules();

    expect(new Set(getActiveCacheBypassTabIds())).toEqual(new Set([42, 7]));
  });

  it('is a no-op when no matching session rules exist', async () => {
    getSessionRulesSpy.mockResolvedValueOnce([]);
    await rehydrateCacheBypassFromSessionRules();
    expect(getActiveCacheBypassTabIds()).toEqual([]);
  });

  it('recovery survives a simulated SW wake + tab close', async () => {
    // Pre-restart: bypass was installed for tab 42. Simulate that
    // by having a session rule and a cold module-state start.
    getSessionRulesSpy.mockResolvedValueOnce([{ id: CACHE_BYPASS_ID_BASE + 42 } as chrome.declarativeNetRequest.Rule]);
    await rehydrateCacheBypassFromSessionRules();
    updateSessionRulesSpy.mockClear();

    // Now the tab closes — forgetCacheBypassForTab should find 42 in
    // the rehydrated set and actually call updateSessionRules to drop
    // the lingering rule. Without rehydration this would silently no-op.
    await forgetCacheBypassForTab(42);

    expect(updateSessionRulesSpy).toHaveBeenCalledTimes(1);
    expect(isCacheBypassActive(42)).toBe(false);
  });
});

describe('apply-now replay seam', () => {
  it('replays the tab on enable and on disable', async () => {
    const replay = vi.fn();
    registerCacheBypassReplay(replay);

    await enableCacheBypassForTab(7);
    expect(replay).toHaveBeenCalledWith(7);
    // The replay fires after activeTabs is mutated, so a re-derive sees on.
    expect(isCacheBypassActive(7)).toBe(true);

    replay.mockClear();
    await disableCacheBypassForTab(7);
    expect(replay).toHaveBeenCalledWith(7);
    expect(isCacheBypassActive(7)).toBe(false);
  });
});

describe('getActiveCacheBypassTabIds', () => {
  it('reflects enable / disable state', async () => {
    expect(getActiveCacheBypassTabIds()).toEqual([]);
    await enableCacheBypassForTab(1);
    await enableCacheBypassForTab(2);
    expect(new Set(getActiveCacheBypassTabIds())).toEqual(new Set([1, 2]));
    await disableCacheBypassForTab(1);
    expect(getActiveCacheBypassTabIds()).toEqual([2]);
  });
});
