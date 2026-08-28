/**
 * Slot-order planning for a tree-authored `order:` (the tree
 * containment plan, Disk).
 *
 * A manifest's `order:` names the container's children in the order
 * the tree wants them. Converging the parent's ordered set to that
 * sequence is one pass per set: the longest strictly-increasing run of
 * live keys, taken in the desired order, keeps its keys; every other
 * member is re-keyed strictly between its desired neighbours with
 * `keyBetween`. Live members that are re-keyed become `moveBefore`
 * bodies — exactly the members whose relative order changed, never
 * the whole set — and members with no live slot (created or moved in
 * this round) get their key handed to the create / `slotAdd` through
 * {@link SlotOrderPlan.keyFor}, so a fresh clone seeds the committed
 * order and a moved directory lands at its listed position.
 *
 * Pure synthesis over the caller's desired sequences and live reader.
 */

import { keyBetween, type MutationBody, type ParentRefShape } from '@openheaders/core/sync';
import type { LiveSetEntriesReader } from './workspace-import-emission';

/** One ordered set to converge: the parent, the set path, the child uids in their final order. */
export interface SlotOrderTarget {
  parent: ParentRefShape;
  setPath: string;
  desired: readonly string[];
}

/** Re-key bodies for one parent — both of its sets, one batch. */
export interface SlotReorder {
  parent: ParentRefShape;
  bodies: MutationBody[];
}

export interface SlotOrderPlan {
  /** The planned key for a child that has no live slot at this set yet; `null` when the set was not planned. */
  keyFor(parent: ParentRefShape, setPath: string, childUid: string): string | null;
  /** `moveBefore` bodies for live members whose relative order changed, grouped per parent. */
  reorders: readonly SlotReorder[];
}

export function planSlotOrder(targets: readonly SlotOrderTarget[], live: LiveSetEntriesReader): SlotOrderPlan {
  const planned = new Map<string, string>();
  const byParent = new Map<string, SlotReorder>();
  for (const target of targets) {
    const liveKeys = new Map<string, string>();
    for (const entry of live(target.parent.type, target.parent.uid, target.setPath)) {
      liveKeys.set(entry.itemId, entry.orderKey);
    }
    const assigned = assignKeys(target.desired, liveKeys);
    for (const [uid, key] of assigned) {
      if (liveKeys.has(uid)) {
        const parentKey = nodeKey(target.parent);
        let group = byParent.get(parentKey);
        if (!group) {
          group = { parent: target.parent, bodies: [] };
          byParent.set(parentKey, group);
        }
        group.bodies.push({
          kind: 'moveBefore',
          type: target.parent.type,
          id: target.parent.uid,
          path: target.setPath,
          itemId: uid,
          orderKey: key,
        });
      } else {
        planned.set(slotKey(target.parent, target.setPath, uid), key);
      }
    }
  }
  return {
    keyFor: (parent, setPath, childUid) => planned.get(slotKey(parent, setPath, childUid)) ?? null,
    reorders: [...byParent.values()],
  };
}

/**
 * Keys for every member of `desired` that cannot keep its live key:
 * the members outside the longest strictly-increasing run of live keys
 * (in desired order) plus every member without a live key, each minted
 * strictly between the nearest kept neighbours.
 */
function assignKeys(desired: readonly string[], liveKeys: ReadonlyMap<string, string>): Map<string, string> {
  const kept = new Set(longestIncreasingRun(desired.map((uid) => liveKeys.get(uid) ?? null)));
  const nextKept: Array<string | null> = new Array(desired.length).fill(null);
  let upcoming: string | null = null;
  for (let i = desired.length - 1; i >= 0; i -= 1) {
    nextKept[i] = upcoming;
    if (kept.has(i)) upcoming = liveKeys.get(desired[i]) ?? null;
  }
  const out = new Map<string, string>();
  let previous: string | null = null;
  desired.forEach((uid, i) => {
    if (kept.has(i)) {
      previous = liveKeys.get(uid) ?? null;
      return;
    }
    const key = keyBetween(previous, nextKept[i]);
    out.set(uid, key);
    previous = key;
  });
  return out;
}

/** Indices of one longest strictly-increasing subsequence over the non-null keys (patience sorting). */
function longestIncreasingRun(keys: ReadonlyArray<string | null>): number[] {
  const tails: number[] = [];
  const tailKeys: string[] = [];
  const predecessor: number[] = new Array(keys.length).fill(-1);
  keys.forEach((key, i) => {
    if (key === null) return;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (tailKeys[mid] < key) low = mid + 1;
      else high = mid;
    }
    predecessor[i] = low > 0 ? tails[low - 1] : -1;
    tails[low] = i;
    tailKeys[low] = key;
  });
  const out: number[] = [];
  let cursor = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (cursor !== -1) {
    out.push(cursor);
    cursor = predecessor[cursor];
  }
  return out.reverse();
}

function nodeKey(parent: ParentRefShape): string {
  return `${parent.type}:${parent.uid}`;
}

function slotKey(parent: ParentRefShape, setPath: string, childUid: string): string {
  return `${nodeKey(parent)}:${setPath}:${childUid}`;
}
