/**
 * A container's live children, both kinds, merged by key — the one
 * oracle-side read of a collection's or folder's child order. The
 * `folders` and `items` sets share one keyspace and one `(key, uid)`
 * tie-break; every host consumer of the order (the store readers, the
 * tree-order record, the hydration planner) merges through here.
 *
 * The same sets answer "what is under this container": a cascade
 * delete walks them (`treeDescendants`) instead of a path prefix, so
 * a child dragged out is spared and a child dragged in is included
 * whatever a stale projection says. A slot orders, it does not claim
 * — a child counts under the one container its projected path names
 * (the S13 read law), and a slot-less child (an old-client create the
 * reconciler has not reached) counts under the container its stored
 * path names, as the readers render it.
 */

import { mergeOrderedEntries, type ParentRefShape } from '@openheaders/core/sync';
import { parentPathOf } from '@openheaders/core/utils';
import type { EntityOracle } from './oracle';
import {
  type FolderTreeKinds,
  hasTreeSlot,
  resolveLeafParentPath,
  treeContainers,
  treeMaterialized,
} from './post-state/folder-tree-post-state';

export function mergedChildSlots(
  oracle: EntityOracle,
  tree: FolderTreeKinds,
  type: string,
  uid: string,
): ReadonlyArray<{ itemId: string; key: string }> {
  return mergeOrderedEntries(
    oracle.liveOrderedSetItems(type, uid, tree.childrenPath),
    oracle.liveOrderedSetItems(type, uid, tree.itemsPath),
    (slot) => slot.key,
    (slot) => slot.itemId,
  );
}

export interface TreeDescendants {
  /** Folder uids under the container, deepest first — a cascade tombstones a folder after its children. */
  folders: string[];
  /** Live leaves of every kind under the container, each with the entity type its slot marker names. */
  leaves: Array<{ type: string; uid: string }>;
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
  const leaves: TreeDescendants['leaves'] = [];
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
      leaves.push({ type, uid: slot.itemId });
    }
  };
  walk(parent, rootPath);

  for (const m of treeMaterialized(oracle, tree)) {
    if (m.type === tree.collectionType || m.type === tree.folderType || hasTreeSlot(oracle, tree, m.id)) continue;
    const storedParent = parentPathOf(storedPath(m.data) ?? '');
    if (storedParent !== null && subtreePaths.has(storedParent)) leaves.push({ type: m.type, uid: m.id });
  }
  return { folders, leaves };
}

function slotItemType(item: unknown): string | null {
  if (typeof item !== 'object' || item === null || !('type' in item)) return null;
  const type = (item as { type: unknown }).type;
  return typeof type === 'string' ? type : null;
}

function storedPath(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('path' in data)) return null;
  const path = (data as { path: unknown }).path;
  return typeof path === 'string' ? path : null;
}
