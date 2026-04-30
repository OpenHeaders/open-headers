/**
 * folder-dnd-placement — pure helper that resolves a (zone, active,
 * over) drag tuple to the move-folder envelope inputs:
 *
 *   { folderUid, parent, oldParent?, orderKey }
 *
 * Encodes the three drop gestures FolderDndTree supports:
 *
 *   - 'into' on a FOLDER row → reparent under that folder; append at
 *     the tail of its children (or seed if empty).
 *   - 'into' on a COLLECTION row → reparent under that collection;
 *     append at the tail.
 *   - 'before' / 'after' on a FOLDER row → the over-folder's PARENT
 *     becomes the dragged folder's new parent; insert immediately
 *     above / below the over-folder via `keyBetween` on the parent's
 *     live siblings. This is the gesture session 45 deferred — the
 *     architecturally distinct "drop AS SIBLING in different parent"
 *     case (or fine-grained intra-parent placement that doesn't rely
 *     on dnd-kit's drag-direction inference).
 *
 * Returns `null` when the drop is a no-op or rejected (cycle, missing
 * uids, foreign tree, drop on current parent without a slot change).
 *
 * Pure — no React, no dnd-kit, no chrome.runtime; the dnd component
 * supplies all inputs and dispatches the result.
 */

import { keyBetween, seedKey } from '@openheaders/core/sync';
import type { FolderDndIdConfig, FolderDndParent } from './folder-dnd-ids';
import { parentFromId, stripPrefix } from './folder-dnd-ids';
import type { TreeNode } from './types';
import type { DropZone } from './folder-dnd-zone';
import {
  computeMoveOrderKey,
  computeSiblingInsertOrderKey,
  isDescendantOf,
} from './folder-dnd-helpers';

export interface DropPlacement {
  folderUid: string;
  parent: FolderDndParent;
  /** Set when the drop crosses parents; absent for same-parent reorder. */
  oldParent?: FolderDndParent;
  orderKey: string;
}

export interface DropPlacementInput {
  zone: DropZone;
  activeNode: TreeNode;
  overNode: TreeNode;
  byId: ReadonlyMap<string, TreeNode>;
  config: FolderDndIdConfig;
  /** Live ordered child-folder set on the supplied parent. */
  lookupSiblings(parent: FolderDndParent): ReadonlyArray<{ itemId: string; orderKey: string }>;
}

function sameParent(a: FolderDndParent, b: FolderDndParent): boolean {
  return a.kind === b.kind && a.uid === b.uid;
}

function appendOrderKey(
  parent: FolderDndParent,
  lookupSiblings: DropPlacementInput['lookupSiblings'],
  excludeUid?: string,
): string {
  const siblings = lookupSiblings(parent);
  const filtered = excludeUid ? siblings.filter((s) => s.itemId !== excludeUid) : siblings;
  const lastKey = filtered[filtered.length - 1]?.orderKey ?? null;
  return lastKey === null ? seedKey() : keyBetween(lastKey, null);
}

export function computeDropPlacement(input: DropPlacementInput): DropPlacement | null {
  const { zone, activeNode, overNode, byId, config, lookupSiblings } = input;

  // Active must be a folder row in OUR tree.
  if (activeNode.kind !== 'folder') return null;
  const folderUid = stripPrefix(activeNode.id, config.folderIdPrefix);
  if (!folderUid) return null;

  // Resolve the dragged folder's current parent.
  const oldParent = activeNode.parentId ? parentFromId(activeNode.parentId, config) : null;
  if (!oldParent) return null;

  // Cycle guard: never drop a folder into its own subtree.
  if (isDescendantOf(activeNode.id, overNode, byId)) return null;

  // Coerce zone for non-folder over-rows: collections (groups) only
  // accept 'into' (no row above or below them within the same parent).
  // Foreign rows (system templates, env leaves, …) reject outright.
  const overIsFolder = overNode.kind === 'folder' && overNode.id.startsWith(config.folderIdPrefix);
  const overIsCollection = overNode.kind === 'group' && overNode.id.startsWith(config.collectionIdPrefix);
  const effectiveZone: DropZone = overIsCollection ? 'into' : zone;
  if (!overIsFolder && !overIsCollection) return null;

  if (effectiveZone === 'into') {
    const newParent = parentFromId(overNode.id, config);
    if (!newParent) return null;
    if (sameParent(newParent, oldParent)) return null; // already there
    const orderKey = appendOrderKey(newParent, lookupSiblings);
    return { folderUid, parent: newParent, oldParent, orderKey };
  }

  // 'before' / 'after' on a folder over-row: the over-folder's PARENT
  // becomes the dragged folder's new parent (or stays the same — same
  // parent, fine-grained slot).
  if (!overIsFolder) return null;
  const overFolderUid = stripPrefix(overNode.id, config.folderIdPrefix);
  if (!overFolderUid) return null;
  const overParent = overNode.parentId ? parentFromId(overNode.parentId, config) : null;
  if (!overParent) return null;

  const isSameParent = sameParent(overParent, oldParent);
  if (isSameParent) {
    // Same-parent fine-grained slot. Use the explicit-side helper —
    // the existing drag-direction-inferring `computeMoveOrderKey` is
    // for the rougher gesture where dnd-kit picks the side; the
    // zone-driven gesture commits to a side here.
    const siblings = lookupSiblings(oldParent);
    const orderKey = computeSiblingInsertOrderKey(siblings, folderUid, overFolderUid, effectiveZone);
    if (orderKey === null) return null;
    return { folderUid, parent: oldParent, orderKey };
  }

  // Cross-parent sibling-insert.
  const siblings = lookupSiblings(overParent);
  const orderKey = computeSiblingInsertOrderKey(siblings, folderUid, overFolderUid, effectiveZone);
  if (orderKey === null) return null;
  return { folderUid, parent: overParent, oldParent, orderKey };
}

// Re-export the no-zone same-parent helper so the test suite + the dnd
// surface keep one entry point per gesture variant.
export { computeMoveOrderKey, isDescendantOf } from './folder-dnd-helpers';
