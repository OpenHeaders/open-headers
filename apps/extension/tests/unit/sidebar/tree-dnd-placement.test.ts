/**
 * Unit tests for `computeDropPlacement` — the pure resolver that
 * turns (zone, activeNode, overNode, byId, live lookups) into the one
 * move call a drop makes: a folder, leaf or collection placement, or
 * null for a no-op / rejected drop.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  computeAppendOrderKey,
  computeSiblingInsertOrderKey,
  computeSiblingInsertSlot,
  isDescendantOf,
  mintKeysAfter,
} from '@openheaders/ui/workbench/components/sidebar/tree-dnd-helpers';
import type { TreeDndIdConfig, TreeDndParent } from '@openheaders/ui/workbench/components/sidebar/tree-dnd-ids';
import {
  computeDropPlacement,
  computeDropPlacements,
} from '@openheaders/ui/workbench/components/sidebar/tree-dnd-placement';
import type { TreeNode } from '@openheaders/ui/workbench/components/sidebar/types';
import { describe, expect, it } from 'vitest';

const CONFIG: TreeDndIdConfig = {
  collectionIdPrefix: 'col-',
  folderIdPrefix: 'folder-',
  leafKinds: [{ idPrefix: 'rule-', entityType: RULE_ENTITY_TYPE }],
};
const lookups = { lookupItems: () => [], lookupCollections: () => [] };

const leaf = (uid: string, parentId: string, prefix = 'rule-'): TreeNode => ({
  id: `${prefix}${uid}`,
  parentId,
  kind: 'leaf',
  label: uid,
  depth: 0,
  expandable: false,
  icon: null,
  canRename: true,
  canDelete: true,
  canAddChild: false,
});

const folder = (uid: string, parentId: string): TreeNode => ({
  id: `folder-${uid}`,
  parentId,
  kind: 'folder',
  label: uid,
  depth: 0,
  expandable: true,
  icon: null,
  canRename: true,
  canDelete: true,
  canAddChild: true,
});

const collection = (uid: string): TreeNode => ({
  id: `col-${uid}`,
  parentId: undefined,
  kind: 'group',
  label: uid,
  depth: 0,
  expandable: true,
  icon: null,
  canRename: false,
  canDelete: false,
  canAddChild: true,
});

function map(nodes: TreeNode[]): Map<string, TreeNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

const noSiblings = () => [];

describe('computeDropPlacement', () => {
  it("'into' on a collection reparents the dragged folder under it (append at tail)", () => {
    const c1 = collection('c1');
    const c2 = collection('c2');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, c2, dragged]);
    const lookupSiblings = (parent: TreeDndParent) =>
      parent.kind === 'collection' && parent.uid === 'c2' ? [{ itemId: 'tail', orderKey: 's' }] : [];

    const result = computeDropPlacement({
      zone: 'into',
      activeNode: dragged,
      overNode: c2,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings,
    });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ parent: { kind: 'collection', uid: 'c2' } });
    expect(result).toMatchObject({ oldParent: { kind: 'collection', uid: 'c1' } });
    expect(result!.orderKey > 's').toBe(true);
  });

  it("'into' on dragged folder's current parent is a no-op", () => {
    const c1 = collection('c1');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, dragged]);
    const result = computeDropPlacement({
      zone: 'into',
      activeNode: dragged,
      overNode: c1,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings: noSiblings,
    });
    expect(result).toBeNull();
  });

  it("'into' on a folder reparents the dragged folder under it", () => {
    const c1 = collection('c1');
    const target = folder('t', 'col-c1');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, target, dragged]);
    const result = computeDropPlacement({
      zone: 'into',
      activeNode: dragged,
      overNode: target,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings: () => [],
    });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ parent: { kind: 'folder', uid: 't' } });
    expect(result).toMatchObject({ oldParent: { kind: 'collection', uid: 'c1' } });
  });

  it("'before' on a foreign-parent folder cross-parent-inserts above it", () => {
    const c1 = collection('c1');
    const c2 = collection('c2');
    const overTarget = folder('t', 'col-c2');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, c2, overTarget, dragged]);
    const lookupSiblings = (parent: TreeDndParent) =>
      parent.kind === 'collection' && parent.uid === 'c2' ? [{ itemId: 't', orderKey: 'm' }] : [];

    const result = computeDropPlacement({
      zone: 'before',
      activeNode: dragged,
      overNode: overTarget,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings,
    });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ parent: { kind: 'collection', uid: 'c2' } });
    expect(result).toMatchObject({ oldParent: { kind: 'collection', uid: 'c1' } });
    // No prev, next='m' — key sits below 'm'.
    expect(result!.orderKey < 'm').toBe(true);
  });

  it("'after' on a foreign-parent folder cross-parent-inserts below it", () => {
    const c1 = collection('c1');
    const c2 = collection('c2');
    const overTarget = folder('t', 'col-c2');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, c2, overTarget, dragged]);
    const lookupSiblings = (parent: TreeDndParent) =>
      parent.kind === 'collection' && parent.uid === 'c2' ? [{ itemId: 't', orderKey: 'm' }] : [];

    const result = computeDropPlacement({
      zone: 'after',
      activeNode: dragged,
      overNode: overTarget,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings,
    });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ parent: { kind: 'collection', uid: 'c2' } });
    expect(result!.orderKey > 'm').toBe(true);
  });

  it("'before' on a same-parent sibling at an adjacent slot is a no-op", () => {
    const c1 = collection('c1');
    const a = folder('a', 'col-c1');
    const b = folder('b', 'col-c1');
    const byId = map([c1, a, b]);
    const lookupSiblings = () => [
      { itemId: 'a', orderKey: 'g' },
      { itemId: 'b', orderKey: 'm' },
    ];
    // 'a' is already directly before 'b'; placing 'a' BEFORE 'b' is a no-op.
    const result = computeDropPlacement({
      zone: 'before',
      activeNode: a,
      overNode: b,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings,
    });
    expect(result).toBeNull();
  });

  it("'after' on a same-parent sibling produces a fresh slot key", () => {
    const c1 = collection('c1');
    const a = folder('a', 'col-c1');
    const b = folder('b', 'col-c1');
    const c = folder('c', 'col-c1');
    const byId = map([c1, a, b, c]);
    const lookupSiblings = () => [
      { itemId: 'a', orderKey: 'g' },
      { itemId: 'b', orderKey: 'm' },
      { itemId: 'c', orderKey: 's' },
    ];
    // Move 'a' to AFTER 'c' — same parent, places at tail.
    const result = computeDropPlacement({
      zone: 'after',
      activeNode: a,
      overNode: c,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings,
    });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ parent: { kind: 'collection', uid: 'c1' } });
    expect(result).not.toHaveProperty('oldParent'); // same-parent reorder
    expect(result!.orderKey > 's').toBe(true);
  });

  it('rejects drops onto descendants (cycle guard)', () => {
    const c1 = collection('c1');
    const a = folder('a', 'col-c1');
    const b = folder('b', 'folder-a'); // a's child
    const byId = map([c1, a, b]);
    const result = computeDropPlacement({
      zone: 'into',
      activeNode: a,
      overNode: b,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings: () => [],
    });
    expect(result).toBeNull();
  });

  it('rejects foreign-tree rows (id prefix mismatch)', () => {
    const c1 = collection('c1');
    const dragged = folder('f', 'col-c1');
    // Foreign-tree folder row (different prefix).
    const foreign: TreeNode = {
      ...folder('x', 'col-c1'),
      id: 'tpl-folder-x',
    };
    const byId = map([c1, dragged, foreign]);
    const result = computeDropPlacement({
      zone: 'into',
      activeNode: dragged,
      overNode: foreign,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings: () => [],
    });
    expect(result).toBeNull();
  });

  it('rejects a sibling zone on a collection row for a folder (the surface coerces those to into)', () => {
    const c1 = collection('c1');
    const c2 = collection('c2');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, c2, dragged]);
    const result = computeDropPlacement({
      zone: 'before',
      activeNode: dragged,
      overNode: c2,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings: () => [],
    });
    expect(result).toBeNull();
  });

  it("folder over a leaf lands in that leaf's parent at the tail of the folder run", () => {
    const c1 = collection('c1');
    const c2 = collection('c2');
    const target = folder('t', 'col-c2');
    const over = leaf('r', 'folder-t');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, c2, target, over, dragged]);
    const lookupSiblings = (parent: TreeDndParent) =>
      parent.kind === 'folder' && parent.uid === 't' ? [{ itemId: 'x', orderKey: 'm' }] : [];
    const result = computeDropPlacement({
      zone: 'into',
      activeNode: dragged,
      overNode: over,
      byId,
      config: CONFIG,
      ...lookups,
      lookupSiblings,
    });
    expect(result).toMatchObject({
      kind: 'folder',
      folderUid: 'f',
      parent: { kind: 'folder', uid: 't' },
      oldParent: { kind: 'collection', uid: 'c1' },
    });
    expect(result!.orderKey > 'm').toBe(true);
  });

  it('folder over a leaf inside its own subtree is rejected (cycle guard)', () => {
    const c1 = collection('c1');
    const a = folder('a', 'col-c1');
    const b = folder('b', 'folder-a');
    const over = leaf('r', 'folder-b');
    const byId = map([c1, a, b, over]);
    expect(
      computeDropPlacement({
        zone: 'into',
        activeNode: a,
        overNode: over,
        byId,
        config: CONFIG,
        ...lookups,
        lookupSiblings: () => [],
      }),
    ).toBeNull();
  });
});

describe('computeDropPlacement — leaves', () => {
  const c1 = collection('c1');
  const c2 = collection('c2');
  const f = folder('f', 'col-c1');
  const items = (parent: TreeDndParent) =>
    parent.kind === 'collection' && parent.uid === 'c1'
      ? [
          { itemId: 'a', orderKey: 'g' },
          { itemId: 'b', orderKey: 'm' },
          { itemId: 'c', orderKey: 's' },
        ]
      : parent.kind === 'folder' && parent.uid === 'f'
        ? [{ itemId: 'x', orderKey: 'm' }]
        : [];
  const a = leaf('a', 'col-c1');
  const b = leaf('b', 'col-c1');
  const c = leaf('c', 'col-c1');
  const x = leaf('x', 'folder-f');
  const byId = map([c1, c2, f, a, b, c, x]);
  const place = (zone: 'before' | 'into' | 'after', activeNode: TreeNode, overNode: TreeNode) =>
    computeDropPlacement({
      zone,
      activeNode,
      overNode,
      byId,
      config: CONFIG,
      lookupSiblings: () => [],
      lookupItems: items,
      lookupCollections: () => [],
    });

  it('leaf over a sibling leaf reorders in the parent items set, keyed between the neighbours', () => {
    const result = place('after', a, c);
    expect(result).toMatchObject({
      kind: 'leaf',
      entityType: RULE_ENTITY_TYPE,
      uid: 'a',
      parent: { kind: 'collection', uid: 'c1' },
    });
    expect(result).not.toHaveProperty('oldParent');
    expect(result!.orderKey > 's').toBe(true);
    expect(place('before', a, b)).toBeNull();
    const between = place('before', c, b);
    expect(between!.orderKey > 'g' && between!.orderKey < 'm').toBe(true);
  });

  it('leaf over a leaf in another parent re-parents beside it', () => {
    const result = place('before', a, x);
    expect(result).toMatchObject({
      kind: 'leaf',
      uid: 'a',
      parent: { kind: 'folder', uid: 'f' },
      oldParent: { kind: 'collection', uid: 'c1' },
    });
    expect(result!.orderKey < 'm').toBe(true);
  });

  it('leaf into a folder or collection lands at the tail of its items run; into its own parent is a no-op', () => {
    const intoFolder = place('into', a, f);
    expect(intoFolder).toMatchObject({
      kind: 'leaf',
      parent: { kind: 'folder', uid: 'f' },
      oldParent: { kind: 'collection', uid: 'c1' },
    });
    expect(intoFolder!.orderKey > 'm').toBe(true);
    expect(place('into', a, c1)).toBeNull();
    const intoCollection = place('into', x, c2);
    expect(intoCollection).toMatchObject({ kind: 'leaf', uid: 'x', parent: { kind: 'collection', uid: 'c2' } });
  });

  it('a leaf never receives an into drop, a foreign leaf kind is no participant', () => {
    expect(place('into', a, b)).toBeNull();
    const example = leaf('e', 'rule-a', 'resp-example-');
    expect(place('after', example, b)).toBeNull();
    expect(place('after', a, example)).toBeNull();
  });
});

describe('computeDropPlacement — collections', () => {
  const c1 = collection('c1');
  const c2 = collection('c2');
  const c3 = collection('c3');
  const f = folder('f', 'col-c1');
  const byId = map([c1, c2, c3, f]);
  const roots = [
    { itemId: 'c1', orderKey: 'g' },
    { itemId: 'c2', orderKey: 'm' },
    { itemId: 'c3', orderKey: 's' },
  ];
  const place = (zone: 'before' | 'into' | 'after', activeNode: TreeNode, overNode: TreeNode) =>
    computeDropPlacement({
      zone,
      activeNode,
      overNode,
      byId,
      config: CONFIG,
      lookupSiblings: () => [],
      lookupItems: () => [],
      lookupCollections: () => roots,
    });

  it('collection over a collection reorders on the roots set', () => {
    const result = place('after', c1, c3);
    expect(result).toMatchObject({ kind: 'collection', uid: 'c1' });
    expect(result!.orderKey > 's').toBe(true);
    expect(place('before', c1, c2)).toBeNull();
  });

  it('collections never nest: into a collection, or onto a folder, is rejected', () => {
    expect(place('into', c1, c2)).toBeNull();
    expect(place('into', c1, f)).toBeNull();
    expect(place('after', c1, f)).toBeNull();
  });
});

describe('computeAppendOrderKey', () => {
  const run = [
    { itemId: 'a', orderKey: 'g' },
    { itemId: 'b', orderKey: 'm' },
  ];
  it('keys after the tail, seeds an empty run, and is a no-op for the tail itself', () => {
    expect(computeAppendOrderKey(run, 'z')! > 'm').toBe(true);
    expect(computeAppendOrderKey(run, 'a')! > 'm').toBe(true);
    expect(computeAppendOrderKey(run, 'b')).toBeNull();
    expect(computeAppendOrderKey([], 'z')).not.toBeNull();
  });
});

describe('computeSiblingInsertOrderKey', () => {
  const siblings = [
    { itemId: 'a', orderKey: 'g' },
    { itemId: 'b', orderKey: 'm' },
    { itemId: 'c', orderKey: 's' },
  ];

  it('inserts before head — key sits below first sibling', () => {
    const key = computeSiblingInsertOrderKey(siblings, 'foreign', 'a', 'before');
    expect(key).not.toBeNull();
    expect(key! < 'g').toBe(true);
  });

  it('inserts after tail — key sits above last sibling', () => {
    const key = computeSiblingInsertOrderKey(siblings, 'foreign', 'c', 'after');
    expect(key).not.toBeNull();
    expect(key! > 's').toBe(true);
  });

  it('inserts between two siblings (foreign source)', () => {
    const key = computeSiblingInsertOrderKey(siblings, 'foreign', 'b', 'before');
    expect(key).not.toBeNull();
    expect(key! > 'g' && key! < 'm').toBe(true);
  });

  it('returns null when same-parent already directly above target', () => {
    // 'a' (idx 0) is already directly before 'b' (idx 1); BEFORE 'b' is a no-op.
    expect(computeSiblingInsertOrderKey(siblings, 'a', 'b', 'before')).toBeNull();
  });

  it('returns null when same-parent already directly below target', () => {
    // 'c' (idx 2) is already directly after 'b' (idx 1); AFTER 'b' is a no-op.
    expect(computeSiblingInsertOrderKey(siblings, 'c', 'b', 'after')).toBeNull();
  });

  it('seeds when over uid is missing from siblings (mirror lag)', () => {
    const key = computeSiblingInsertOrderKey(siblings, 'foreign', 'unknown', 'before');
    expect(typeof key).toBe('string');
    expect(key!.length).toBeGreaterThan(0);
  });

  it('produces a movable key when same-parent slide spans more than one slot', () => {
    // Move 'a' to BEFORE 'c' — non-adjacent. Without 'a': [b='m', c='s'].
    // overIdxInWithout=1, insertIdx=1. prev='m', next='s' — strictly between.
    const key = computeSiblingInsertOrderKey(siblings, 'a', 'c', 'before');
    expect(key).not.toBeNull();
    expect(key! > 'm' && key! < 's').toBe(true);
  });
});

describe('isDescendantOf', () => {
  const folderNode = (id: string, parentId?: string): TreeNode => ({
    id,
    parentId,
    kind: 'folder',
    label: id,
    depth: 0,
    expandable: true,
    icon: null,
    canRename: true,
    canDelete: true,
    canAddChild: true,
  });

  it('detects a direct child', () => {
    const map = new Map<string, TreeNode>();
    for (const n of [folderNode('p'), folderNode('c', 'p')]) map.set(n.id, n);
    expect(isDescendantOf('p', map.get('c')!, map)).toBe(true);
  });

  it('detects a deep descendant', () => {
    const nodes = [folderNode('a'), folderNode('b', 'a'), folderNode('c', 'b'), folderNode('d', 'c')];
    const map = new Map(nodes.map((n) => [n.id, n]));
    expect(isDescendantOf('a', map.get('d')!, map)).toBe(true);
  });

  it('returns false for an unrelated subtree', () => {
    const nodes = [folderNode('a'), folderNode('b'), folderNode('c-b', 'b')];
    const map = new Map(nodes.map((n) => [n.id, n]));
    expect(isDescendantOf('a', map.get('c-b')!, map)).toBe(false);
  });

  it('treats a node as its own descendant (same-id is the trivial case)', () => {
    const map = new Map<string, TreeNode>();
    map.set('a', folderNode('a'));
    expect(isDescendantOf('a', map.get('a')!, map)).toBe(true);
  });

  it('terminates safely on a cycle in the parent chain', () => {
    const nodes = [folderNode('a', 'b'), folderNode('b', 'a')];
    const map = new Map(nodes.map((n) => [n.id, n]));
    expect(isDescendantOf('unrelated', map.get('a')!, map)).toBe(false);
  });
});

describe('key slots', () => {
  const run = [
    { itemId: 'a', orderKey: 'g' },
    { itemId: 'b', orderKey: 'm' },
    { itemId: 'c', orderKey: 's' },
  ];
  it('a sibling slot carries the next live key and mints followers strictly inside the gap, ascending', () => {
    const slot = computeSiblingInsertSlot(run, 'z', 'a', 'after')!;
    expect(slot.nextKey).toBe('m');
    const keys = mintKeysAfter(slot, 3);
    const all = [slot.orderKey, ...keys];
    expect(all.every((k, i) => i === 0 || all[i - 1] < k)).toBe(true);
    expect(all.every((k) => k > 'g' && k < 'm')).toBe(true);
    expect(computeSiblingInsertSlot(run, 'z', 'c', 'after')!.nextKey).toBeNull();
    expect(mintKeysAfter({ orderKey: 's', nextKey: null }, 0)).toEqual([]);
  });
});

describe('computeDropPlacements — multi-item', () => {
  const c1 = collection('c1');
  const c2 = collection('c2');
  const f = folder('f', 'col-c1');
  const g = folder('g', 'col-c2');
  const a = leaf('a', 'col-c1');
  const b = leaf('b', 'col-c1');
  const c = leaf('c', 'col-c1');
  const inF = leaf('x', 'folder-f');
  const y = leaf('y', 'col-c2');
  const nodes = [c1, f, inF, a, b, c, c2, g, y];
  const byId = map(nodes);
  const items = (parent: TreeDndParent) =>
    parent.kind === 'collection' && parent.uid === 'c1'
      ? [
          { itemId: 'a', orderKey: 'g' },
          { itemId: 'b', orderKey: 'm' },
          { itemId: 'c', orderKey: 's' },
        ]
      : parent.kind === 'collection' && parent.uid === 'c2'
        ? [{ itemId: 'y', orderKey: 'm' }]
        : [];
  const siblings = (parent: TreeDndParent) =>
    parent.kind === 'collection' && parent.uid === 'c2' ? [{ itemId: 'g', orderKey: 'm' }] : [];
  const place = (zone: 'before' | 'into' | 'after', activeNodes: TreeNode[], overNode: TreeNode) =>
    computeDropPlacements({
      zone,
      activeNodes,
      overNode,
      byId,
      config: CONFIG,
      lookupSiblings: siblings,
      lookupItems: items,
      lookupCollections: () => [],
    });

  it('moves the group together, in its visible order, keyed between the anchor and the next sibling', () => {
    const result = place('before', [a, c], y);
    expect(result.map((p) => (p.kind === 'leaf' ? p.uid : null))).toEqual(['a', 'c']);
    expect(result.every((p) => p.kind === 'leaf' && p.parent.uid === 'c2' && p.oldParent?.uid === 'c1')).toBe(true);
    expect(result[0].orderKey < result[1].orderKey && result[1].orderKey < 'm').toBe(true);
  });

  it('splits roles into their own runs: folders land in the folder run, leaves in the items run', () => {
    const result = place('into', [f, a], c2);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ kind: 'folder', folderUid: 'f', parent: { kind: 'collection', uid: 'c2' } });
    expect(result[0].orderKey > 'm').toBe(true);
    expect(result[1]).toMatchObject({ kind: 'leaf', uid: 'a', parent: { kind: 'collection', uid: 'c2' } });
    expect(result[1].orderKey > 'm').toBe(true);
  });

  it('a child of a moving folder travels with it, and a drop onto a moving row is rejected', () => {
    expect(place('into', [f, inF], c2).map((p) => p.kind)).toEqual(['folder']);
    expect(place('after', [a, b], b)).toEqual([]);
    expect(place('into', [f, inF], inF)).toEqual([]);
  });

  it('a same-parent group reorder keeps each row on its own parent and omits oldParent', () => {
    const result = place('after', [a, b], c);
    expect(result.map((p) => (p.kind === 'leaf' ? p.uid : null))).toEqual(['a', 'b']);
    expect(result.every((p) => !('oldParent' in p))).toBe(true);
    expect(result[0].orderKey > 's' && result[1].orderKey > result[0].orderKey).toBe(true);
  });
});
