/**
 * What is under a node of a tree, read off the parent-owned sets —
 * the one containment authority — never a path prefix. A cascade
 * delete is the consumer: a container takes its folders and every
 * leaf kind its `items` slots name, a request takes the examples its
 * `examples` slots name, so a child dragged out is spared and a child
 * dragged in is taken whatever a stale projection says.
 *
 * Two laws every walk applies. A slot orders, it does not claim: a
 * child in two live slots (a peer's concurrent move, until the
 * healing tombstone) counts under the ONE parent the index resolved
 * — the higher add-HLC slot, the same winner the projection renders.
 * A slot-less child (an old-client create the reconciler has not
 * reached, the boot window before slots land) counts under the parent
 * its stored linkage names — the path's parent for a leaf, the
 * parent-uid field for an example — as the readers render it. A slot
 * whose child is tombstoned is dead and skipped.
 */

import type { ParentRefShape } from '@openheaders/core/sync';
import { parentPathOf } from '@openheaders/core/utils';
import type { EntityOracle } from './oracle';
import { exampleContainerKind, hasExampleSlot, resolveExampleSlotParent } from './post-state/example-tree-post-state';
import {
  type FolderTreeKinds,
  hasTreeSlot,
  resolveLeafParentPath,
  treeContainers,
  treeMaterialized,
} from './post-state/folder-tree-post-state';

/** A leaf under a container, with the examples it owns (child before parent in a cascade). */
export interface LeafDescendant {
  type: string;
  uid: string;
  examples: ParentRefShape[];
}

export interface TreeDescendants {
  /** Folder uids under the container, deepest first — a cascade tombstones a folder after its children. */
  folders: string[];
  /** Live leaves of every kind under the container, each with the entity type its slot marker names. */
  leaves: LeafDescendant[];
}

/** Everything under `parent` on this tree: its slotted subtree plus the slot-less leaves whose stored path lands in it. */
export function treeDescendants(oracle: EntityOracle, tree: FolderTreeKinds, parent: ParentRefShape): TreeDescendants {
  const containers = treeContainers(oracle, tree);
  const folderPaths = new Map(containers.folders.map((folder) => [folder.uid, folder.path]));
  const rootPath =
    parent.type === tree.collectionType
      ? containers.collections.find((collection) => collection.uid === parent.uid)?.path
      : folderPaths.get(parent.uid);
  const folders: string[] = [];
  const leaves: LeafDescendant[] = [];
  if (rootPath === undefined) return { folders, leaves };

  const subtreePaths = new Set<string>([rootPath]);
  const walk = (node: ParentRefShape, path: string): void => {
    for (const slot of oracle.liveOrderedSetItems(node.type, node.uid, tree.childrenPath)) {
      const childPath = folderPaths.get(slot.itemId);
      if (childPath === undefined || parentPathOf(childPath) !== path) continue;
      subtreePaths.add(childPath);
      walk({ type: tree.folderType, uid: slot.itemId }, childPath);
      folders.push(slot.itemId);
    }
    for (const slot of oracle.liveOrderedSetItems(node.type, node.uid, tree.itemsPath)) {
      const type = slotItemType(slot.item);
      if (type === null || oracle.materializeOne(type, slot.itemId) === null) continue;
      if (resolveLeafParentPath(oracle, slot.itemId, tree) !== path) continue;
      leaves.push(leafDescendant(oracle, { type, uid: slot.itemId }));
    }
  };
  walk(parent, rootPath);

  for (const m of treeMaterialized(oracle, tree)) {
    if (m.type === tree.collectionType || m.type === tree.folderType || hasTreeSlot(oracle, tree, m.id)) continue;
    const storedParent = parentPathOf(storedString(m.data, 'path') ?? '');
    if (storedParent !== null && subtreePaths.has(storedParent)) {
      leaves.push(leafDescendant(oracle, { type: m.type, uid: m.id }));
    }
  }
  return { folders, leaves };
}

/**
 * The examples a request owns: the live ones its `examples` slots
 * name and the index resolves to it, plus the slot-less ones whose
 * stored parent-uid field names it. Empty for a type that holds no
 * examples.
 */
export function requestExamples(oracle: EntityOracle, request: ParentRefShape): ParentRefShape[] {
  const kind = exampleContainerKind(request.type);
  if (!kind) return [];
  const examples: ParentRefShape[] = [];
  const taken = new Set<string>();
  for (const slot of oracle.liveOrderedSetItems(request.type, request.uid, kind.examplesPath)) {
    if (oracle.materializeOne(kind.exampleType, slot.itemId) === null) continue;
    if (resolveExampleSlotParent(oracle, slot.itemId)?.uid !== request.uid) continue;
    taken.add(slot.itemId);
    examples.push({ type: kind.exampleType, uid: slot.itemId });
  }
  for (const m of oracle.materializeAll()) {
    if (m.type !== kind.exampleType || taken.has(m.id) || hasExampleSlot(oracle, m.id)) continue;
    if (storedString(m.data, kind.parentUidField) === request.uid) examples.push({ type: m.type, uid: m.id });
  }
  return examples;
}

function leafDescendant(oracle: EntityOracle, leaf: ParentRefShape): LeafDescendant {
  return { type: leaf.type, uid: leaf.uid, examples: requestExamples(oracle, leaf) };
}

function slotItemType(item: unknown): string | null {
  return storedString(item, 'type');
}

function storedString(data: unknown, field: string): string | null {
  if (typeof data !== 'object' || data === null || !(field in data)) return null;
  const value = (data as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
}
