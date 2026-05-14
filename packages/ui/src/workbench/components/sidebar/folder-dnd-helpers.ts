/**
 * folder-dnd-helpers — pure logic for the folder dnd surface.
 *
 *   - `isDescendantOf` — cycle guard for the cross-parent reparent
 *     gesture: rejects drops where the drop target sits inside the
 *     dragged folder's own subtree (catalog would accept the cyclic
 *     `addToSet` and the parent walk in folder-tree post-state would
 *     later orphan the folder; UI rejection has the cleaner failure
 *     mode).
 *   - `computeSiblingInsertOrderKey` — fractional `keyBetween` for the
 *     "drop AS SIBLING above/below over-row" gesture, given the over
 *     parent's live siblings, the dragged folder uid (which may be the
 *     same parent's child or a foreign-parent child), the over folder
 *     uid, and the drop side.
 */

import { keyBetween, seedKey } from '@openheaders/core/sync';
import type { TreeNode } from './types';

export function isDescendantOf(
  activeId: string,
  overNode: TreeNode,
  byId: ReadonlyMap<string, TreeNode>,
): boolean {
  let cursor: TreeNode | undefined = overNode;
  const visited = new Set<string>();
  while (cursor) {
    if (visited.has(cursor.id)) return false;
    visited.add(cursor.id);
    if (cursor.id === activeId) return true;
    if (!cursor.parentId) return false;
    cursor = byId.get(cursor.parentId);
  }
  return false;
}

/**
 * Compute the orderKey for a sibling-insert drop (zone='before' or
 * 'after' on a folder over-row). Works whether the dragged folder is
 * already in the over parent's siblings (same-parent slide) or coming
 * from a foreign parent (cross-parent sibling-insert).
 *
 * `side` is the explicit drop zone — 'before' inserts above `overUid`,
 * 'after' inserts below. No drag-direction inference; the caller has
 * already classified the pointer position.
 *
 * Returns `null` when the result would be a no-op (the dragged folder
 * is already exactly at that slot in this parent — drag jitter).
 */
export function computeSiblingInsertOrderKey(
  siblings: ReadonlyArray<{ itemId: string; orderKey: string }>,
  movingUid: string,
  overUid: string,
  side: 'before' | 'after',
): string | null {
  const overIdx = siblings.findIndex((s) => s.itemId === overUid);
  if (overIdx < 0) {
    // Mirror lag — over folder isn't in this parent's set yet. Seed.
    return seedKey();
  }

  // Same-parent no-op: dragged folder is already directly adjacent on
  // the requested side.
  const fromIdx = siblings.findIndex((s) => s.itemId === movingUid);
  if (fromIdx >= 0) {
    if (side === 'before' && fromIdx === overIdx - 1) return null;
    if (side === 'after' && fromIdx === overIdx + 1) return null;
  }

  const without = fromIdx >= 0 ? siblings.filter((s) => s.itemId !== movingUid) : siblings;
  const overIdxInWithout = without.findIndex((s) => s.itemId === overUid);
  const insertIdx = side === 'before' ? overIdxInWithout : overIdxInWithout + 1;
  const prev = without[insertIdx - 1]?.orderKey ?? null;
  const next = without[insertIdx]?.orderKey ?? null;
  return keyBetween(prev, next);
}
