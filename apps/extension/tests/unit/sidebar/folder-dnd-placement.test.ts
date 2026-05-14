/**
 * Unit tests for `computeDropPlacement` — the pure resolver that
 * turns (zone, activeNode, overNode, byId, lookupSiblings) into the
 * move-folder envelope inputs (or null for no-op / rejected drops).
 */

import {
  computeSiblingInsertOrderKey,
  isDescendantOf,
} from '@openheaders/ui/workbench/components/sidebar/folder-dnd-helpers';
import type { FolderDndParent } from '@openheaders/ui/workbench/components/sidebar/folder-dnd-ids';
import { computeDropPlacement } from '@openheaders/ui/workbench/components/sidebar/folder-dnd-placement';
import type { TreeNode } from '@openheaders/ui/workbench/components/sidebar/types';
import { describe, expect, it } from 'vitest';

const CONFIG = { collectionIdPrefix: 'col-', folderIdPrefix: 'folder-' };

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
    const lookupSiblings = (parent: FolderDndParent) =>
      parent.kind === 'collection' && parent.uid === 'c2' ? [{ itemId: 'tail', orderKey: 's' }] : [];

    const result = computeDropPlacement({
      zone: 'into',
      activeNode: dragged,
      overNode: c2,
      byId,
      config: CONFIG,
      lookupSiblings,
    });
    expect(result).not.toBeNull();
    expect(result!.parent).toEqual({ kind: 'collection', uid: 'c2' });
    expect(result!.oldParent).toEqual({ kind: 'collection', uid: 'c1' });
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
      lookupSiblings: () => [],
    });
    expect(result).not.toBeNull();
    expect(result!.parent).toEqual({ kind: 'folder', uid: 't' });
    expect(result!.oldParent).toEqual({ kind: 'collection', uid: 'c1' });
  });

  it("'before' on a foreign-parent folder cross-parent-inserts above it", () => {
    const c1 = collection('c1');
    const c2 = collection('c2');
    const overTarget = folder('t', 'col-c2');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, c2, overTarget, dragged]);
    const lookupSiblings = (parent: FolderDndParent) =>
      parent.kind === 'collection' && parent.uid === 'c2' ? [{ itemId: 't', orderKey: 'm' }] : [];

    const result = computeDropPlacement({
      zone: 'before',
      activeNode: dragged,
      overNode: overTarget,
      byId,
      config: CONFIG,
      lookupSiblings,
    });
    expect(result).not.toBeNull();
    expect(result!.parent).toEqual({ kind: 'collection', uid: 'c2' });
    expect(result!.oldParent).toEqual({ kind: 'collection', uid: 'c1' });
    // No prev, next='m' — key sits below 'm'.
    expect(result!.orderKey < 'm').toBe(true);
  });

  it("'after' on a foreign-parent folder cross-parent-inserts below it", () => {
    const c1 = collection('c1');
    const c2 = collection('c2');
    const overTarget = folder('t', 'col-c2');
    const dragged = folder('f', 'col-c1');
    const byId = map([c1, c2, overTarget, dragged]);
    const lookupSiblings = (parent: FolderDndParent) =>
      parent.kind === 'collection' && parent.uid === 'c2' ? [{ itemId: 't', orderKey: 'm' }] : [];

    const result = computeDropPlacement({
      zone: 'after',
      activeNode: dragged,
      overNode: overTarget,
      byId,
      config: CONFIG,
      lookupSiblings,
    });
    expect(result).not.toBeNull();
    expect(result!.parent).toEqual({ kind: 'collection', uid: 'c2' });
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
      lookupSiblings,
    });
    expect(result).not.toBeNull();
    expect(result!.parent).toEqual({ kind: 'collection', uid: 'c1' });
    expect(result!.oldParent).toBeUndefined(); // same-parent reorder
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
      lookupSiblings: () => [],
    });
    expect(result).toBeNull();
  });

  it('coerces non-into zones on collection rows to into', () => {
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
      lookupSiblings: () => [],
    });
    expect(result).not.toBeNull();
    expect(result!.parent).toEqual({ kind: 'collection', uid: 'c2' });
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
    [folderNode('p'), folderNode('c', 'p')].forEach((n) => map.set(n.id, n));
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
