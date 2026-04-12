import { beforeEach, describe, expect, it } from 'vitest';

import {
  __internals,
  __resetForTests,
  clearTab,
  getTabSnapshot,
  getTabSnapshotForScope,
  isTracked,
  recordDnrMatch,
  recordScriptFire,
  resetForNavigation,
  startTracking,
  stopTracking,
} from '@/background/modules/tab-telemetry';

beforeEach(() => {
  __resetForTests();
});

describe('tab-telemetry — tracking lifecycle', () => {
  it('first reason starts tracking; subsequent reasons stack', () => {
    expect(isTracked(1)).toBe(false);

    startTracking(1, 'active-popup');
    expect(isTracked(1)).toBe(true);

    startTracking(1, 'test:abc');
    expect(isTracked(1)).toBe(true);
    expect(__internals.tabCount).toBe(1);
  });

  it('stopTracking removes only the given reason; state persists while others remain', () => {
    startTracking(1, 'active-popup');
    startTracking(1, 'test:abc');

    stopTracking(1, 'active-popup');
    expect(isTracked(1)).toBe(true);

    stopTracking(1, 'test:abc');
    expect(isTracked(1)).toBe(false);
  });

  it('startTracking is idempotent for duplicate reasons', () => {
    startTracking(1, 'active-popup');
    startTracking(1, 'active-popup');
    startTracking(1, 'active-popup');

    stopTracking(1, 'active-popup');
    expect(isTracked(1)).toBe(false);
  });

  it('stopTracking on unknown tab is a no-op', () => {
    expect(() => stopTracking(42, 'active-popup')).not.toThrow();
    expect(isTracked(42)).toBe(false);
  });

  it('clearTab removes all state regardless of reasons', () => {
    startTracking(1, 'active-popup');
    startTracking(1, 'test:abc');
    clearTab(1);
    expect(isTracked(1)).toBe(false);
  });
});

describe('tab-telemetry — scriptable fires', () => {
  it('recordScriptFire is a no-op for untracked tabs', () => {
    recordScriptFire(1, 'rule-a', 'https://api.openheaders.io/x', 'delay', 100);
    expect(getTabSnapshot(1).fires).toHaveLength(0);
    expect(isTracked(1)).toBe(false);
  });

  it('recordScriptFire appends to fires and increments counter for tracked tabs', () => {
    startTracking(1, 'active-popup');

    recordScriptFire(1, 'rule-a', 'https://api.openheaders.io/x', 'delay', 100);
    recordScriptFire(1, 'rule-a', 'https://api.openheaders.io/y', 'delay', 200);
    recordScriptFire(1, 'rule-b', 'https://api.openheaders.io/z', 'mock', 300);

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(3);
    expect(snap.fires[0]).toMatchObject({ ruleUid: 'rule-a', kind: 'delay', t: 100 });
    expect(snap.fires[2]).toMatchObject({ ruleUid: 'rule-b', kind: 'mock', t: 300 });
    expect(snap.counters).toEqual({ 'rule-a': 2, 'rule-b': 1 });
  });

  it('fire log is capped but counters keep growing past the cap', () => {
    startTracking(1, 'active-popup');

    const cap = __internals.MAX_FIRES_PER_TAB;
    for (let i = 0; i < cap + 50; i++) {
      recordScriptFire(1, 'rule-a', `https://api.openheaders.io/${i}`, 'delay', i);
    }

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(cap);
    // Oldest entries shifted out — first remaining fire is #50
    expect(snap.fires[0]?.t).toBe(50);
    // Counter counts every fire, uncapped
    expect(snap.counters['rule-a']).toBe(cap + 50);
  });
});

describe('tab-telemetry — DNR matches', () => {
  it('recordDnrMatch is a no-op for untracked tabs', () => {
    recordDnrMatch(1, 'rule-a', 'https://openheaders.io/', 100);
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });

  it('records with kind:dnr for tracked tabs', () => {
    startTracking(1, 'active-popup');
    recordDnrMatch(1, 'rule-a', 'https://openheaders.io/api', 100);

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(1);
    expect(snap.fires[0]).toMatchObject({ ruleUid: 'rule-a', kind: 'dnr', url: 'https://openheaders.io/api', t: 100 });
    expect(snap.counters).toEqual({ 'rule-a': 1 });
  });

  it('dedupes identical (ruleUid, url, t) — e.g. webRequest double-observing a redirect', () => {
    startTracking(1, 'active-popup');

    recordDnrMatch(1, 'rule-a', 'https://openheaders.io/api', 100);
    recordDnrMatch(1, 'rule-a', 'https://openheaders.io/api', 100); // duplicate
    recordDnrMatch(1, 'rule-a', 'https://openheaders.io/api', 101); // different t
    recordDnrMatch(1, 'rule-a', 'https://openheaders.io/other', 100); // different url

    expect(getTabSnapshot(1).counters['rule-a']).toBe(3);
  });
});

describe('tab-telemetry — navigation reset', () => {
  it('resetForNavigation clears fires, counters, and dedup but preserves reasons', () => {
    startTracking(1, 'active-popup');
    recordScriptFire(1, 'rule-a', 'https://openheaders.io/', 'delay', 100);
    recordDnrMatch(1, 'rule-b', 'https://openheaders.io/', 100);

    resetForNavigation(1);

    expect(isTracked(1)).toBe(true);
    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(0);
    expect(snap.counters).toEqual({});

    // Re-record with the same (uid, url, t) that was previously deduped —
    // it should now record because dedup set was cleared.
    recordDnrMatch(1, 'rule-b', 'https://openheaders.io/', 100);
    expect(getTabSnapshot(1).counters['rule-b']).toBe(1);
  });

  it('resetForNavigation on untracked tab is a no-op', () => {
    expect(() => resetForNavigation(99)).not.toThrow();
  });
});

describe('tab-telemetry — scoped snapshot', () => {
  it('filters fires and counters by scope set', () => {
    startTracking(1, 'test:session-x');
    recordScriptFire(1, 'rule-a', 'https://openheaders.io/', 'delay', 100);
    recordScriptFire(1, 'rule-b', 'https://openheaders.io/', 'mock', 200);
    recordDnrMatch(1, 'rule-c', 'https://openheaders.io/', 300);

    const scoped = getTabSnapshotForScope(1, new Set(['rule-a', 'rule-c']));
    expect(scoped.fires.map((f) => f.ruleUid)).toEqual(['rule-a', 'rule-c']);
    expect(scoped.counters).toEqual({ 'rule-a': 1, 'rule-c': 1 });
  });

  it('returns empty snapshot for untracked tabs', () => {
    const scoped = getTabSnapshotForScope(99, new Set(['rule-a']));
    expect(scoped.fires).toHaveLength(0);
    expect(scoped.counters).toEqual({});
  });

  it('omits counters for uids that had no fires', () => {
    startTracking(1, 'test:s');
    recordScriptFire(1, 'rule-a', 'https://openheaders.io/', 'delay', 100);

    const scoped = getTabSnapshotForScope(1, new Set(['rule-a', 'rule-missing']));
    expect(scoped.counters).toEqual({ 'rule-a': 1 });
    expect('rule-missing' in scoped.counters).toBe(false);
  });
});

describe('tab-telemetry — snapshot isolation', () => {
  it('snapshot arrays are copies — mutating them does not affect internal state', () => {
    startTracking(1, 'active-popup');
    recordScriptFire(1, 'rule-a', 'https://openheaders.io/', 'delay', 100);

    const snap = getTabSnapshot(1);
    snap.fires.push({ ruleUid: 'injected', url: '', kind: 'delay', t: 0 });

    const fresh = getTabSnapshot(1);
    expect(fresh.fires).toHaveLength(1);
    expect(fresh.fires[0]?.ruleUid).toBe('rule-a');
  });
});
