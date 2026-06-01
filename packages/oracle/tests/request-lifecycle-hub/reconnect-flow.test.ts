/**
 * T7 — full hub reconnect-flow integration: subscribe → live updates →
 * disconnect (detach) → store keeps reducing → reconnect (new attach) →
 * snapshot is replayed in canonical order with the post-disconnect
 * state; subsequent live updates flow normally.
 *
 * The unit-level coverage of `snapshotToUpdates` lives at `./replay.test.ts`;
 * the per-method hub plumbing lives at `./hub.test.ts`. This file is the
 * integration assertion that ties store + hub + sink together across a
 * disconnect/reconnect boundary — the wire scenario the panel-side
 * consumer is built to survive (port disconnects on tab focus changes
 * and on SW lifecycle).
 *
 * Key load-bearing property: replay is SNAPSHOT-ONLY. The hub does not
 * record the events that landed between detach and reattach; the
 * reconnecting consumer gets one synthetic `started` per current
 * lifecycle carrying the post-reduce phase, then resumes live. Consumers
 * reduce both replay and live updates through the same reducer — they
 * never branch on "is this replay or live."
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import { RequestLifecycleHub } from '../../src/request-lifecycle-hub/hub';
import type { Sink } from '../../src/request-lifecycle-hub/types';
import { InMemoryWatchSessionFloors } from '../../src/request-lifecycle-hub/watch-session-floors';
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
    deliverTabCleared() {
      /* unused in this suite */
    },
    close() {
      sink.closed++;
    },
  };
  return sink;
}

const TAB = 1;

function startUpdate(
  requestId: string,
  overrides?: { phase?: 'pending' | 'headers-received' },
): RequestLifecycleUpdate {
  return {
    kind: 'started',
    lifecycle: makeLifecycle({ tabId: TAB, requestId, phase: overrides?.phase ?? 'pending' }),
  };
}

function phaseUpdate(
  requestId: string,
  phase: 'headers-received' | 'completed' | 'failed',
  extra: Partial<{ statusCode: number; statusText: string; completedAtMs: number }> = {},
): RequestLifecycleUpdate {
  return {
    kind: 'phase',
    tabId: TAB,
    requestId,
    patch: { phase, ...extra },
  };
}

describe('RequestLifecycleHub — disconnect / reconnect flow (T7)', () => {
  it('attach → live → detach → store keeps reducing → reattach replays final snapshot then live flows', () => {
    const store = new RequestLifecycleStore();
    // The session floor outlives the hub (persisted host-side), so the
    // post-restart hub reuses the floor established on first attach.
    const floors = new InMemoryWatchSessionFloors();
    const hub = new RequestLifecycleHub({ store, sessionFloors: floors });

    // Phase 1: attach sink A on the empty tab (floor below all requests),
    // live updates flow.
    const sinkA = recordingSink();
    hub.attach(TAB, sinkA);

    store.apply(startUpdate('req-1'));
    store.apply(phaseUpdate('req-1', 'headers-received', { statusCode: 200, statusText: 'OK' }));
    expect(sinkA.ready).toEqual([TAB]);
    expect(sinkA.updates.map((u) => u.kind)).toEqual(['started', 'phase']);

    // Phase 2: detach. Store keeps reducing without a sink attached.
    hub.dispose();
    store.apply(phaseUpdate('req-1', 'completed', { completedAtMs: 2_000 }));
    store.apply(startUpdate('req-2'));
    store.apply(phaseUpdate('req-2', 'headers-received', { statusCode: 404 }));
    expect(sinkA.updates.map((u) => u.kind)).toEqual(['started', 'phase']);

    // Phase 3: reattach via a fresh hub (post-disposal flow). Sink B
    // sees `ready` plus replay of the CURRENT snapshot — one synthetic
    // `started` per lifecycle, each carrying the post-reduce phase.
    const hub2 = new RequestLifecycleHub({ store, sessionFloors: floors });
    const sinkB = recordingSink();
    // The reconnecting consumer re-resolves the SAME persisted session
    // floor, restoring the full session.
    hub2.attach(TAB, sinkB);

    expect(sinkB.ready).toEqual([TAB]);
    const replay = sinkB.updates;
    expect(replay).toHaveLength(2);
    expect(replay.every((u) => u.kind === 'started')).toBe(true);

    const replayed = replay.flatMap((u) => (u.kind === 'started' ? [u.lifecycle] : []));
    const byId = new Map(replayed.map((lc) => [lc.requestId, lc]));
    expect(byId.get('req-1')?.phase).toBe('completed');
    expect(byId.get('req-1')?.statusCode).toBe(200);
    expect(byId.get('req-1')?.completedAtMs).toBe(2_000);
    expect(byId.get('req-2')?.phase).toBe('headers-received');
    expect(byId.get('req-2')?.statusCode).toBe(404);

    // Intermediate phase events that fired while detached are NOT
    // replayed — replay is snapshot-only.
    for (const u of replay) {
      expect(u.kind).toBe('started');
    }

    // Phase 4: live updates after reattach reach sinkB normally.
    store.apply(phaseUpdate('req-2', 'completed', { completedAtMs: 3_000 }));
    expect(sinkB.updates).toHaveLength(3);
    expect(sinkB.updates[2]?.kind).toBe('phase');

    hub2.dispose();
  });

  it('detach via handle (without dispose) and reattach on same hub replays post-detach state', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });

    const sinkA = recordingSink();
    const handleA = hub.attach(TAB, sinkA);
    store.apply(startUpdate('req-x'));
    expect(sinkA.updates).toHaveLength(1);

    handleA.detach();
    // Live updates between detach and reattach: not delivered to A,
    // store reduces them, snapshot reflects them.
    store.apply(phaseUpdate('req-x', 'headers-received', { statusCode: 201 }));
    store.apply(phaseUpdate('req-x', 'completed', { completedAtMs: 5_000 }));
    expect(sinkA.updates).toHaveLength(1);

    const sinkB = recordingSink();
    hub.attach(TAB, sinkB);
    expect(sinkB.ready).toEqual([TAB]);
    expect(sinkB.updates).toHaveLength(1);
    const first = sinkB.updates[0];
    if (first?.kind !== 'started') throw new Error('expected started');
    expect(first.lifecycle.phase).toBe('completed');
    expect(first.lifecycle.statusCode).toBe(201);
    expect(first.lifecycle.completedAtMs).toBe(5_000);

    hub.dispose();
  });

  it('reconnect after `gone` does not surface the deleted lifecycle in replay', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });

    const sinkA = recordingSink();
    const handleA = hub.attach(TAB, sinkA);
    store.apply(startUpdate('keeper'));
    store.apply(startUpdate('doomed'));
    handleA.detach();

    store.apply({ kind: 'gone', tabId: TAB, requestId: 'doomed' });

    const sinkB = recordingSink();
    hub.attach(TAB, sinkB);
    const replayed = sinkB.updates.flatMap((u) => (u.kind === 'started' ? [u.lifecycle.requestId] : []));
    expect(replayed).toEqual(['keeper']);
    expect(replayed).not.toContain('doomed');

    hub.dispose();
  });

  it('detached sink does not receive `close` from a live store update (close is hub-initiated only)', () => {
    const store = new RequestLifecycleStore();
    const hub = new RequestLifecycleHub({ store });
    const sinkA = recordingSink();
    const handleA = hub.attach(TAB, sinkA);
    handleA.detach();
    store.apply(startUpdate('after-detach'));
    expect(sinkA.closed).toBe(0);
    hub.dispose();
  });
});
