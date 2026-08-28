/**
 * Coverage for the slot-order planner
 * (`sync-builders/mutations/tree-slot-order.ts`).
 *
 * The load-bearing properties: the members outside the longest
 * increasing run are the ONLY ones re-keyed; every assigned key sits
 * strictly between its desired neighbours; members without a live
 * slot get their key through `keyFor` instead of a move. The two
 * child sets of a parent converge as ONE merged sequence.
 */

import { describe, expect, it } from 'vitest';
import type { LiveSetEntry } from '../../src/sync-builders';
import { planSlotOrder, type SlotOrderMember } from '../../src/sync-builders/mutations/tree-slot-order';

const PARENT = { type: 'collection', uid: 'col00001' };
const SET = 'items';
const FOLDERS = 'folders';

const items = (...uids: string[]): SlotOrderMember[] => uids.map((uid) => ({ uid, setPath: SET }));

function liveOf(
  entries: Array<[string, string]>,
  folders: Array<[string, string]> = [],
): (type: string, id: string, setPath: string) => LiveSetEntry[] {
  const rows = (list: Array<[string, string]>): LiveSetEntry[] =>
    list.map(([itemId, orderKey]) => ({ itemId, orderKey, item: { uid: itemId } }));
  return (type, id, setPath) => {
    if (type !== PARENT.type || id !== PARENT.uid) return [];
    if (setPath === SET) return rows(entries);
    if (setPath === FOLDERS) return rows(folders);
    return [];
  };
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
    const plan = planSlotOrder([{ parent: PARENT, members: items('a', 'b', 'c', 'd') }], liveOf(live));
    expect(plan.reorders).toEqual([]);
  });

  it('re-keys only the members outside the longest increasing run', () => {
    const plan = planSlotOrder([{ parent: PARENT, members: items('d', 'a', 'b', 'c') }], liveOf(live));
    expect(plan.reorders).toHaveLength(1);
    expect(plan.reorders[0].bodies.map((body) => (body.kind === 'moveBefore' ? body.itemId : body.kind))).toEqual([
      'd',
    ]);
    expect(orderAfter(live, plan)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('a full reversal keeps one member and moves the rest, all strictly between neighbours', () => {
    const plan = planSlotOrder([{ parent: PARENT, members: items('d', 'c', 'b', 'a') }], liveOf(live));
    expect(plan.reorders[0].bodies).toHaveLength(3);
    expect(orderAfter(live, plan)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('members without a live slot are keyed through keyFor, between their neighbours', () => {
    const plan = planSlotOrder([{ parent: PARENT, members: items('a', 'x', 'b', 'c', 'd', 'y') }], liveOf(live));
    expect(plan.reorders).toEqual([]);
    const x = plan.keyFor(PARENT, SET, 'x');
    const y = plan.keyFor(PARENT, SET, 'y');
    expect(x !== null && x > 'm' && x < 'mm').toBe(true);
    expect(y !== null && y > 'mmmm').toBe(true);
  });

  it('an empty live set seeds ascending keys in desired order', () => {
    const plan = planSlotOrder([{ parent: PARENT, members: items('b', 'a', 'c') }], liveOf([]));
    const keys = ['b', 'a', 'c'].flatMap((uid) => plan.keyFor(PARENT, SET, uid) ?? []);
    expect(keys).toHaveLength(3);
    expect(keys[0] < keys[1] && keys[1] < keys[2]).toBe(true);
  });

  it('equal live keys are healed into a strict order', () => {
    const tied: Array<[string, string]> = [
      ['a', 'm'],
      ['b', 'm'],
    ];
    const plan = planSlotOrder([{ parent: PARENT, members: items('a', 'b') }], liveOf(tied));
    expect(plan.reorders[0].bodies).toHaveLength(1);
    expect(orderAfter(tied, plan)).toEqual(['a', 'b']);
  });

  it('a live member absent from the desired sequence is left alone', () => {
    const plan = planSlotOrder([{ parent: PARENT, members: items('b', 'a') }], liveOf(live));
    const moved = plan.reorders[0].bodies.map((body) => (body.kind === 'moveBefore' ? body.itemId : body.kind));
    expect(moved).toEqual(['b']);
  });

  it("plans both sets of a parent as one merged sequence, re-keying on each member's own set", () => {
    // Legacy shape: both runs seeded at 'm' — folders f1,f2 and items a,b interleave by key.
    const folders: Array<[string, string]> = [
      ['f1', 'm'],
      ['f2', 's'],
    ];
    const tied: Array<[string, string]> = [
      ['a', 'm'],
      ['b', 's'],
    ];
    const members: SlotOrderMember[] = [
      { uid: 'f1', setPath: FOLDERS },
      { uid: 'f2', setPath: FOLDERS },
      { uid: 'a', setPath: SET },
      { uid: 'b', setPath: SET },
    ];
    const plan = planSlotOrder([{ parent: PARENT, members }], liveOf(tied, folders));
    expect(plan.reorders).toHaveLength(1);
    const bodies = plan.reorders[0].bodies.flatMap((body) =>
      body.kind === 'moveBefore' ? [{ itemId: body.itemId, path: body.path }] : [],
    );
    expect(bodies).toEqual([
      { itemId: 'a', path: SET },
      { itemId: 'b', path: SET },
    ]);
    const keys = new Map<string, string>([...folders, ...tied]);
    for (const body of plan.reorders[0].bodies) if (body.kind === 'moveBefore') keys.set(body.itemId, body.orderKey);
    const merged = [...keys.entries()].sort((x, y) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0)).map(([uid]) => uid);
    expect(merged).toEqual(['f1', 'f2', 'a', 'b']);
  });

  it('a mixed sequence keys a slot-less item between two live folders', () => {
    const folders: Array<[string, string]> = [
      ['f1', 'm'],
      ['f2', 's'],
    ];
    const members: SlotOrderMember[] = [
      { uid: 'f1', setPath: FOLDERS },
      { uid: 'a', setPath: SET },
      { uid: 'f2', setPath: FOLDERS },
    ];
    const plan = planSlotOrder([{ parent: PARENT, members }], liveOf([], folders));
    expect(plan.reorders).toEqual([]);
    const a = plan.keyFor(PARENT, SET, 'a');
    expect(a !== null && a > 'm' && a < 's').toBe(true);
  });

  it('keyFor is null for a set the plan does not cover', () => {
    const plan = planSlotOrder([{ parent: PARENT, members: items('a') }], liveOf(live));
    expect(plan.keyFor(PARENT, 'folders', 'a')).toBeNull();
    expect(plan.keyFor({ type: 'folder', uid: 'fol00001' }, SET, 'a')).toBeNull();
  });
});
