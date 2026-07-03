import { FireClientStore } from '@openheaders/ui/panel/data/stores/fire-client-store';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Notify-on-mutate semantics are frame-independent; drive them
// synchronously. Frame coalescing is covered in `snapshot-publisher.test.ts`.
beforeEach(() => setNotifyScheduler(createSyncNotifyScheduler()));
afterEach(() => setNotifyScheduler(null));

function fire(over: Partial<InspectorFire> = {}): InspectorFire {
  return {
    ruleUid: 'rule_a',
    t: 1,
    pattern: '*',
    authoritative: true,
    requestId: 'r1',
    evidence: 'confirmed',
    ...over,
  };
}

describe('FireClientStore', () => {
  it('starts empty + frozen snapshot', () => {
    const store = new FireClientStore();
    expect(store.getSnapshot().fires).toEqual([]);
  });

  it('upsert appends a new fire + notifies', () => {
    const store = new FireClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.upsert(fire());
    expect(store.getSnapshot().fires).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('upsert by (ruleUid, requestId) overwrites the existing entry — engine has already deduped', () => {
    const store = new FireClientStore();
    store.upsert(fire({ evidence: 'matched', authoritative: false }));
    const listener = vi.fn();
    store.subscribe(listener);
    store.upsert(fire({ evidence: 'confirmed', authoritative: true }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().fires).toHaveLength(1);
    const stored = store.getSnapshot().fires[0];
    expect(stored.evidence).toBe('confirmed');
    expect(stored.authoritative).toBe(true);
  });

  it('keeps scriptable-only fires (no requestId) as distinct entries when t differs', () => {
    const store = new FireClientStore();
    store.upsert(fire({ requestId: undefined, t: 1 }));
    store.upsert(fire({ requestId: undefined, t: 2 }));
    expect(store.getSnapshot().fires).toHaveLength(2);
  });

  it('clear() empties + notifies; NOOP on already-empty', () => {
    const store = new FireClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear();
    expect(listener).not.toHaveBeenCalled();
    store.upsert(fire());
    listener.mockClear();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().fires).toEqual([]);
  });

  it('snapshot identity is stable across getSnapshot calls until a mutation', () => {
    const store = new FireClientStore();
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    store.upsert(fire());
    expect(store.getSnapshot()).not.toBe(a);
  });
});
