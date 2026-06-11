import type { RequestRecord, RuleSnapshot } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import { MAX_FIRES_PER_TAB, RuleFireStore } from '../../src/rule-fire-hub/store';
import { TRANSLATION_WINDOW_MS } from '../../src/rule-fire-hub/translation';

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

  it('cross-id-space: exactly one driver candidate is upgraded in place under its own key', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ requestId: 'page::1.5', t: 1000 }), false);
    const snap: RuleSnapshot = { ruleUid: 'rule-a', name: 'Rule A', type: 'header', enabled: true };
    const merged = store.ingestTranslated(
      7,
      rec({ requestId: '4471', t: 1040, ruleSnapshot: snap }),
      'https://openheaders.io/api',
    );
    expect(merged?.authoritative).toBe(true);
    expect(merged?.record.requestId).toBe('page::1.5');
    expect(merged?.record.ruleSnapshot).toBe(snap);
    expect(store.snapshotTab(7)).toHaveLength(1);
  });

  it('cross-id-space: zero candidates buffers the arrival; the next matching insert pairs in one step', () => {
    const store = new RuleFireStore();
    expect(store.ingestTranslated(7, rec({ requestId: '4471', t: 1000 }), 'https://openheaders.io/api')).toBeNull();
    expect(store.snapshotTab(7)).toHaveLength(0);
    const inserted = store.ingest(7, rec({ requestId: 'page::1.5', t: 1030 }), false);
    expect(inserted?.authoritative).toBe(true);
    expect(inserted?.record.requestId).toBe('page::1.5');
    expect(store.snapshotTab(7)).toHaveLength(1);
  });

  it('cross-id-space: two same-(rule,url) candidates in the window is ambiguous — no upgrade, no insert', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ requestId: 'page::1.5', t: 1000 }), false);
    store.ingest(7, rec({ requestId: 'page::1.6', t: 1010 }), false);
    expect(store.ingestTranslated(7, rec({ requestId: '4471', t: 1040 }), 'https://openheaders.io/api')).toBeNull();
    const snap = store.snapshotTab(7);
    expect(snap).toHaveLength(2);
    expect(snap.every((e) => !e.authoritative)).toBe(true);
  });

  it('cross-id-space: an already-authoritative entry never counts as a candidate', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ requestId: 'page::1.5', t: 1000 }), false);
    store.ingestTranslated(7, rec({ requestId: '4471', t: 1020 }), 'https://openheaders.io/api');
    store.ingest(7, rec({ requestId: 'page::1.6', t: 1050 }), false);
    const merged = store.ingestTranslated(7, rec({ requestId: '4472', t: 1080 }), 'https://openheaders.io/api');
    expect(merged?.authoritative).toBe(true);
    expect(merged?.record.requestId).toBe('page::1.6');
  });

  it('cross-id-space: a candidate outside the pairing window does not bind', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ requestId: 'page::1.5', t: 1000 }), false);
    const arrival = rec({ requestId: '4471', t: 1000 + TRANSLATION_WINDOW_MS + 1 });
    expect(store.ingestTranslated(7, arrival, 'https://openheaders.io/api')).toBeNull();
    expect(store.snapshotTab(7)[0].authoritative).toBe(false);
  });

  it('cross-id-space: a url mismatch never binds', () => {
    const store = new RuleFireStore();
    store.ingest(7, rec({ requestId: 'page::1.5', url: 'https://openheaders.io/other', t: 1000 }), false);
    expect(store.ingestTranslated(7, rec({ requestId: '4471', t: 1020 }), 'https://openheaders.io/api')).toBeNull();
    expect(store.snapshotTab(7)[0].authoritative).toBe(false);
  });

  it('cross-id-space: a pending older than the window is pruned, not paired', () => {
    const store = new RuleFireStore();
    store.ingestTranslated(7, rec({ requestId: '4471', t: 1000 }), 'https://openheaders.io/api');
    const late = store.ingest(7, rec({ requestId: 'page::1.5', t: 1000 + TRANSLATION_WINDOW_MS + 1 }), false);
    expect(late?.authoritative).toBe(false);
  });

  it('cross-id-space: two pendings matching one insert is ambiguous — both dropped, never paired', () => {
    const store = new RuleFireStore();
    store.ingestTranslated(7, rec({ requestId: '4471', t: 1000 }), 'https://openheaders.io/api');
    store.ingestTranslated(7, rec({ requestId: '4472', t: 1010 }), 'https://openheaders.io/api');
    const first = store.ingest(7, rec({ requestId: 'page::1.5', t: 1040 }), false);
    expect(first?.authoritative).toBe(false);
    const second = store.ingest(7, rec({ requestId: 'page::1.6', t: 1050 }), false);
    expect(second?.authoritative).toBe(false);
  });

  it('cross-id-space: forgetTab clears the pending buffer too', () => {
    const store = new RuleFireStore();
    store.ingestTranslated(7, rec({ requestId: '4471', t: 1000 }), 'https://openheaders.io/api');
    store.forgetTab(7);
    const inserted = store.ingest(7, rec({ requestId: 'page::1.5', t: 1020 }), false);
    expect(inserted?.authoritative).toBe(false);
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
