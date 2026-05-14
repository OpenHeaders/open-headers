/**
 * Phase B Request — `buildUpdateBatch` minimum-diff synthesizer
 * coverage. Set-modeled paths (`headers`, `params`) collapse to the
 * smallest envelope sequence via {@link synthesizeSetDiff}:
 *   - vanished uids → `removeFromSet`
 *   - new uids → `addToSet(uid, item, orderKey)`
 *   - content-changed uids → `addToSet(uid, item, orderKey)` (LWW; no removeFromSet)
 *   - position-only-changed → `moveBefore(uid, orderKey)`
 *   - unchanged → emit nothing
 */

import {
  type AddToSetMutation,
  type MoveBeforeMutation,
  type MutationBody,
  REQUEST_HEADERS_PATH,
  type RemoveFromSetMutation,
  type MutatorContext,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { buildUpdateBatch, type LiveSetEntries } from '@openheaders/core/sync-builders/request-mutations';

const ctx: MutatorContext = {
  workspaceId: 'ws-1',
  hlc: { physicalMs: 100, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
};

const liveOf =
  (entries: ReadonlyArray<{ itemId: string; orderKey: string; item: unknown }>): LiveSetEntries =>
  () =>
    entries;

const header = (uid: string, key: string, value: string) => ({ uid, key, value, enabled: true });

const onlyAdds = (bodies: ReadonlyArray<MutationBody>) =>
  bodies.filter((b): b is AddToSetMutation => b.kind === 'addToSet');

const onlyMoves = (bodies: ReadonlyArray<MutationBody>) =>
  bodies.filter((b): b is MoveBeforeMutation => b.kind === 'moveBefore');

const onlyRemoves = (bodies: ReadonlyArray<MutationBody>) =>
  bodies.filter((b): b is RemoveFromSetMutation => b.kind === 'removeFromSet');

describe('buildUpdateBatch — request set replacement', () => {
  it('emits moveBefore for a pure reorder (same uids, same content, swapped positions)', () => {
    const live = [
      { itemId: 'h1', orderKey: 'h', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'm', item: header('h2', 'X-B', 'b') },
      { itemId: 'h3', orderKey: 't', item: header('h3', 'X-C', 'c') },
    ];
    const updates = {
      headers: [header('h2', 'X-B', 'b'), header('h1', 'X-A', 'a'), header('h3', 'X-C', 'c')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const bodies = batch.mutations.map((m) => m.body);
    expect(bodies.length).toBeGreaterThan(0);
    expect(onlyMoves(bodies).length).toBe(bodies.length);
    expect(onlyRemoves(bodies)).toHaveLength(0);
    expect(onlyAdds(bodies)).toHaveLength(0);
    expectFinalOrderMatches(live, bodies, ['h2', 'h1', 'h3']);
  });

  it('emits zero envelopes when content + order are byte-identical', () => {
    const live = [
      { itemId: 'h1', orderKey: 'h', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'm', item: header('h2', 'X-B', 'b') },
    ];
    const updates = {
      headers: [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    expect(batch.mutations).toHaveLength(0);
  });

  it('emits exactly addToSet (no removeFromSet) for a content edit on an existing uid', () => {
    const live = [
      { itemId: 'h1', orderKey: 'h', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'm', item: header('h2', 'X-B', 'b') },
    ];
    const updates = {
      headers: [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'EDITED')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const bodies = batch.mutations.map((m) => m.body);
    // Only the changed row emits an addToSet; the unchanged row emits nothing.
    expect(bodies).toHaveLength(1);
    expect(onlyRemoves(bodies)).toHaveLength(0);
    const adds = onlyAdds(bodies);
    expect(adds).toHaveLength(1);
    expect(adds[0].itemId).toBe('h2');
    expect(adds[0].orderKey).toBe('m'); // position preserved
    expect((adds[0].item as { value: string }).value).toBe('EDITED');
  });

  it('emits removeFromSet only for vanished uids and addToSet only for new uids', () => {
    const live = [
      { itemId: 'h1', orderKey: 'h', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'm', item: header('h2', 'X-B', 'b') },
    ];
    const updates = {
      // h2 vanishes; h3 is new; h1 stays unchanged.
      headers: [header('h1', 'X-A', 'a'), header('h3', 'X-C', 'c')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const bodies = batch.mutations.map((m) => m.body);
    const removes = onlyRemoves(bodies);
    const adds = onlyAdds(bodies);
    expect(removes.map((r) => r.itemId)).toEqual(['h2']);
    expect(adds.map((a) => a.itemId)).toEqual(['h3']);
    // The new row carries an explicit orderKey computed via keyBetween.
    expect(typeof adds[0].orderKey).toBe('string');
    expect(adds[0].orderKey!.length).toBeGreaterThan(0);
  });

  it('handles mixed gestures (reorder + content edit) without redundant removeFromSet', () => {
    const live = [
      { itemId: 'h1', orderKey: 'h', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'm', item: header('h2', 'X-B', 'b') },
      { itemId: 'h3', orderKey: 't', item: header('h3', 'X-C', 'c') },
    ];
    const updates = {
      // h3 moves to front, h2 content edit, h1 unchanged.
      headers: [header('h3', 'X-C', 'c'), header('h2', 'X-B', 'EDITED'), header('h1', 'X-A', 'a')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const bodies = batch.mutations.map((m) => m.body);
    // Architectural invariant 1: no tombstones — content change rides
    // per-itemId LWW, so the explicit removeFromSet is redundant.
    expect(onlyRemoves(bodies)).toHaveLength(0);
    // Architectural invariant 2: h2's content edit lands as addToSet
    // (the only envelope that carries the new item value).
    const adds = onlyAdds(bodies);
    const h2Add = adds.find((a) => a.itemId === 'h2');
    expect(h2Add).toBeDefined();
    expect((h2Add!.item as { value: string }).value).toBe('EDITED');
    // Architectural invariant 3: every emitted addToSet carries an
    // explicit orderKey so the engine doesn't seedKey() the position.
    for (const add of adds) expect(typeof add.orderKey).toBe('string');
    // Architectural invariant 4: convergence — the resulting wire diff
    // produces the requested order under the (orderKey, itemId) sort.
    expectFinalOrderMatches(live, bodies, ['h3', 'h2', 'h1']);
  });

  it('addToSet always carries an explicit orderKey', () => {
    const live = [{ itemId: 'h1', orderKey: 'h', item: header('h1', 'X-A', 'a') }];
    const updates = {
      headers: [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    for (const add of onlyAdds(batch.mutations.map((m) => m.body))) {
      expect(add.orderKey).toBeDefined();
      expect(typeof add.orderKey).toBe('string');
    }
  });

  it('emits exactly one moveBefore for drag-to-front of a 3-row list (LIS-optimal)', () => {
    // Live keys h < m < t; new order [h3, h1, h2] preserves the relative
    // order of h1, h2 (LIS = {h1, h2}). Only h3 needs to move; the
    // engine should emit exactly 1 moveBefore, not 2.
    const live = [
      { itemId: 'h1', orderKey: 'h', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'm', item: header('h2', 'X-B', 'b') },
      { itemId: 'h3', orderKey: 't', item: header('h3', 'X-C', 'c') },
    ];
    const updates = {
      headers: [header('h3', 'X-C', 'c'), header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const bodies = batch.mutations.map((m) => m.body);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].kind).toBe('moveBefore');
    expect((bodies[0] as MoveBeforeMutation).itemId).toBe('h3');
    expect(onlyRemoves(bodies)).toHaveLength(0);
    expect(onlyAdds(bodies)).toHaveLength(0);
    expectFinalOrderMatches(live, bodies, ['h3', 'h1', 'h2']);
  });

  it('emits exactly one moveBefore for drag-to-end of a long list (LIS-optimal)', () => {
    // 5 rows; drag h1 (head) to the tail. LIS = {h2, h3, h4, h5}; only
    // h1 needs to move.
    const live = [
      { itemId: 'h1', orderKey: 'h', item: header('h1', 'X-1', '1') },
      { itemId: 'h2', orderKey: 'j', item: header('h2', 'X-2', '2') },
      { itemId: 'h3', orderKey: 'm', item: header('h3', 'X-3', '3') },
      { itemId: 'h4', orderKey: 'p', item: header('h4', 'X-4', '4') },
      { itemId: 'h5', orderKey: 't', item: header('h5', 'X-5', '5') },
    ];
    const updates = {
      headers: [
        header('h2', 'X-2', '2'),
        header('h3', 'X-3', '3'),
        header('h4', 'X-4', '4'),
        header('h5', 'X-5', '5'),
        header('h1', 'X-1', '1'),
      ],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const bodies = batch.mutations.map((m) => m.body);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].kind).toBe('moveBefore');
    expect((bodies[0] as MoveBeforeMutation).itemId).toBe('h1');
    expectFinalOrderMatches(live, bodies, ['h2', 'h3', 'h4', 'h5', 'h1']);
  });
});

function expectFinalOrderMatches(
  live: ReadonlyArray<{ itemId: string; orderKey: string }>,
  bodies: ReadonlyArray<MutationBody>,
  expected: ReadonlyArray<string>,
): void {
  // Apply moveBefore + addToSet envelopes against a fresh copy of live's
  // keys, then sort by (orderKey, itemId) — the canonical order the
  // document store uses (§materialization). Asserts the engine would land
  // at `expected` after replay.
  const finalKey = new Map<string, string>();
  for (const e of live) finalKey.set(e.itemId, e.orderKey);
  for (const body of bodies) {
    if (body.kind === 'moveBefore') finalKey.set(body.itemId, body.orderKey);
    else if (body.kind === 'addToSet' && body.orderKey) finalKey.set(body.itemId, body.orderKey);
    else if (body.kind === 'removeFromSet') finalKey.delete(body.itemId);
  }
  const ordered = Array.from(finalKey.entries())
    .sort(([aId, aKey], [bId, bKey]) => (aKey === bKey ? (aId < bId ? -1 : 1) : aKey < bKey ? -1 : 1))
    .map(([id]) => id);
  expect(ordered).toEqual(expected);
}
