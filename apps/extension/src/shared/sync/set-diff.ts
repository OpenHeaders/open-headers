/**
 * Unified set-replacement diff synthesizer.
 *
 * Given the oracle's live `(itemId, orderKey, item)` entries at a
 * set-modeled path and a new array of items keyed by `uid`, produce
 * the **minimum** `MutationBody[]` that converges the materialized set
 * to the new value:
 *
 *   - vanished uids (in live, not in new) → `removeFromSet`
 *   - new uids (in new, not in live) → `addToSet(uid, item, orderKey)`
 *   - existing uids whose content changed → `addToSet(uid, item, orderKey)`
 *     Per-itemId LWW (§7.2) makes the higher-HLC `addToSet` supersede
 *     the existing entry; an explicit `removeFromSet` would be redundant
 *     and would cost an envelope per row.
 *   - existing uids whose only position changed → `moveBefore(uid, orderKey)`
 *   - existing uids whose content + position are unchanged → emit nothing
 *
 * This subsumes the dual fast-path / fallback split that shipped in
 * session 39: mixed gestures (reorder + content edit, content edit +
 * row add, etc.) emit the minimum diff in one walk; the pure-reorder
 * fast path falls out as a special case (every row is content-equal
 * and either keeps or moves its key).
 *
 * Algorithmic notes:
 * - One pass left-to-right. For each new row we either reuse the live
 *   row's `orderKey` (when it strictly exceeds the previously-committed
 *   key) or mint a fresh one via `keyBetween(prev, next)` against the
 *   committed-so-far tail and the next un-consumed live row's key. This
 *   is not LIS-optimal (a permutation can emit up to N-1 moves where 1
 *   would do), but every plan converges under the document store's
 *   `(orderKey, itemId)` materialize sort. LIS-optimal synthesis is a
 *   bounded follow-up improvement, not a correctness issue.
 * - `addToSet` always carries an explicit `orderKey`. Omitting it would
 *   default to `seedKey()` and silently overwrite the live position
 *   (per-itemId LWW on `setOrder`).
 * - `uid` is required on each new item. Items without one mint via
 *   `generateUid()` defensively; importer / editor paths should always
 *   pre-populate (the schema makes `uid` required).
 */

import {
  type EntityType,
  keyBetween,
  type MutationBody,
} from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';

export interface LiveSetEntry {
  itemId: string;
  orderKey: string;
  item: unknown;
}

export interface SetDiffArgs {
  type: EntityType;
  id: string;
  path: string;
  live: ReadonlyArray<LiveSetEntry>;
  newItems: ReadonlyArray<unknown>;
}

export function synthesizeSetDiff(args: SetDiffArgs): MutationBody[] {
  const { type, id, path, live, newItems } = args;
  const bodies: MutationBody[] = [];

  const liveByUid = new Map<string, LiveSetEntry>();
  for (const entry of live) liveByUid.set(entry.itemId, entry);

  // Resolve uid per new item (mint defensively if missing).
  const newUids: string[] = newItems.map((item) => (isUidCarrier(item) ? item.uid : generateUid()));
  const newUidSet = new Set(newUids);

  // Vanished rows — emit removeFromSet for uids no longer present.
  for (const entry of live) {
    if (!newUidSet.has(entry.itemId)) {
      bodies.push({ kind: 'removeFromSet', type, id, path, itemId: entry.itemId });
    }
  }

  // Walk new items left-to-right; assign each row a final orderKey
  // (re-use live key when consistent with prevKey, otherwise mint via
  // keyBetween against the next un-consumed live key) and decide
  // envelope kind from the (presence, content, position) triple.
  let prevKey: string | null = null;
  for (let i = 0; i < newItems.length; i++) {
    const uid = newUids[i];
    const item = newItems[i];
    const liveEntry = liveByUid.get(uid);

    const positionConsistent =
      liveEntry !== undefined && (prevKey === null || liveEntry.orderKey > prevKey);

    let orderKey: string;
    if (liveEntry && positionConsistent) {
      orderKey = liveEntry.orderKey;
    } else {
      const nextKey = pickNextKey(newUids, liveByUid, i + 1, prevKey);
      orderKey = keyBetween(prevKey, nextKey);
    }

    if (liveEntry === undefined) {
      bodies.push({ kind: 'addToSet', type, id, path, itemId: uid, item, orderKey });
    } else if (!shallowItemEqual(item, liveEntry.item)) {
      // Content differs: addToSet at higher HLC supersedes via per-itemId
      // LWW. No explicit removeFromSet needed.
      bodies.push({ kind: 'addToSet', type, id, path, itemId: uid, item, orderKey });
    } else if (orderKey !== liveEntry.orderKey) {
      // Content equal, position changed: moveBefore is a pure reorder.
      bodies.push({ kind: 'moveBefore', type, id, path, itemId: uid, orderKey });
    }
    // else: content + position unchanged → emit nothing.

    prevKey = orderKey;
  }

  return bodies;
}

function pickNextKey(
  newUids: ReadonlyArray<string>,
  liveByUid: ReadonlyMap<string, LiveSetEntry>,
  fromIdx: number,
  prevKey: string | null,
): string | null {
  for (let j = fromIdx; j < newUids.length; j++) {
    const liveEntry = liveByUid.get(newUids[j]);
    if (!liveEntry) continue;
    if (prevKey === null || liveEntry.orderKey > prevKey) return liveEntry.orderKey;
  }
  return null;
}

function isUidCarrier(item: unknown): item is { uid: string } {
  return typeof item === 'object' && item !== null && typeof (item as { uid?: unknown }).uid === 'string';
}

function shallowItemEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  return canonicalize(a) === canonicalize(b);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}
