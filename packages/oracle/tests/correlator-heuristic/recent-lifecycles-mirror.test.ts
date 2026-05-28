/**
 * `RecentLifecyclesMirror` — per-tab partition of "what the correlator
 * has emitted so far", consulted on every HAR attachment to enforce
 * invariant 1 (no attachment without a lifecycle).
 */

import { describe, expect, it } from 'vitest';

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

import { RecentLifecyclesMirror } from '../../src/correlator-heuristic/recent-lifecycles-mirror';

const TAB = 7;

function lifecycle(over: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: TAB,
    requestId: 'wr-1',
    url: 'https://openheaders.io/',
    method: 'GET',
    resourceType: 'main_frame',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_700_000_000_000,
    hopStartedAtMs: 1_700_000_000_000,
    har: [],
    harBodyByHop: [],
    ...over,
  };
}

describe('RecentLifecyclesMirror — set / has', () => {
  it('reports nothing before any set', () => {
    const mirror = new RecentLifecyclesMirror();
    expect(mirror.has(TAB, 'wr-1')).toBe(false);
    expect(mirror.size()).toBe(0);
  });

  it('records and reports presence keyed by (tabId, requestId)', () => {
    const mirror = new RecentLifecyclesMirror();
    mirror.set(TAB, 'wr-1', lifecycle());
    expect(mirror.has(TAB, 'wr-1')).toBe(true);
    expect(mirror.has(TAB, 'wr-2')).toBe(false);
    expect(mirror.has(TAB + 1, 'wr-1')).toBe(false);
    expect(mirror.size()).toBe(1);
  });

  it('overwrites the prior lifecycle on re-set (latest emission wins)', () => {
    const mirror = new RecentLifecyclesMirror();
    mirror.set(TAB, 'wr-1', lifecycle({ phase: 'pending' }));
    mirror.set(TAB, 'wr-1', lifecycle({ phase: 'completed' }));
    expect(mirror.size()).toBe(1);
  });
});

describe('RecentLifecyclesMirror — forget / forgetTab / clear', () => {
  it('forget drops a single entry and prunes empty tab partition', () => {
    const mirror = new RecentLifecyclesMirror();
    mirror.set(TAB, 'wr-1', lifecycle({ requestId: 'wr-1' }));
    mirror.set(TAB, 'wr-2', lifecycle({ requestId: 'wr-2' }));

    mirror.forget(TAB, 'wr-1');
    expect(mirror.has(TAB, 'wr-1')).toBe(false);
    expect(mirror.has(TAB, 'wr-2')).toBe(true);
    expect(mirror.size()).toBe(1);

    mirror.forget(TAB, 'wr-2');
    expect(mirror.size()).toBe(0);
  });

  it('forget on an unknown tab is a no-op', () => {
    const mirror = new RecentLifecyclesMirror();
    mirror.set(TAB, 'wr-1', lifecycle());
    mirror.forget(TAB + 9, 'wr-1');
    expect(mirror.has(TAB, 'wr-1')).toBe(true);
    expect(mirror.size()).toBe(1);
  });

  it('forgetTab drops every entry for that tab and leaves siblings intact', () => {
    const mirror = new RecentLifecyclesMirror();
    mirror.set(TAB, 'wr-1', lifecycle({ requestId: 'wr-1' }));
    mirror.set(TAB, 'wr-2', lifecycle({ requestId: 'wr-2' }));
    mirror.set(TAB + 1, 'wr-3', lifecycle({ tabId: TAB + 1, requestId: 'wr-3' }));

    mirror.forgetTab(TAB);
    expect(mirror.has(TAB, 'wr-1')).toBe(false);
    expect(mirror.has(TAB, 'wr-2')).toBe(false);
    expect(mirror.has(TAB + 1, 'wr-3')).toBe(true);
    expect(mirror.size()).toBe(1);
  });

  it('does not confuse requestIds that share a tab-prefix string shape', () => {
    // Regression for the H5 finding: previously keyed by `${tabId}:${requestId}`
    // and `detachTab` used `key.startsWith(`${tabId}:`)`, which would have
    // matched cross-tab keys like "1:foo" vs "10:foo" if anyone ever
    // changed the encoder. Per-tab partitioning makes that class of bug
    // structurally impossible.
    const mirror = new RecentLifecyclesMirror();
    mirror.set(1, 'wr-x', lifecycle({ tabId: 1, requestId: 'wr-x' }));
    mirror.set(10, 'wr-x', lifecycle({ tabId: 10, requestId: 'wr-x' }));

    mirror.forgetTab(1);
    expect(mirror.has(1, 'wr-x')).toBe(false);
    expect(mirror.has(10, 'wr-x')).toBe(true);
  });

  it('clear drops every entry across every tab', () => {
    const mirror = new RecentLifecyclesMirror();
    mirror.set(TAB, 'wr-1', lifecycle());
    mirror.set(TAB + 1, 'wr-2', lifecycle({ tabId: TAB + 1, requestId: 'wr-2' }));

    mirror.clear();
    expect(mirror.size()).toBe(0);
    expect(mirror.has(TAB, 'wr-1')).toBe(false);
    expect(mirror.has(TAB + 1, 'wr-2')).toBe(false);
  });
});
