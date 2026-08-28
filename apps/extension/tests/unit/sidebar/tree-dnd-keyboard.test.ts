/**
 * Keyboard moves — Alt+Arrow on the focused row resolves to the same
 * placement a drop makes: up / down among the parent's children
 * (folders and leaves share one order; collections among
 * collections), into the nearest folder above, out to right after the
 * folder left.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { TreeDndIdConfig, TreeDndParent } from '@openheaders/ui/workbench/components/sidebar/tree-dnd-ids';
import {
  computeKeyboardMove,
  moveDirectionForKey,
} from '@openheaders/ui/workbench/components/sidebar/tree-dnd-keyboard';
import type { TreeNode } from '@openheaders/ui/workbench/components/sidebar/types';
import { describe, expect, it } from 'vitest';

const CONFIG: TreeDndIdConfig = {
  collectionIdPrefix: 'col-',
  folderIdPrefix: 'folder-',
  leafKinds: [{ idPrefix: 'rule-', entityType: RULE_ENTITY_TYPE }],
};

const node = (id: string, kind: TreeNode['kind'], parentId?: string): TreeNode => ({
  id,
  parentId,
  kind,
  label: id,
  depth: 0,
  expandable: kind !== 'leaf',
  icon: null,
  canRename: true,
  canDelete: true,
  canAddChild: kind !== 'leaf',
});

// c1 › [f1 › [f2, r3], f4, r1, r2], c2
const nodes: TreeNode[] = [
  node('col-c1', 'group'),
  node('folder-f1', 'folder', 'col-c1'),
  node('folder-f2', 'folder', 'folder-f1'),
  node('rule-r3', 'leaf', 'folder-f1'),
  node('folder-f4', 'folder', 'col-c1'),
  node('rule-r1', 'leaf', 'col-c1'),
  node('rule-r2', 'leaf', 'col-c1'),
  node('col-c2', 'group'),
];
const byId = new Map(nodes.map((n) => [n.id, n]));
const keyed = (ids: string[]) => ids.map((itemId, i) => ({ itemId, orderKey: String.fromCharCode(103 + i * 3) }));
// The merged children of each parent, in visible order.
const lookupChildren = (parent: TreeDndParent) =>
  parent.kind === 'collection' ? keyed(['f1', 'f4', 'r1', 'r2']) : parent.uid === 'f1' ? keyed(['f2', 'r3']) : [];
const lookupCollections = () => keyed(['c1', 'c2']);

const move = (direction: 'up' | 'down' | 'into' | 'out', id: string) =>
  computeKeyboardMove({
    direction,
    activeNode: byId.get(id)!,
    nodes,
    byId,
    config: CONFIG,
    lookupChildren,
    lookupCollections,
  });

describe('moveDirectionForKey', () => {
  it('maps Alt+Arrow only', () => {
    const base = { altKey: true, metaKey: false, ctrlKey: false, shiftKey: false };
    expect(moveDirectionForKey({ ...base, key: 'ArrowUp' })).toBe('up');
    expect(moveDirectionForKey({ ...base, key: 'ArrowDown' })).toBe('down');
    expect(moveDirectionForKey({ ...base, key: 'ArrowRight' })).toBe('into');
    expect(moveDirectionForKey({ ...base, key: 'ArrowLeft' })).toBe('out');
    expect(moveDirectionForKey({ ...base, key: 'a' })).toBeNull();
    expect(moveDirectionForKey({ ...base, altKey: false, key: 'ArrowUp' })).toBeNull();
    expect(moveDirectionForKey({ ...base, shiftKey: true, key: 'ArrowUp' })).toBeNull();
  });
});

describe('computeKeyboardMove', () => {
  it("up / down move among the parent's children of either kind and stop at the ends", () => {
    expect(move('up', 'rule-r2')).toMatchObject({ kind: 'leaf', uid: 'r2', parent: { kind: 'collection', uid: 'c1' } });
    // r1 sits right after f4: up crosses the kind boundary.
    const leafUp = move('up', 'rule-r1');
    expect(leafUp).toMatchObject({ kind: 'leaf', uid: 'r1', parent: { kind: 'collection', uid: 'c1' } });
    expect(leafUp!.orderKey > 'g' && leafUp!.orderKey < 'j').toBe(true);
    expect(move('down', 'rule-r2')).toBeNull();
    expect(move('down', 'folder-f1')).toMatchObject({ kind: 'folder', folderUid: 'f1' });
    expect(move('down', 'folder-f4')).toMatchObject({ kind: 'folder', folderUid: 'f4' });
    expect(move('up', 'folder-f1')).toBeNull();
    expect(move('down', 'col-c1')).toMatchObject({ kind: 'collection', uid: 'c1' });
    expect(move('up', 'col-c1')).toBeNull();
  });

  it('into moves under the nearest folder above in the same parent', () => {
    expect(move('into', 'rule-r1')).toMatchObject({
      kind: 'leaf',
      uid: 'r1',
      parent: { kind: 'folder', uid: 'f4' },
      oldParent: { kind: 'collection', uid: 'c1' },
    });
    expect(move('into', 'folder-f4')).toMatchObject({
      kind: 'folder',
      folderUid: 'f4',
      parent: { kind: 'folder', uid: 'f1' },
      oldParent: { kind: 'collection', uid: 'c1' },
    });
    expect(move('into', 'folder-f1')).toBeNull();
    expect(move('into', 'col-c1')).toBeNull();
  });

  it('out lands right after the folder left, in its parent; a collection child stays', () => {
    const leafOut = move('out', 'rule-r3');
    expect(leafOut).toMatchObject({
      kind: 'leaf',
      uid: 'r3',
      parent: { kind: 'collection', uid: 'c1' },
      oldParent: { kind: 'folder', uid: 'f1' },
    });
    // Between f1 ('g') and f4 ('j').
    expect(leafOut!.orderKey > 'g' && leafOut!.orderKey < 'j').toBe(true);
    expect(move('out', 'folder-f2')).toMatchObject({
      kind: 'folder',
      folderUid: 'f2',
      parent: { kind: 'collection', uid: 'c1' },
      oldParent: { kind: 'folder', uid: 'f1' },
    });
    expect(move('out', 'rule-r1')).toBeNull();
    expect(move('out', 'col-c1')).toBeNull();
  });
});
