/**
 * Snapshot publisher batching — the Phase-1 acceptance criteria, exercised
 * through a real `LifecycleClientStore`:
 *   - a burst of N mutations in one frame fans out to subscribers once;
 *   - a reconnect replay (clear + N applies) is likewise one fan-out;
 *   - getSnapshot stays current between the mutation and the deferred notify;
 *   - at the React boundary, a burst yields exactly one extra render.
 *
 * The manual scheduler stands in for the frame clock so "one frame" is an
 * explicit `flushNow()` rather than a wall-clock rAF.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { LifecycleClientStore } from '@openheaders/ui/panel/data/lifecycle';
import { createManualNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/notify-scheduler';
import { act, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeLifecycle(requestId: string): RequestLifecycle {
  return {
    tabId: 1,
    requestId,
    url: `https://openheaders.io/${requestId}`,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 100,
    hopStartedAtMs: 100,
    har: [],
    harBodyByHop: [],
  };
}

let scheduler: ReturnType<typeof createManualNotifyScheduler>;

beforeEach(() => {
  scheduler = createManualNotifyScheduler();
  setNotifyScheduler(scheduler);
});

afterEach(() => setNotifyScheduler(null));

describe('snapshot publisher — frame batching', () => {
  it('coalesces a burst of N mutations into one notify', () => {
    const store = new LifecycleClientStore();
    const listener = vi.fn();
    store.subscribe(listener);

    for (let i = 0; i < 200; i++) {
      store.apply({ kind: 'started', lifecycle: makeLifecycle(`r${i}`) });
    }
    // Deferred: no fan-out yet, exactly one flush queued.
    expect(listener).not.toHaveBeenCalled();
    expect(scheduler.pendingCount()).toBe(1);

    scheduler.flushNow();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().ordered).toHaveLength(200);
  });

  it('coalesces a reconnect replay (clear + N applies) into one notify', () => {
    const store = new LifecycleClientStore();
    // Seed a first session and let it settle.
    store.apply({ kind: 'started', lifecycle: makeLifecycle('stale') });
    scheduler.flushNow();

    const listener = vi.fn();
    store.subscribe(listener);

    // Replay-on-`ready`: clear, then the engine re-streams the session.
    store.clear();
    for (let i = 0; i < 50; i++) {
      store.apply({ kind: 'started', lifecycle: makeLifecycle(`replay${i}`) });
    }
    expect(scheduler.pendingCount()).toBe(1);

    scheduler.flushNow();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().ordered.map((l) => l.requestId)).not.toContain('stale');
    expect(store.getSnapshot().ordered).toHaveLength(50);
  });

  it('keeps getSnapshot current before the deferred notify fires', () => {
    const store = new LifecycleClientStore();
    store.subscribe(vi.fn());

    store.apply({ kind: 'started', lifecycle: makeLifecycle('r1') });
    // The notify is still queued, but a synchronous read already sees it.
    expect(scheduler.pendingCount()).toBe(1);
    expect(store.getSnapshot().byRequestId.get('r1')?.requestId).toBe('r1');
  });
});

describe('snapshot publisher — React boundary', () => {
  it('a burst applied in one frame triggers exactly one extra render', () => {
    const store = new LifecycleClientStore();
    let renders = 0;
    function Probe(): null {
      renders++;
      useSyncExternalStore(store.subscribe, store.getSnapshot);
      return null;
    }

    render(<Probe />);
    const afterMount = renders;

    act(() => {
      for (let i = 0; i < 100; i++) {
        store.apply({ kind: 'started', lifecycle: makeLifecycle(`r${i}`) });
      }
    });
    // Mutations are batched: no render happened on apply.
    expect(renders).toBe(afterMount);

    act(() => scheduler.flushNow());
    // One frame → one render, regardless of burst size.
    expect(renders).toBe(afterMount + 1);
    expect(store.getSnapshot().ordered).toHaveLength(100);
  });
});
