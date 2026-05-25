import { describe, expect, it, vi } from 'vitest';

import { FireClientStore } from '@openheaders/ui/panel/data/fire-client-store';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';

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

  it('ingest appends a new fire + notifies', () => {
    const store = new FireClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.ingest(fire());
    expect(store.getSnapshot().fires).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('dedups by (ruleUid, requestId) — second arrival with weaker evidence is NOOP', () => {
    const store = new FireClientStore();
    store.ingest(fire({ evidence: 'confirmed', authoritative: true }));
    const listener = vi.fn();
    store.subscribe(listener);
    store.ingest(fire({ evidence: 'matched', authoritative: false }));
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot().fires).toHaveLength(1);
  });

  it('upgrades existing fire when stronger evidence arrives', () => {
    const store = new FireClientStore();
    store.ingest(fire({ evidence: 'matched', authoritative: false }));
    const listener = vi.fn();
    store.subscribe(listener);
    store.ingest(fire({ evidence: 'confirmed', authoritative: true }));
    expect(listener).toHaveBeenCalledTimes(1);
    const stored = store.getSnapshot().fires[0];
    expect(stored.evidence).toBe('confirmed');
    expect(stored.authoritative).toBe(true);
  });

  it('keeps scriptable-only fires (no requestId) as distinct entries when t differs', () => {
    const store = new FireClientStore();
    store.ingest(fire({ requestId: undefined, t: 1 }));
    store.ingest(fire({ requestId: undefined, t: 2 }));
    expect(store.getSnapshot().fires).toHaveLength(2);
  });

  it('clear() empties + notifies; NOOP on already-empty', () => {
    const store = new FireClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear();
    expect(listener).not.toHaveBeenCalled();
    store.ingest(fire());
    listener.mockClear();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().fires).toEqual([]);
  });

  it('snapshot identity is stable across getSnapshot calls until a mutation', () => {
    const store = new FireClientStore();
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    store.ingest(fire());
    expect(store.getSnapshot()).not.toBe(a);
  });
});
