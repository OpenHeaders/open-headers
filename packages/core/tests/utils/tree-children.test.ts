/**
 * Ordered children — the merged slot run in slot order, slot-less
 * children after it by stored path (folders, then leaves), never a
 * slot required on read.
 */

import { describe, expect, it } from 'vitest';
import { mergedTailKey, mergeOrderedEntries } from '../../src/sync/order/tree-child-order';
import { indexTreeChildren, orderedBySlots, orderedChildren } from '../../src/utils/tree-children';

interface Node {
  uid: string;
  path: string;
}

const node = (uid: string, path: string): Node => ({ uid, path });

const folders = [
  node('fol00001', 'rules/col00001/a-fol00001'),
  node('fol00002', 'rules/col00001/b-fol00002'),
  node('fol00003', 'rules/col00001/a-fol00001/c-fol00003'),
];
const leaves = [
  node('rul00001', 'rules/col00001/one-rul00001'),
  node('rul00002', 'rules/col00001/two-rul00002'),
  node('rul00003', 'rules/col00001/a-fol00001/three-rul00003'),
  node('rul00004', 'rules/col00001/four-rul00004'),
];
const index = indexTreeChildren(
  folders,
  leaves,
  (f) => f.path,
  (l) => l.path,
);

const uids = (out: ReturnType<typeof orderedChildren<Node, Node>>): string[] =>
  out.map((child) => `${child.kind === 'folder' ? 'F' : 'L'}:${child.entity.uid}`);

describe('orderedChildren', () => {
  it('reads by stored path when the reader has no slots — folders then leaves', () => {
    expect(uids(orderedChildren(index, 'rules/col00001', null))).toEqual([
      'F:fol00001',
      'F:fol00002',
      'L:rul00001',
      'L:rul00002',
      'L:rul00004',
    ]);
  });

  it('follows the merged slot order, kinds interleaved, and appends slot-less children by path', () => {
    const out = orderedChildren(index, 'rules/col00001', ['rul00004', 'fol00002', 'rul00001', 'fol00001']);
    expect(uids(out)).toEqual(['L:rul00004', 'F:fol00002', 'L:rul00001', 'F:fol00001', 'L:rul00002']);
  });

  it('skips slots whose child is unknown and never emits a child twice', () => {
    const out = orderedChildren(index, 'rules/col00001', ['fol0dead', 'fol00001', 'fol00001', 'rul00002', 'rul00002']);
    expect(uids(out)).toEqual(['F:fol00001', 'L:rul00002', 'F:fol00002', 'L:rul00001', 'L:rul00004']);
  });

  it('answers nested containers from the same index', () => {
    const out = orderedChildren(index, 'rules/col00001/a-fol00001', ['rul00003']);
    expect(uids(out)).toEqual(['L:rul00003', 'F:fol00003']);
  });

  // A cross-parent move lands as separate events; between them the
  // child holds a slot under both containers, or its path has moved
  // ahead of the old slot's removal. The path names the ONE container
  // that renders it — a slot orders, it does not claim.
  it('a slot claims a child only when its path names the container — the new slot before the path lands', () => {
    const root = orderedChildren(index, 'rules/col00001', ['fol00001', 'rul00003', 'rul00001']);
    const folder = orderedChildren(index, 'rules/col00001/a-fol00001', ['rul00003']);
    expect(uids(root)).toEqual(['F:fol00001', 'L:rul00001', 'F:fol00002', 'L:rul00002', 'L:rul00004']);
    expect(uids(folder)).toEqual(['L:rul00003', 'F:fol00003']);
  });

  it('a slot claims a child only when its path names the container — the path before the old slot leaves', () => {
    const moved = indexTreeChildren(
      folders,
      leaves.map((leaf) => (leaf.uid === 'rul00003' ? node(leaf.uid, 'rules/col00001/three-rul00003') : leaf)),
      (f) => f.path,
      (l) => l.path,
    );
    const root = orderedChildren(moved, 'rules/col00001', ['fol00001', 'rul00001']);
    const folder = orderedChildren(moved, 'rules/col00001/a-fol00001', ['rul00003']);
    expect(uids(root)).toEqual(['F:fol00001', 'L:rul00001', 'F:fol00002', 'L:rul00002', 'L:rul00003', 'L:rul00004']);
    expect(uids(folder)).toEqual(['F:fol00003']);
  });

  it('a folder in two live slots renders under the container its path names', () => {
    const root = orderedChildren(index, 'rules/col00001', ['fol00003', 'fol00001']);
    const folder = orderedChildren(index, 'rules/col00001/a-fol00001', ['fol00003', 'rul00003']);
    expect(uids(root)).toEqual(['F:fol00001', 'F:fol00002', 'L:rul00001', 'L:rul00002', 'L:rul00004']);
    expect(uids(folder)).toEqual(['F:fol00003', 'L:rul00003']);
  });
});

describe('orderedBySlots', () => {
  const examples = [node('exa00001', 'a'), node('exa00002', 'b'), node('exa00003', 'c')];

  it('follows the slot order and appends the slot-less rest in array order; unknown slots are skipped', () => {
    const out = orderedBySlots(examples, ['exa00003', 'dead0000', 'exa00001', 'exa00003']);
    expect(out.map((e) => e.uid)).toEqual(['exa00003', 'exa00001', 'exa00002']);
  });

  it('is array order without a slot source', () => {
    expect(orderedBySlots(examples, null).map((e) => e.uid)).toEqual(['exa00001', 'exa00002', 'exa00003']);
  });
});

describe('mergeOrderedEntries', () => {
  const entry = (itemId: string, key: string) => ({ itemId, key });
  const keyOf = (e: { key: string }) => e.key;
  const idOf = (e: { itemId: string }) => e.itemId;

  it('merges two key-sorted lists by (key, id)', () => {
    const folders = [entry('f1', 'm'), entry('f2', 'sm')];
    const items = [entry('a', 'p'), entry('b', 's'), entry('c', 'x')];
    expect(mergeOrderedEntries(folders, items, keyOf, idOf).map(idOf)).toEqual(['f1', 'a', 'b', 'f2', 'c']);
  });

  it('breaks an equal key by id across the two lists, the same rule as inside a set', () => {
    expect(mergeOrderedEntries([entry('zz', 'm')], [entry('aa', 'm')], keyOf, idOf).map(idOf)).toEqual(['aa', 'zz']);
  });

  it('handles an empty side', () => {
    expect(mergeOrderedEntries([], [entry('a', 'm')], keyOf, idOf).map(idOf)).toEqual(['a']);
    expect(mergeOrderedEntries([entry('a', 'm')], [], keyOf, idOf).map(idOf)).toEqual(['a']);
  });
});

describe('mergedTailKey', () => {
  it('is the greatest last key across the lists, null when all are empty', () => {
    expect(mergedTailKey([[{ orderKey: 'm' }, { orderKey: 's' }], [{ orderKey: 'p' }]])).toBe('s');
    expect(mergedTailKey([[], [{ orderKey: 'p' }]])).toBe('p');
    expect(mergedTailKey([[], []])).toBeNull();
  });
});
