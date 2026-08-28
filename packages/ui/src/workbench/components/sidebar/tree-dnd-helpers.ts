/**
 * tree-dnd-helpers — pure order math for the tree dnd surface.
 *
 *   - `isDescendantOf` — cycle guard for the reparent gestures:
 *     rejects drops where the drop target sits inside the dragged
 *     folder's own subtree (the catalog would accept the cyclic
 *     `addToSet` and the tree index would later break the cycle by
 *     rehoming; UI rejection has the cleaner failure mode).
 *   - `computeSiblingInsertOrderKey` — fractional `keyBetween` for the
 *     "drop AS SIBLING above/below the over row" gesture, given the
 *     over parent's live siblings, the moving child's uid (already
 *     among them for a same-parent slide, or foreign), the over
 *     child's uid and the side.
 *   - `computeAppendOrderKey` — the key after a run's live tail (a
 *     folder dropped on a leaf lands last among its parent's folders,
 *     right above the leaves; keyboard moves out of a folder);
 *     `computePrependSlot` — the key before a run's live head, for
 *     "into a container" drops (the child lands first, right under the
 *     container row, where the pointer is); `null` when the child
 *     already sits there.
 *   - The `*Slot` forms also return the key of the next live sibling,
 *     so a multi-item move can mint one key per item strictly between
 *     the anchor and that neighbour (`mintKeysAfter`).
 */

import { keyBetween, seedKey } from '@openheaders/core/sync';
import type { TreeNode } from './types';

export type LiveSiblings = ReadonlyArray<{ itemId: string; orderKey: string }>;

export function isDescendantOf(activeId: string, overNode: TreeNode, byId: ReadonlyMap<string, TreeNode>): boolean {
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
 * 'after' on an over row). Works whether the moving child is already
 * in the over parent's siblings (same-parent slide) or coming from a
 * foreign parent (cross-parent sibling-insert).
 *
 * `side` is the explicit drop zone — 'before' inserts above `overUid`,
 * 'after' inserts below. No drag-direction inference; the caller has
 * already classified the pointer position.
 *
 * Returns `null` when the result would be a no-op (the moving child is
 * already exactly at that slot in this parent — drag jitter).
 */
export function computeSiblingInsertOrderKey(
  siblings: LiveSiblings,
  movingUid: string,
  overUid: string,
  side: 'before' | 'after',
): string | null {
  return computeSiblingInsertSlot(siblings, movingUid, overUid, side)?.orderKey ?? null;
}

/** A minted position: the key and the live key right after it (`null` at the tail). */
export interface KeySlot {
  orderKey: string;
  nextKey: string | null;
}

export function computeSiblingInsertSlot(
  siblings: LiveSiblings,
  movingUid: string,
  overUid: string,
  side: 'before' | 'after',
): KeySlot | null {
  const overIdx = siblings.findIndex((s) => s.itemId === overUid);
  if (overIdx < 0) {
    // Mirror lag — the over child isn't in this parent's set yet. Seed.
    return { orderKey: seedKey(), nextKey: null };
  }

  // Same-parent no-op: the moving child is already directly adjacent on
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
  return { orderKey: keyBetween(prev, next), nextKey: next };
}

/** The key strictly after the run's tail; `null` when `movingUid` already is the tail. */
export function computeAppendOrderKey(siblings: LiveSiblings, movingUid: string): string | null {
  return computeAppendSlot(siblings, movingUid)?.orderKey ?? null;
}

export function computeAppendSlot(siblings: LiveSiblings, movingUid: string): KeySlot | null {
  const last = siblings[siblings.length - 1];
  if (last?.itemId === movingUid) return null;
  const tail = siblings.filter((s) => s.itemId !== movingUid).at(-1)?.orderKey ?? null;
  return { orderKey: tail === null ? seedKey() : keyBetween(tail, null), nextKey: null };
}

/** The key strictly before the run's head; `null` when `movingUid` already is the head. */
export function computePrependSlot(siblings: LiveSiblings, movingUid: string): KeySlot | null {
  if (siblings[0]?.itemId === movingUid) return null;
  const head = siblings.find((s) => s.itemId !== movingUid)?.orderKey ?? null;
  return { orderKey: head === null ? seedKey() : keyBetween(null, head), nextKey: head };
}

/** `count` ascending keys strictly after `slot.orderKey` and before its next live key. */
export function mintKeysAfter(slot: KeySlot, count: number): string[] {
  const keys: string[] = [];
  let prev = slot.orderKey;
  for (let i = 0; i < count; i++) {
    prev = keyBetween(prev, slot.nextKey);
    keys.push(prev);
  }
  return keys;
}
