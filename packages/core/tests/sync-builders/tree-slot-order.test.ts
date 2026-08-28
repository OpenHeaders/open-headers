/**
 * Coverage for the slot-order planner
 * (`sync-builders/mutations/tree-slot-order.ts`).
 *
 * The load-bearing properties: the members outside the longest
 * increasing run are the ONLY ones re-keyed; every assigned key sits
 * strictly between its desired neighbours; members without a live
 * slot get their key through `keyFor` instead of a move.
 */

import { describe, expect, it } from 'vitest';
import type { LiveSetEntry } from '../../src/sync-builders';
import { planSlotOrder } from '../../src/sync-builders/mutations/tree-slot-order';

const PARENT = { type: 'collection', uid: 'col00001' };
const SET = 'items';

function liveOf(entries: Array<[string, string]>): (type: string, id: string, setPath: string) => LiveSetEntry[] {
  return (type, id, setPath) =>
    type === PARENT.type && id === PARENT.uid && setPath === SET
      ? entries.map(([itemId, orderKey]) => ({ itemId, orderKey, item: { uid: itemId } }))
      : [];
}

function orderAfter(entries: Array<[string, string]>, plan: ReturnType<typeof planSlotOrder>): string[] {
  const keys = new Map(entries);
  for (const reorder of plan.reorders) {
    for (const body of reorder.bodies) {
      if (body.kind === 'moveBefore') keys.set(body.itemId, body.orderKey);
    }
  }
  return [...keys.entries()].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map(([uid]) => uid);
}

describe('planSlotOrder', () => {
  const live: Array<[string, string]> = [
    ['a', 'm'],
    ['b', 'mm'],
    ['c', 'mmm'],
    ['d', 'mmmm'],
  ];

  it('an unchanged order plans nothing', () => {
    const plan = planSlotOrder([{ parent: PARENT, setPath: SET, desired: ['a', 'b', 'c', 'd'] }], liveOf(live));
    expect(plan.reorders).toEqual([]);
  });

  it('re-keys only the members outside the longest increasing run', () => {
    const plan = planSlotOrder([{ parent: PARENT, setPath: SET, desired: ['d', 'a', 'b', 'c'] }], liveOf(live));
    expect(plan.reorders).toHaveLength(1);
    expect(plan.reorders[0].bodies.map((body) => (body.kind === 'moveBefore' ? body.itemId : body.kind))).toEqual([
      'd',
    ]);
    expect(orderAfter(live, plan)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('a full reversal keeps one member and moves the rest, all strictly between neighbours', () => {
    const plan = planSlotOrder([{ parent: PARENT, setPath: SET, desired: ['d', 'c', 'b', 'a'] }], liveOf(live));
    expect(plan.reorders[0].bodies).toHaveLength(3);
    expect(orderAfter(live, plan)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('members without a live slot are keyed through keyFor, between their neighbours', () => {
    const plan = planSlotOrder(
      [{ parent: PARENT, setPath: SET, desired: ['a', 'x', 'b', 'c', 'd', 'y'] }],
      liveOf(live),
    );
    expect(plan.reorders).toEqual([]);
    const x = plan.keyFor(PARENT, SET, 'x');
    const y = plan.keyFor(PARENT, SET, 'y');
    expect(x !== null && x > 'm' && x < 'mm').toBe(true);
    expect(y !== null && y > 'mmmm').toBe(true);
  });

  it('an empty live set seeds ascending keys in desired order', () => {
    const plan = planSlotOrder([{ parent: PARENT, setPath: SET, desired: ['b', 'a', 'c'] }], liveOf([]));
    const keys = ['b', 'a', 'c'].flatMap((uid) => plan.keyFor(PARENT, SET, uid) ?? []);
    expect(keys).toHaveLength(3);
    expect(keys[0] < keys[1] && keys[1] < keys[2]).toBe(true);
  });

  it('equal live keys are healed into a strict order', () => {
    const tied: Array<[string, string]> = [
      ['a', 'm'],
      ['b', 'm'],
    ];
    const plan = planSlotOrder([{ parent: PARENT, setPath: SET, desired: ['a', 'b'] }], liveOf(tied));
    expect(plan.reorders[0].bodies).toHaveLength(1);
    expect(orderAfter(tied, plan)).toEqual(['a', 'b']);
  });

  it('a live member absent from the desired sequence is left alone', () => {
    const plan = planSlotOrder([{ parent: PARENT, setPath: SET, desired: ['b', 'a'] }], liveOf(live));
    const moved = plan.reorders[0].bodies.map((body) => (body.kind === 'moveBefore' ? body.itemId : body.kind));
    expect(moved).toEqual(['b']);
  });

  it('keyFor is null for a set the plan does not cover', () => {
    const plan = planSlotOrder([{ parent: PARENT, setPath: SET, desired: ['a'] }], liveOf(live));
    expect(plan.keyFor(PARENT, 'folders', 'a')).toBeNull();
    expect(plan.keyFor({ type: 'folder', uid: 'fol00001' }, SET, 'a')).toBeNull();
  });
});
