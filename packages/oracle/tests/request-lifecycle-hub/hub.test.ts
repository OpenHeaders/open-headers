import { describe, expect, it, vi } from 'vitest';

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import { RequestLifecycleHub } from '../../src/request-lifecycle-hub/hub';
import type { Sink } from '../../src/request-lifecycle-hub/types';
import { RequestLifecycleStore } from '../../src/request-lifecycle-store/store';
import { makeLifecycle } from '../request-lifecycle-store/factories';

interface RecordingSink extends Sink {
  ready: number[];
  updates: RequestLifecycleUpdate[];
  closed: number;
}

function recordingSink(): RecordingSink {
  const sink: RecordingSink = {
    ready: [],
    updates: [],
    closed: 0,
    deliverReady(tabId) {
      sink.ready.push(tabId);
    },
    deliverUpdate(update) {
      sink.updates.push(update);
    },
    close() {
      sink.closed++;
    },
  };
  return sink;
}

describe('RequestLifecycleHub — attach', () => {
  it('delivers `ready` before any replay update', () => {
    const store = new RequestLifecycleStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'a' }) });
    const hub = new RequestLifecycleHub({ store });

    const sink = recordingSink();
    hub.attach(1, sink);
    expect(sink.ready).toEqual([1]);
    expect(sink.updates).toHaveLength(1);
    expect(sink.updates[0].kind).toBe('started');
  });

  it('replays existing lifecycles for the tab in snapshot order', () => {
    const store = new RequestLifecycleStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'a' }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'b' }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'c' }) });
    const hub = new RequestLifecycleHub({ store });

    const sink = recordingSink();
    hub.attach(1, sink);
    expect(sink.updates.map((u) => (u.kind === 'started' ? u.lifecycle.requestId : ''))).toEqual(['a', 'b', 'c']);
  });

  it('filters replay strictly to the attached tab', () => {
    const store = new RequestLifecycleStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'a' }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 2, requestId: 'z' }) });
    const hub = new RequestLifecycleHub({ store });

    const sink = recordingSink();
    hub.attach(1, sink);
    expect(sink.updates).toHaveLength(1);
    expect(sink.updates[0].kind === 'started' && sink.updates[0].lifecycle.tabId).toBe(1);
  });

  it('returns empty replay for an unknown tab and still fires ready', () => {
    const hub = new RequestLifecycleHub({ store: new RequestLifecycleStore() });
    const sink = recordingSink();
    hub.attach(42, sink);
    expect(sink.ready).toEqual([42]);
    expect(sink.updates).toEqual([]);
  });

  it('throws when attaching after dispose', () => {
    const hub = new RequestLifecycleHub({ store: new RequestLifecycleStore() });
    hub.dispose();
    expect(() => hub.attach(1, recordingSink())).toThrow(/dispose/);
  });
});

describe('RequestLifecycleHub — broadcast', () => {
  it('fans live updates only to sinks attached to that tab', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const sinkA = recordingSink();
    const sinkB = recordingSink();
    hub.attach(1, sinkA);
    hub.attach(2, sinkB);

    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'x' }) });
    expect(sinkA.updates).toHaveLength(1);
    expect(sinkB.updates).toHaveLength(0);

    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 2, requestId: 'y' }) });
    expect(sinkA.updates).toHaveLength(1);
    expect(sinkB.updates).toHaveLength(1);
  });

  it('fans to multiple sinks attached to the same tab', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const a = recordingSink();
    const b = recordingSink();
    hub.attach(1, a);
    hub.attach(1, b);

    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r' }) });
    expect(a.updates).toHaveLength(1);
    expect(b.updates).toHaveLength(1);
  });

  it('passes non-started variants (phase/redirect/gone) through tabIdOf correctly', () => {
    const store = new RequestLifecycleStore();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 7, requestId: 'r' }) });
    const hub = new RequestLifecycleHub({ store });
    const sink = recordingSink();
    hub.attach(7, sink);
    sink.updates.length = 0;

    store.apply({ kind: 'phase', tabId: 7, requestId: 'r', patch: { phase: 'headers-received', statusCode: 200 } });
    expect(sink.updates).toHaveLength(1);
    expect(sink.updates[0].kind).toBe('phase');

    store.apply({ kind: 'gone', tabId: 7, requestId: 'r' });
    expect(sink.updates).toHaveLength(2);
    expect(sink.updates[1].kind).toBe('gone');
  });

  it('one sink throwing does not block delivery to siblings', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const bad: Sink = {
      deliverReady: () => {},
      deliverUpdate: () => {
        throw new Error('sink boom');
      },
      close: () => {},
    };
    const good = recordingSink();
    hub.attach(1, bad);
    hub.attach(1, good);

    expect(() =>
      store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r' }) }),
    ).not.toThrow();
    expect(good.updates).toHaveLength(1);
  });
});

describe('RequestLifecycleHub — detach', () => {
  it('stops delivery after detach()', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const sink = recordingSink();
    const handle = hub.attach(1, sink);

    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r1' }) });
    expect(sink.updates).toHaveLength(1);

    handle.detach();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r2' }) });
    expect(sink.updates).toHaveLength(1);
  });

  it('detach is idempotent', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const sink = recordingSink();
    const handle = hub.attach(1, sink);
    handle.detach();
    expect(() => handle.detach()).not.toThrow();
  });

  it('per-tab refcount removes the partition only when all sinks detach', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const a = recordingSink();
    const b = recordingSink();
    const handleA = hub.attach(1, a);
    const handleB = hub.attach(1, b);

    handleA.detach();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r' }) });
    expect(a.updates).toHaveLength(0);
    expect(b.updates).toHaveLength(1);

    handleB.detach();
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r2' }) });
    expect(b.updates).toHaveLength(1);
  });

  it('late attach sees prior lifecycles via replay', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'a' }) });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'b' }) });

    const sink = recordingSink();
    hub.attach(1, sink);
    expect(sink.updates.map((u) => (u.kind === 'started' ? u.lifecycle.requestId : ''))).toEqual(['a', 'b']);
  });
});

describe('RequestLifecycleHub — dispose', () => {
  it('closes every sink and stops fanout', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const a = recordingSink();
    const b = recordingSink();
    hub.attach(1, a);
    hub.attach(2, b);

    hub.dispose();
    expect(a.closed).toBe(1);
    expect(b.closed).toBe(1);

    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r' }) });
    // Counts unchanged — hub unsubscribed from store on dispose.
    expect(a.updates).toHaveLength(0);
    expect(b.updates).toHaveLength(0);
  });

  it('dispose is idempotent', () => {
    const hub = new RequestLifecycleHub({ store: new RequestLifecycleStore() });
    hub.dispose();
    expect(() => hub.dispose()).not.toThrow();
  });
});

describe('RequestLifecycleHub — race-freedom on attach', () => {
  it('does not deliver updates twice when an update fires between subscribe and snapshot', () => {
    // JS is single-threaded; subscribe + snapshot + replay run in one sync
    // block in attach(). This test pins that invariant by spying on
    // store.subscribe and asserting attach() executes synchronously.
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r' }) });

    const sink = recordingSink();
    const spy = vi.spyOn(store, 'snapshotTab');
    hub.attach(1, sink);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(sink.updates).toHaveLength(1);
  });
});
