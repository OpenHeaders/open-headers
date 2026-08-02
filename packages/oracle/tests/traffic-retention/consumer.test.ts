/**
 * `TrafficRetentionConsumer` — the triplet-reducer pins (AGENT_TRAFFIC_
 * PLAN.md §1.3, S0 findings 2 + 4): the arm floor from the FIRST
 * `ready`, ready-epoch replay dedup (a double-`ready` replay must not
 * double-count), no resurrection of ring-evicted identities, refinement
 * folding, body/stream updates ignored wholesale, provenance stamping,
 * and consent-refusal surfacing.
 */

import type { LifecycleWireMessage } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import { TrafficRetentionConsumer } from '../../src/traffic-retention/consumer';
import { TrafficRetentionRing } from '../../src/traffic-retention/store';
import { makeHarEntry, makeLifecycle } from './factories';

const BIG = 1_000_000;

function rig(bounds = { maxRecords: 100, maxBytes: BIG }) {
  const ring = new TrafficRetentionRing(bounds);
  const consumer = new TrafficRetentionConsumer({ ring });
  return { ring, consumer };
}

function ready(watermarkMs: number): LifecycleWireMessage {
  return { kind: 'ready', tabId: 1, watermarkMs };
}

function started(requestId: string, startedAtMs: number): LifecycleWireMessage {
  return {
    kind: 'lifecycle-update',
    update: { kind: 'started', lifecycle: makeLifecycle({ requestId, startedAtMs }) },
  };
}

describe('TrafficRetentionConsumer — arm floor (retention starts at arm time)', () => {
  it('drops replayed records at or below the first ready watermark', () => {
    const { ring, consumer } = rig();
    consumer.handle(ready(5_000));
    // The engine-owned watch-session floor is per-tab and shared, so the
    // replay can carry pre-arm history — all of it must drop.
    consumer.handle(started('pre-arm-old', 3_000));
    consumer.handle(started('pre-arm-edge', 5_000));
    consumer.handle(started('post-arm', 5_001));
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['post-arm']);
    expect(consumer.stats().droppedPreArm).toBe(2);
  });

  it('a later ready never moves the arm floor', () => {
    const { ring, consumer } = rig();
    consumer.handle(ready(5_000));
    consumer.handle(started('a', 6_000));
    // Reconnect: the fresh ready reports a higher watermark (the tab
    // kept ingesting) — the floor must stay at arm time regardless.
    consumer.handle(ready(9_000));
    consumer.handle(started('b', 7_000));
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['a', 'b']);
    expect(consumer.stats().readyEpochs).toBe(2);
  });

  it('drops defensively when a started frame precedes any ready', () => {
    const { ring, consumer } = rig();
    consumer.handle(started('orphan', 1_000));
    expect(ring.snapshot()).toEqual([]);
    expect(consumer.stats().droppedPreArm).toBe(1);
  });
});

describe('TrafficRetentionConsumer — ready-epoch replay dedup', () => {
  it('a full replay after a reconnect refreshes in place and never double-counts', () => {
    const { ring, consumer } = rig();
    consumer.handle(ready(0));
    consumer.handle(started('a', 1_000));
    consumer.handle(started('b', 2_000));
    // Wire flap: fresh ready + FULL replay from the shared floor, replay
    // frames indistinguishable from live (S0 finding 4) — plus one
    // request the wire was down for.
    consumer.handle(ready(0));
    consumer.handle(started('a', 1_000));
    consumer.handle(started('b', 2_000));
    consumer.handle(started('c', 3_000));
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['a', 'b', 'c']);
    expect(ring.counters().recordCount).toBe(3);
  });

  it('a replay never resurrects an identity the ring evicted', () => {
    const { ring, consumer } = rig({ maxRecords: 1, maxBytes: BIG });
    consumer.handle(ready(0));
    consumer.handle(started('a', 1_000));
    consumer.handle(started('b', 2_000));
    expect(ring.has(1, 'a')).toBe(false);
    consumer.handle(ready(0));
    consumer.handle(started('a', 1_000));
    consumer.handle(started('b', 2_000));
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['b']);
    expect(consumer.stats().droppedEvictedReplay).toBe(1);
  });
});

describe('TrafficRetentionConsumer — refinement folding', () => {
  it('folds phase patches and HAR size facts into the retained record', () => {
    const { ring, consumer } = rig();
    consumer.handle(ready(0));
    consumer.handle(started('a', 1_000));
    consumer.handle({
      kind: 'lifecycle-update',
      update: {
        kind: 'phase',
        tabId: 1,
        requestId: 'a',
        patch: { phase: 'completed', statusCode: 200, statusText: 'OK', completedAtMs: 1_400 },
      },
    });
    consumer.handle({
      kind: 'lifecycle-update',
      update: { kind: 'har-attached', tabId: 1, requestId: 'a', hopIndex: 0, har: makeHarEntry({ size: 256 }) },
    });
    const [projection] = ring.snapshot();
    expect(projection?.phase).toBe('completed');
    expect(projection?.statusCode).toBe(200);
    expect(projection?.completedAtMs).toBe(1_400);
    expect(projection?.bodyBytes).toBe(256);
  });

  it('ignores body payloads wholesale — no body byte ever reaches the ring', () => {
    const { ring, consumer } = rig();
    consumer.handle(ready(0));
    consumer.handle(started('a', 1_000));
    consumer.handle({
      kind: 'lifecycle-update',
      update: {
        kind: 'body-attached',
        tabId: 1,
        requestId: 'a',
        hopIndex: 0,
        body: {
          method: 'GET',
          url: 'https://openheaders.io/probe',
          startedDateTime: new Date(1_000).toISOString(),
          content: 'OH-SECRET-BODY-MUST-NOT-BE-RETAINED',
          encoding: '',
        },
      },
    });
    expect(JSON.stringify(ring.snapshot())).not.toContain('OH-SECRET-BODY');
  });

  it('keeps retained records through tab-cleared and gone — retention is history', () => {
    const { ring, consumer } = rig();
    consumer.handle(ready(0));
    consumer.handle(started('a', 1_000));
    consumer.handle({ kind: 'lifecycle-update', update: { kind: 'gone', tabId: 1, requestId: 'a' } });
    consumer.handle({ kind: 'tab-cleared', tabId: 1 });
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['a']);
  });
});

describe('TrafficRetentionConsumer — provenance + consent', () => {
  it('stamps the initial provenance and follows source flips for later mints', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 100, maxBytes: BIG });
    const consumer = new TrafficRetentionConsumer({ ring, initialProvenance: 'proxy' });
    consumer.handle(ready(0));
    consumer.handle(started('early', 1_000));
    consumer.handle({ kind: 'source', tabId: 1, source: 'cdp' });
    consumer.handle(started('late', 2_000));
    expect(ring.snapshot().map((r) => r.provenance)).toEqual(['proxy', 'cdp']);
  });

  it('surfaces watch-refused through the callback', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 100, maxBytes: BIG });
    let refused = 0;
    const consumer = new TrafficRetentionConsumer({ ring, onWatchRefused: () => refused++ });
    consumer.handle({ kind: 'watch-refused', tabId: 1, reason: 'consent-off' });
    expect(refused).toBe(1);
  });
});

describe('TrafficRetentionConsumer — per-source isolation', () => {
  it('two consumers over two rings never cross', () => {
    const a = rig();
    const b = rig();
    a.consumer.handle(ready(0));
    b.consumer.handle(ready(0));
    a.consumer.handle(started('only-a', 1_000));
    expect(a.ring.counters().recordCount).toBe(1);
    expect(b.ring.counters().recordCount).toBe(0);
  });
});
