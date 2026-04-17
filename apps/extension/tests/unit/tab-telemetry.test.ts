import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __internals,
  __resetForTests,
  clearTab,
  getTabSnapshot,
  getTabSnapshotForScope,
  isTracked,
  onMainFrameError,
  onMainFrameRedirect,
  onMainFrameRequest,
  onPageCommit,
  recordObservedFire,
  recordScriptableFire,
  startTracking,
  stopTracking,
  updateRequestDeliveryMode,
} from '@/background/modules/tab-telemetry';

// ── Fixture helpers ──────────────────────────────────────────────────

const DNR_META = {
  resourceType: 'xmlhttprequest' as const,
  pattern: '*://*.openheaders.io/*',
  deferred: false,
};

const DEFERRED_META = {
  resourceType: 'xmlhttprequest' as const,
  pattern: '*://*.openheaders.io/*',
  deferred: true,
};

const SCRIPTABLE_META = {
  resourceType: 'xmlhttprequest' as const,
  pattern: '*://*.openheaders.io/*',
};

const MAIN_FRAME_META = {
  resourceType: 'main_frame' as const,
  pattern: '*://openheaders.io/',
  deferred: false,
};

beforeEach(() => {
  vi.useFakeTimers();
  __resetForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tracking lifecycle ───────────────────────────────────────────────

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

// ── Scriptable fires ─────────────────────────────────────────────────

describe('tab-telemetry — scriptable fires', () => {
  it('is a no-op for untracked tabs', () => {
    recordScriptableFire(1, 'rule-a', 'https://api.openheaders.io/x', 100, SCRIPTABLE_META);
    expect(getTabSnapshot(1).fires).toHaveLength(0);
    expect(isTracked(1)).toBe(false);
  });

  it('appends scriptable fires with evidence=confirmed and increments counters', () => {
    startTracking(1, 'active-popup');
    recordScriptableFire(1, 'rule-a', 'https://api.openheaders.io/x', 100, SCRIPTABLE_META);
    recordScriptableFire(1, 'rule-a', 'https://api.openheaders.io/y', 200, SCRIPTABLE_META);
    recordScriptableFire(1, 'rule-b', 'https://api.openheaders.io/z', 300, SCRIPTABLE_META);

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(3);
    expect(snap.fires[0]).toMatchObject({ ruleUid: 'rule-a', evidence: 'confirmed', t: 100 });
    expect(snap.fires[2]).toMatchObject({ ruleUid: 'rule-b', evidence: 'confirmed', t: 300 });
    expect(snap.counters).toEqual({ 'rule-a': 2, 'rule-b': 1 });
  });

  it('populates byRule unique maps with insertion-ordered records', () => {
    startTracking(1, 'active-popup');
    recordScriptableFire(1, 'rule-a', 'https://api.openheaders.io/x', 100, SCRIPTABLE_META);
    recordScriptableFire(1, 'rule-a', 'https://api.openheaders.io/y', 200, SCRIPTABLE_META);

    const snap = getTabSnapshot(1);
    expect(snap.byRule['rule-a']?.map((r) => r.url)).toEqual([
      'https://api.openheaders.io/x',
      'https://api.openheaders.io/y',
    ]);
    expect(snap.uniqueRequestCount).toBe(2);
  });

  it('re-observing a URL keeps uniques at 1 and moves it to the LRU tail', () => {
    startTracking(1, 'active-popup');
    recordScriptableFire(1, 'rule-a', 'https://api.openheaders.io/x', 100, SCRIPTABLE_META);
    recordScriptableFire(1, 'rule-a', 'https://api.openheaders.io/y', 200, SCRIPTABLE_META);
    recordScriptableFire(1, 'rule-a', 'https://api.openheaders.io/x', 300, SCRIPTABLE_META);

    const snap = getTabSnapshot(1);
    // Counter = 3 events; byRule still has 2 unique URLs, x moved to the tail.
    expect(snap.counters['rule-a']).toBe(3);
    expect(snap.byRule['rule-a']?.map((r) => r.url)).toEqual([
      'https://api.openheaders.io/y',
      'https://api.openheaders.io/x',
    ]);
  });

  it('fire log is capped but counters keep growing past the cap', () => {
    startTracking(1, 'active-popup');
    const cap = __internals.MAX_FIRES_PER_TAB;
    for (let i = 0; i < cap + 50; i++) {
      recordScriptableFire(1, 'rule-a', `https://api.openheaders.io/${i}`, i, SCRIPTABLE_META);
    }
    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(cap);
    expect(snap.fires[0]?.t).toBe(50);
    expect(snap.counters['rule-a']).toBe(cap + 50);
  });

  it('uniquesByRule is LRU-capped at MAX_UNIQUE_URLS_PER_RULE per rule', () => {
    startTracking(1, 'active-popup');
    // Temporarily we can't change the cap, so this is a shape assertion rather
    // than a value one — verify that insertion past the cap evicts oldest.
    const cap = __internals.MAX_UNIQUE_URLS_PER_RULE;
    for (let i = 0; i < cap + 5; i++) {
      recordScriptableFire(1, 'rule-a', `https://api.openheaders.io/item/${i}`, i, SCRIPTABLE_META);
    }
    const snap = getTabSnapshot(1);
    expect(snap.byRule['rule-a']).toHaveLength(cap);
    // Oldest 5 should have been evicted — item/0..4 gone, item/5..cap+4 kept.
    const urls = snap.byRule['rule-a']!.map((r) => r.url);
    expect(urls[0]).toBe('https://api.openheaders.io/item/5');
    expect(urls[urls.length - 1]).toBe(`https://api.openheaders.io/item/${cap + 4}`);
  });
});

// ── Observed fires (pure DNR path) ───────────────────────────────────

describe('tab-telemetry — observed fires (non-deferred rule types)', () => {
  it('no-op for untracked tabs', () => {
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/api', 'req-1', 100, DNR_META);
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });

  it('sub-resource observation attributes to current page immediately with matched evidence', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/api', 'req-xhr-1', 100, DNR_META);

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(1);
    expect(snap.fires[0]).toMatchObject({ ruleUid: 'rule-a', evidence: 'matched', t: 100 });
    expect(snap.counters).toEqual({ 'rule-a': 1 });
  });

  it('dedupes by (ruleUid, requestId) — redirect re-observation does not double-count', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/api', 'req-1', 100, DNR_META);
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/api', 'req-1', 101, DNR_META);
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/api', 'req-2', 100, DNR_META);

    expect(getTabSnapshot(1).counters['rule-a']).toBe(2);
  });

  it('main-frame observed fires are buffered until commit', () => {
    startTracking(1, 'active-popup');
    onMainFrameRequest(1, 'req-mainframe', 'https://openheaders.io/');
    recordObservedFire(1, 'rule-delay', 'https://openheaders.io/', 'req-mainframe', 100, MAIN_FRAME_META);

    expect(getTabSnapshot(1).fires).toHaveLength(0);
    expect(getTabSnapshot(1).counters).toEqual({});
  });
});

// ── Shadow arbitration propagation ───────────────────────────────────

describe('tab-telemetry — shadowedBy propagation', () => {
  it('carries shadowedBy from ObservedFireMeta into the stored RequestRecord', () => {
    startTracking(1, 'active-popup');
    const shadowedBy = { uid: 'block-1', name: 'Block ads', kind: 'block-terminal' as const };
    recordObservedFire(1, 'rule-header', 'https://api.openheaders.io/x', 'req-1', 100, { ...DNR_META, shadowedBy });

    const snap = getTabSnapshot(1);
    expect(snap.fires[0]?.shadowedBy).toEqual(shadowedBy);
    expect(snap.byRule['rule-header']?.[0]?.shadowedBy).toEqual(shadowedBy);
  });

  it('omits shadowedBy when the arbitrator has no claim', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-header', 'https://api.openheaders.io/x', 'req-1', 100, DNR_META);

    const snap = getTabSnapshot(1);
    expect(snap.fires[0]?.shadowedBy).toBeUndefined();
  });

  it('scriptable fires never carry shadowedBy (ground truth — the rule ran)', () => {
    startTracking(1, 'active-popup');
    recordScriptableFire(1, 'rule-mock', 'https://api.openheaders.io/x', 100, SCRIPTABLE_META);
    const snap = getTabSnapshot(1);
    expect(snap.fires[0]?.shadowedBy).toBeUndefined();
  });
});

// ── Scriptable fallback window (deferred rule types) ────────────────

describe('tab-telemetry — deferred observed + 500ms scriptable fallback', () => {
  it('observed then scriptable within the window: scriptable wins, no double-count', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-mock', 'https://api.openheaders.io/x', 'req-1', 100, DEFERRED_META);
    // Nothing visible yet — buffered.
    expect(getTabSnapshot(1).fires).toHaveLength(0);

    vi.advanceTimersByTime(200);
    recordScriptableFire(1, 'rule-mock', 'https://api.openheaders.io/x', 300, SCRIPTABLE_META);

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(1);
    expect(snap.fires[0]).toMatchObject({ ruleUid: 'rule-mock', evidence: 'confirmed', t: 300 });
    expect(snap.counters).toEqual({ 'rule-mock': 1 });

    // Advance past the fallback window to prove the observed timer was cancelled.
    vi.advanceTimersByTime(1000);
    expect(getTabSnapshot(1).counters['rule-mock']).toBe(1);
  });

  it('observed with no scriptable within the window: promoted as matched-fallback', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-mock', 'https://api.openheaders.io/x', 'req-1', 100, DEFERRED_META);
    expect(getTabSnapshot(1).fires).toHaveLength(0);

    vi.advanceTimersByTime(__internals.FALLBACK_WINDOW_MS);

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(1);
    expect(snap.fires[0]).toMatchObject({ ruleUid: 'rule-mock', evidence: 'matched-fallback', t: 100 });
    expect(snap.counters).toEqual({ 'rule-mock': 1 });
  });

  it('scriptable first then observed within the window: observed suppressed', () => {
    startTracking(1, 'active-popup');
    recordScriptableFire(1, 'rule-mock', 'https://api.openheaders.io/x', 100, SCRIPTABLE_META);
    expect(getTabSnapshot(1).counters['rule-mock']).toBe(1);

    vi.advanceTimersByTime(200);
    recordObservedFire(1, 'rule-mock', 'https://api.openheaders.io/x', 'req-1', 300, DEFERRED_META);

    // Still just the one scriptable fire — observed was suppressed.
    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(1);
    expect(snap.counters['rule-mock']).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(getTabSnapshot(1).counters['rule-mock']).toBe(1);
  });

  it('late scriptable (after fallback window): both records exist — fallback + confirmed', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-mock', 'https://api.openheaders.io/x', 'req-1', 100, DEFERRED_META);

    vi.advanceTimersByTime(__internals.FALLBACK_WINDOW_MS);
    // Fallback has fired — record promoted.
    expect(getTabSnapshot(1).counters['rule-mock']).toBe(1);
    expect(getTabSnapshot(1).fires[0]?.evidence).toBe('matched-fallback');

    // A scriptable fire at t+600ms is a genuinely separate signal.
    recordScriptableFire(1, 'rule-mock', 'https://api.openheaders.io/x', 700, SCRIPTABLE_META);

    // Counter is now 2 (two events), but byRule is still 1 unique URL —
    // the second observation upgraded the existing record to 'confirmed'
    // and moved it to the LRU tail.
    const snap = getTabSnapshot(1);
    expect(snap.counters['rule-mock']).toBe(2);
    expect(snap.byRule['rule-mock']).toHaveLength(1);
    expect(snap.byRule['rule-mock']?.[0]?.evidence).toBe('confirmed');
  });

  it('non-deferred observed fires ignore the window and record immediately', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-block', 'https://ads.openheaders.io/tracker', 'req-1', 100, DNR_META);
    // Immediate — no buffering for non-deferred types.
    expect(getTabSnapshot(1).counters['rule-block']).toBe(1);
    expect(getTabSnapshot(1).fires[0]?.evidence).toBe('matched');
  });

  it('clearTab cancels any pending fallback timers', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-mock', 'https://api.openheaders.io/x', 'req-1', 100, DEFERRED_META);
    clearTab(1);
    // Timer was cancelled — advancing time past the window must not resurrect state.
    vi.advanceTimersByTime(1000);
    expect(isTracked(1)).toBe(false);
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });
});

// ── Page-context attribution ─────────────────────────────────────────

describe('tab-telemetry — page-context attribution', () => {
  it('onPageCommit promotes pending fires whose requestId matches the committed URL', () => {
    startTracking(1, 'active-popup');

    onMainFrameRequest(1, 'req-1', 'https://openheaders.io/');
    recordObservedFire(1, 'rule-delay', 'https://openheaders.io/', 'req-1', 100, MAIN_FRAME_META);

    onPageCommit(1, 'https://openheaders.io/');

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(1);
    expect(snap.fires[0]).toMatchObject({ ruleUid: 'rule-delay', evidence: 'matched' });
    expect(snap.counters).toEqual({ 'rule-delay': 1 });
  });

  it('delay chain: redirect extends the chain and promotes fires on commit', () => {
    startTracking(1, 'active-popup');

    onMainFrameRequest(1, 'req-1', 'https://openheaders.io/');
    recordObservedFire(1, 'rule-delay', 'https://openheaders.io/', 'req-1', 100, MAIN_FRAME_META);
    onMainFrameRedirect(1, 'req-1', 'chrome-extension://abc/delay.html?ms=5000#https://openheaders.io/');
    onPageCommit(1, 'https://openheaders.io/');

    const snap = getTabSnapshot(1);
    expect(snap.counters['rule-delay']).toBe(1);
  });

  it('trailing slash is normalized between pending and committed URLs', () => {
    startTracking(1, 'active-popup');
    onMainFrameRequest(1, 'req-1', 'https://openheaders.io');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io', 'req-1', 100, MAIN_FRAME_META);
    onPageCommit(1, 'https://openheaders.io/');

    expect(getTabSnapshot(1).counters['rule-a']).toBe(1);
  });

  it('onPageCommit drops pending fires whose requestId does not match the committed URL', () => {
    startTracking(1, 'active-popup');
    onMainFrameRequest(1, 'req-a', 'https://openheaders.io/a');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/a', 'req-a', 100, MAIN_FRAME_META);
    onPageCommit(1, 'https://other-site.example/');
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });

  it('onPageCommit wipes previous-page fires so counts do not bleed across page loads', () => {
    startTracking(1, 'active-popup');
    recordScriptableFire(1, 'rule-a', 'https://openheaders.io/', 100, SCRIPTABLE_META);
    expect(getTabSnapshot(1).counters['rule-a']).toBe(1);

    onPageCommit(1, 'https://openheaders.io/other');

    const snap = getTabSnapshot(1);
    expect(snap.fires).toHaveLength(0);
    expect(snap.counters).toEqual({});
    expect(snap.byRule).toEqual({});
  });

  it('onPageCommit cancels any in-flight fallback timers', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-mock', 'https://api.openheaders.io/x', 'req-1', 100, DEFERRED_META);
    onPageCommit(1, 'https://openheaders.io/new');
    vi.advanceTimersByTime(1000);
    // Timer was cancelled — the abandoned observation must not appear in the new page.
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });

  it('onMainFrameError releases the chain slot and drops pending fires', () => {
    startTracking(1, 'active-popup');
    onMainFrameRequest(1, 'req-1', 'https://openheaders.io/');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/', 'req-1', 100, MAIN_FRAME_META);

    onMainFrameError(1, 'req-1');

    onPageCommit(1, 'https://openheaders.io/');
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });
});

// ── Scoped snapshot (test-runner) ────────────────────────────────────

describe('tab-telemetry — scoped snapshot', () => {
  it('filters fires, counters, and byRule by scope set', () => {
    startTracking(1, 'test:session-x');
    recordScriptableFire(1, 'rule-a', 'https://openheaders.io/a', 100, SCRIPTABLE_META);
    recordScriptableFire(1, 'rule-b', 'https://openheaders.io/b', 200, SCRIPTABLE_META);
    recordObservedFire(1, 'rule-c', 'https://openheaders.io/c', 'req-x', 300, DNR_META);

    const scoped = getTabSnapshotForScope(1, new Set(['rule-a', 'rule-c']));
    expect(scoped.fires.map((f) => f.ruleUid)).toEqual(['rule-a', 'rule-c']);
    expect(scoped.counters).toEqual({ 'rule-a': 1, 'rule-c': 1 });
    expect(Object.keys(scoped.byRule).sort()).toEqual(['rule-a', 'rule-c']);
    expect(scoped.uniqueRequestCount).toBe(2);
  });

  it('returns empty snapshot for untracked tabs', () => {
    const scoped = getTabSnapshotForScope(99, new Set(['rule-a']));
    expect(scoped.fires).toHaveLength(0);
    expect(scoped.counters).toEqual({});
    expect(scoped.byRule).toEqual({});
    expect(scoped.uniqueRequestCount).toBe(0);
  });

  it('omits counters for uids that had no fires', () => {
    startTracking(1, 'test:s');
    recordScriptableFire(1, 'rule-a', 'https://openheaders.io/', 100, SCRIPTABLE_META);

    const scoped = getTabSnapshotForScope(1, new Set(['rule-a', 'rule-missing']));
    expect(scoped.counters).toEqual({ 'rule-a': 1 });
    expect('rule-missing' in scoped.counters).toBe(false);
    expect('rule-missing' in scoped.byRule).toBe(false);
  });
});

// ── Snapshot isolation ───────────────────────────────────────────────

describe('tab-telemetry — snapshot isolation', () => {
  it('snapshot arrays are copies — mutating them does not affect internal state', () => {
    startTracking(1, 'active-popup');
    recordScriptableFire(1, 'rule-a', 'https://openheaders.io/', 100, SCRIPTABLE_META);

    const snap = getTabSnapshot(1);
    snap.fires.push({
      ruleUid: 'injected',
      url: '',
      pattern: '*',
      resourceType: 'other',
      evidence: 'confirmed',
      t: 0,
    });

    const fresh = getTabSnapshot(1);
    expect(fresh.fires).toHaveLength(1);
    expect(fresh.fires[0]?.ruleUid).toBe('rule-a');
  });
});

// ── Delivery mode + per-rule counters ────────────────────────────────

describe('delivery mode + updateRequestDeliveryMode', () => {
  it('counters is empty on a fresh tab', () => {
    startTracking(1, 'active-popup');
    expect(getTabSnapshot(1).counters).toEqual({});
  });

  it('each fire increments the rule-uid counter', () => {
    startTracking(1, 'active-popup');

    recordObservedFire(1, 'rule-a', 'https://openheaders.io/a', 'req-1', 100, DNR_META);
    recordObservedFire(1, 'rule-b', 'https://openheaders.io/b', 'req-2', 101, DNR_META);
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/c', 'req-3', 102, DNR_META);

    const snap = getTabSnapshot(1);
    expect(snap.counters).toEqual({ 'rule-a': 2, 'rule-b': 1 });
  });

  it('scoped snapshot reports counters for the scope only', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/a', 'req-1', 100, DNR_META);
    recordObservedFire(1, 'rule-b', 'https://openheaders.io/b', 'req-2', 101, DNR_META);

    const scoped = getTabSnapshotForScope(1, new Set(['rule-a']));
    expect(scoped.counters).toEqual({ 'rule-a': 1 });
  });

  it('records carry requestId so delivery-mode back-fill can target them', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/a', 'req-42', 100, DNR_META);

    const snap = getTabSnapshot(1);
    expect(snap.fires[0]?.requestId).toBe('req-42');
    expect(snap.fires[0]?.deliveryMode).toBeUndefined();
  });

  it('updateRequestDeliveryMode back-fills all records for a given requestId', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/a', 'req-10', 100, DNR_META);
    recordObservedFire(1, 'rule-b', 'https://openheaders.io/a', 'req-10', 100, DNR_META);

    updateRequestDeliveryMode(1, 'req-10', 'cached');

    const snap = getTabSnapshot(1);
    expect(snap.fires.every((f) => f.deliveryMode === 'cached')).toBe(true);
    // byRule also reflects the back-fill via shared object references.
    for (const records of Object.values(snap.byRule)) {
      for (const r of records) expect(r.deliveryMode).toBe('cached');
    }
  });

  it('updateRequestDeliveryMode is a no-op for an unknown requestId', () => {
    startTracking(1, 'active-popup');
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/a', 'req-10', 100, DNR_META);

    updateRequestDeliveryMode(1, 'req-never-seen', 'cached');

    expect(getTabSnapshot(1).fires[0]?.deliveryMode).toBeUndefined();
  });

  it('updateRequestDeliveryMode is a no-op for an untracked tab', () => {
    // Untracked tab — no state to update; should not throw.
    expect(() => updateRequestDeliveryMode(999, 'req-1', 'network')).not.toThrow();
  });

  it('scriptable fires have no requestId and no deliveryMode', () => {
    startTracking(1, 'active-popup');
    recordScriptableFire(1, 'rule-a', 'https://openheaders.io/a', 100, SCRIPTABLE_META);

    const record = getTabSnapshot(1).fires[0]!;
    expect(record.requestId).toBeUndefined();
    expect(record.deliveryMode).toBeUndefined();
  });

  it('back-fill reaches main-frame pending records too', () => {
    startTracking(1, 'active-popup');
    onMainFrameRequest(1, 'req-mf', 'https://openheaders.io/');
    // Main-frame fires queue into pendingFires until commit.
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/', 'req-mf', 100, MAIN_FRAME_META);

    updateRequestDeliveryMode(1, 'req-mf', 'network');
    // Before commit, no snapshot view of pending — but the commit path
    // must carry the back-filled mode through into fires.
    onPageCommit(1, 'https://openheaders.io/');

    expect(getTabSnapshot(1).fires[0]?.deliveryMode).toBe('network');
  });
});
