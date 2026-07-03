/**
 * Client-side store (P2) — single-tab Map mirror over the wire. Asserts
 * snapshot stability, notify-on-mutate (and not-on-noop), and clear /
 * delete semantics.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { LifecycleClientStore } from '@openheaders/ui/panel/data/lifecycle';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// These assert mutation→notify semantics (notify on real change, skip on
// noop), which is orthogonal to frame batching — drive notifications
// synchronously so a single `apply` is observable without a frame flush.
// Coalescing is covered separately in `snapshot-publisher.test.ts`.
beforeEach(() => setNotifyScheduler(createSyncNotifyScheduler()));
afterEach(() => setNotifyScheduler(null));

function makeLifecycle(over: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'r1',
    url: 'https://openheaders.io/a',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 100,
    hopStartedAtMs: 100,
    har: [],
    harBodyByHop: [],
    ...over,
  };
}

describe('LifecycleClientStore', () => {
  it('starts empty with a stable snapshot reference', () => {
    const store = new LifecycleClientStore();
    expect(store.getSnapshot().ordered).toEqual([]);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('apply(started) inserts and notifies', () => {
    const store = new LifecycleClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.apply({ kind: 'started', lifecycle: makeLifecycle() });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().ordered).toHaveLength(1);
    expect(store.getSnapshot().byRequestId.get('r1')?.url).toBe('https://openheaders.io/a');
  });

  it('apply(started) for an already-known requestId is a noop (no notify, snapshot stable)', () => {
    const store = new LifecycleClientStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle() });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ url: 'https://other' }) });
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(before);
  });

  it('apply(phase) merges patch and produces a NEW snapshot reference', () => {
    const store = new LifecycleClientStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle() });
    const before = store.getSnapshot();
    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'r1',
      patch: { phase: 'completed', statusCode: 200, completedAtMs: 200 },
    });
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.byRequestId.get('r1')?.phase).toBe('completed');
    expect(after.byRequestId.get('r1')?.statusCode).toBe(200);
  });

  it('apply(gone) deletes and notifies', () => {
    const store = new LifecycleClientStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle() });
    const listener = vi.fn();
    store.subscribe(listener);
    store.apply({ kind: 'gone', tabId: 1, requestId: 'r1' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().ordered).toEqual([]);
  });

  it('clear() drops everything and notifies, but only when state was non-empty', () => {
    const store = new LifecycleClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear();
    expect(listener).not.toHaveBeenCalled();
    store.apply({ kind: 'started', lifecycle: makeLifecycle() });
    listener.mockClear();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().ordered).toEqual([]);
  });

  it('subscribe returns an unsubscribe handle', () => {
    const store = new LifecycleClientStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.apply({ kind: 'started', lifecycle: makeLifecycle() });
    expect(listener).not.toHaveBeenCalled();
  });

  it('preserves insertion order in `ordered`', () => {
    const store = new LifecycleClientStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ requestId: 'a', startedAtMs: 1 }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ requestId: 'b', startedAtMs: 2 }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ requestId: 'c', startedAtMs: 3 }) });
    expect(store.getSnapshot().ordered.map((l: RequestLifecycle) => l.requestId)).toEqual(['a', 'b', 'c']);
  });
});
