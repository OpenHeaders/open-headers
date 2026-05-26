import { describe, expect, it } from 'vitest';

import type { RequestRecord, RuleSnapshot } from '@openheaders/core/types';

import { MAX_FIRES_PER_TAB, RuleFireStore } from '../../src/rule-fire-hub/store';

function rec(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    ruleUid: 'rule-a',
    url: 'https://openheaders.io/api',
    pattern: '*://openheaders.io/*',
    resourceType: 'xmlhttprequest',
    t: 1000,
    evidence: 'matched',
    requestId: 'req-1',
    ...overrides,
  };
}

describe('RuleFireStore — dedup + merge', () => {
  it('first arrival inserts; same key heuristic re-arrival is a no-op', () => {
    const store = new RuleFireStore();
    expect(store.ingest(7, rec(), false)?.authoritative).toBe(false);
    expect(store.ingest(7, rec(), false)).toBeNull();
  });

  it('upgrades heuristic to authoritative on same dedup key', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec(), false);
    const merged = store.ingest(7, rec({ evidence: 'matched' }), true);
    expect(merged?.authoritative).toBe(true);
  });

  it('upgrades evidence to stronger tier on same dedup key', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ evidence: 'matched-fallback' }), false);
    const merged = store.ingest(7, rec({ evidence: 'confirmed' }), false);
    expect(merged?.record.evidence).toBe('confirmed');
  });

  it('adopts ruleSnapshot from incoming when existing did not have one', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec(), false);
    const snap: RuleSnapshot = { ruleUid: 'rule-a', name: 'Rule A', type: 'header', enabled: true };
    const merged = store.ingest(7, rec({ ruleSnapshot: snap }), false);
    expect(merged?.record.ruleSnapshot).toBe(snap);
  });

  it('keeps existing ruleSnapshot when both have one (first-arrival wins)', () => {
    const store = new RuleFireStore();
    const snapA: RuleSnapshot = { ruleUid: 'rule-a', name: 'Rule A', type: 'header', enabled: true };
    const snapB: RuleSnapshot = { ruleUid: 'rule-a', name: 'Rule A renamed', type: 'header', enabled: true };
    store.ingest(7, rec({ ruleSnapshot: snapA }), false);
    const merged = store.ingest(7, rec({ evidence: 'confirmed', ruleSnapshot: snapB }), false);
    expect(merged?.record.ruleSnapshot).toBe(snapA);
  });

  it('different (ruleUid, requestId) pairs are distinct entries', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ requestId: 'req-1' }), false);
    store.ingest(7, rec({ requestId: 'req-2' }), false);
    expect(store.snapshotTab(7)).toHaveLength(2);
  });

  it('scriptable fires (no requestId) dedup by (ruleUid, t)', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ requestId: undefined, t: 100 }), false);
    expect(store.ingest(7, rec({ requestId: undefined, t: 100 }), false)).toBeNull();
    store.ingest(7, rec({ requestId: undefined, t: 200 }), false);
    expect(store.snapshotTab(7)).toHaveLength(2);
  });

  it('snapshotTab returns arrival order (oldest first)', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ requestId: 'a' }), false);
    store.ingest(7, rec({ requestId: 'b' }), false);
    store.ingest(7, rec({ requestId: 'c' }), false);
    expect(store.snapshotTab(7).map((e) => e.record.requestId)).toEqual(['a', 'b', 'c']);
  });

  it('forgetTab drops the bucket and returns true only when state existed', () => {
    const store = new RuleFireStore();
    expect(store.forgetTab(7)).toBe(false);
    store.ingest(7, rec(), false);
    expect(store.forgetTab(7)).toBe(true);
    expect(store.snapshotTab(7)).toEqual([]);
  });

  it('per-tab cap evicts oldest by arrival', () => {
    const store = new RuleFireStore();
    for (let i = 0; i < MAX_FIRES_PER_TAB + 5; i++) {
      store.ingest(7, rec({ requestId: `req-${i}` }), false);
    }
    const snap = store.snapshotTab(7);
    expect(snap).toHaveLength(MAX_FIRES_PER_TAB);
    expect(snap[0].record.requestId).toBe(`req-5`);
    expect(snap[snap.length - 1].record.requestId).toBe(`req-${MAX_FIRES_PER_TAB + 4}`);
  });
});
