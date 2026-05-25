/**
 * `RequestLifecycleStore` orchestration tests — backs S1, S5, S6 + the
 * tab-scope (invariant 2) and identity-tuple (invariant 1) properties
 * the store layer owns.
 */

import { describe, expect, it, vi } from 'vitest';

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import { RequestLifecycleStore } from '../../src/request-lifecycle-store/store';
import { makeLifecycle } from './factories';

describe('RequestLifecycleStore — invariants 1 + 2 (identity + tab scope)', () => {
  it('keeps lifecycles on the same `(tabId, requestId)` distinct from a same-requestId-different-tab entry', () => {
    const store = new RequestLifecycleStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r' }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 2, requestId: 'r' }) });
    expect(store.get(1, 'r')?.tabId).toBe(1);
    expect(store.get(2, 'r')?.tabId).toBe(2);
  });

  it('forgetTab(t) drops only t (invariant 2 — tab scope)', () => {
    const store = new RequestLifecycleStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r1' }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 2, requestId: 'r2' }) });
    store.forgetTab(1);
    expect(store.get(1, 'r1')).toBeUndefined();
    expect(store.get(2, 'r2')).toBeDefined();
  });

  it('snapshotTab returns empty for an unknown tab and a stable array otherwise', () => {
    const store = new RequestLifecycleStore();
    expect(store.snapshotTab(999)).toEqual([]);
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'a' }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'b' }) });
    const snap = store.snapshotTab(1);
    expect(snap.map((l) => l.requestId)).toEqual(['a', 'b']);
  });
});

describe('RequestLifecycleStore — subscribe (S5)', () => {
  it('fires for accepted updates in registration order', () => {
    const store = new RequestLifecycleStore();
    const calls: string[] = [];
    store.subscribe(() => calls.push('first'));
    store.subscribe(() => calls.push('second'));
    store.apply({ kind: 'started', lifecycle: makeLifecycle() });
    expect(calls).toEqual(['first', 'second']);
  });

  it('does not fire for rejected updates', () => {
    const store = new RequestLifecycleStore();
    const fn = vi.fn();
    store.subscribe(fn);
    // Phase patch with no prior `started`.
    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'missing',
      patch: { phase: 'completed' },
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('returned Unsubscribe removes the listener', () => {
    const store = new RequestLifecycleStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ requestId: 'a' }) });
    off();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ requestId: 'b' }) });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('RequestLifecycleStore — rejection + eviction callbacks', () => {
  it('onReject is called with the offending update + reason', () => {
    const onReject = vi.fn();
    const store = new RequestLifecycleStore({ onReject });
    const update: RequestLifecycleUpdate = {
      kind: 'phase',
      tabId: 1,
      requestId: 'missing',
      patch: { phase: 'completed' },
    };
    store.apply(update);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith(update, 'unknown-request');
  });

  it('onEvict fires when LRU drops an entry', () => {
    const onEvict = vi.fn();
    const store = new RequestLifecycleStore({ maxLifecyclesPerTab: 1, onEvict });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ requestId: 'a' }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ requestId: 'b' }) });
    expect(onEvict).toHaveBeenCalledTimes(1);
    const [evicted] = onEvict.mock.calls[0] ?? [];
    expect(evicted?.requestId).toBe('a');
  });
});

describe('RequestLifecycleStore — gone semantics (S6 store contract)', () => {
  it('deleting the last entry on a tab drops the partition', () => {
    const store = new RequestLifecycleStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r' }) });
    store.apply({ kind: 'gone', tabId: 1, requestId: 'r' });
    // Nothing left on tab 1 — snapshot is empty.
    expect(store.snapshotTab(1)).toEqual([]);
  });

  it('gone on an unknown request is a silent noop (does not invoke subscribers)', () => {
    const store = new RequestLifecycleStore();
    const fn = vi.fn();
    store.subscribe(fn);
    store.apply({ kind: 'gone', tabId: 1, requestId: 'missing' });
    expect(fn).not.toHaveBeenCalled();
  });
});
