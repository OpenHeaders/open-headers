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
 * **Reorder synthesis is LIS-optimal.** Rows whose live `(orderKey, item)`
 * already form a strictly-increasing-in-new-position-order subsequence
 * stay put (no envelope, no fresh orderKey). Everything outside that
 * subsequence — content edits, new rows, and the rows whose old position
 * "blocks" the longer chain — gets a fresh orderKey via `keyBetween(prev,
 * next)` against the surrounding LIS-anchored band.
 *
 * Why LIS: a one-pass left-to-right algorithm can emit up to N-1 moves
 * for a permutation that needs only 1 (drag-to-front of an N-row list:
 * leaving the dragged row at its old key forces every other row to
 * cascade to fresh keys after it). Picking the LIS as the stable anchor
 * set guarantees the move count is N − |LIS| — provably minimum for the
 * pure-reorder case, and within one envelope of minimum on mixed
 * gestures (any anchor row that's not in the LIS but stays at its live
 * position via geometry alone is a corner case the synthesizer treats
 * uniformly with everything-outside-LIS).
 *
 * Algorithmic notes:
 * - LIS is computed via patience-sort over the anchor rows (existing
 *   uid + content equal). O(n log n); n is the new-row count.
 * - `addToSet` always carries an explicit `orderKey`. Omitting it would
 *   default to `seedKey()` and silently overwrite the live position via
 *   per-itemId LWW on `setOrder`.
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

type RowKind = 'present' | 'new';

interface ClassifiedRow {
  kind: RowKind;
  /** True only when the row has a live entry AND its content is byte-equal. */
  contentEqual: boolean;
  /** Live orderKey when the row has a live entry; null for new rows. */
  liveOrderKey: string | null;
}

export function synthesizeSetDiff(args: SetDiffArgs): MutationBody[] {
  const { type, id, path, live, newItems: rawNewItems } = args;
  const bodies: MutationBody[] = [];

  const liveByUid = new Map<string, LiveSetEntry>();
  for (const entry of live) liveByUid.set(entry.itemId, entry);

  // Resolve uid per new item (mint defensively if missing).
  const newUids: string[] = rawNewItems.map((item) => (isUidCarrier(item) ? item.uid : generateUid()));
  const newUidSet = new Set(newUids);

  // Inject uid into items that don't carry one. This is load-bearing for
  // schema validation on hydrate: every set-modeled persisted item type
  // (HeaderModification, RuleCondition, RequestHeader, …) declares `uid`
  // as a required field, but renderer Form.List bindings often only
  // register Form.Items for fields with visible inputs (operation,
  // headerName, value) — `uid` set on `add()`'s initialValue gets
  // dropped by `getFieldsValue` because it has no bound Form.Item.
  // Without this rewrap, the persisted item shape is `{operation,
  // headerName, value}`; on next reload, `parseEntityArray(RuleSchema)`
  // rejects the rule for missing uid, the seed runs with 0 entries, and
  // the cache writes `[]` over the storage. Wrapping at this boundary
  // — instead of every editor adding hidden Form.Items — keeps the
  // schema invariant centralized at the write-path choke point that
  // every set-modeled mutation already passes through.
  const newItems: ReadonlyArray<unknown> = rawNewItems.map((item, i) =>
    isUidCarrier(item) ? item : { ...(item as Record<string, unknown>), uid: newUids[i] },
  );

  // Vanished rows — emit removeFromSet for uids no longer present.
  for (const entry of live) {
    if (!newUidSet.has(entry.itemId)) {
      bodies.push({ kind: 'removeFromSet', type, id, path, itemId: entry.itemId });
    }
  }

  // Classify each new row. "Present" = uid exists in live (regardless of
  // content); the live orderKey is reusable for any present row whose
  // position is geometrically consistent with the surrounding LIS-band.
  const classified: ClassifiedRow[] = newItems.map((item, i) => {
    const liveEntry = liveByUid.get(newUids[i]);
    if (!liveEntry) return { kind: 'new', contentEqual: false, liveOrderKey: null };
    return {
      kind: 'present',
      contentEqual: shallowItemEqual(item, liveEntry.item),
      liveOrderKey: liveEntry.orderKey,
    };
  });

  // LIS over the present rows' live orderKeys, in new-position order.
  // Rows in the LIS keep their live orderKey; rows outside need fresh
  // keys. Content-changed rows can be in the LIS — that just means they
  // emit an `addToSet` carrying the new content + the **same** orderKey
  // (position preserved; per-itemId LWW supersedes content).
  const lisIndices = computeLisIndices(classified);

  // Walk new items left-to-right; LIS rows reuse their live orderKey
  // and emit only when content changed; everything else mints
  // `keyBetween(prev, nextLisKey)` and emits the matching envelope.
  let prevKey: string | null = null;
  for (let i = 0; i < newItems.length; i++) {
    const row = classified[i];
    const uid = newUids[i];

    if (lisIndices.has(i) && row.kind === 'present') {
      const liveKey = row.liveOrderKey!;
      if (!row.contentEqual) {
        // Same position, new content → addToSet at the live orderKey.
        // Per-itemId LWW supersedes the existing item; carrying the live
        // orderKey on the envelope keeps `setOrder` exactly where it was
        // (omitting it would default to `seedKey()` and re-position).
        bodies.push({ kind: 'addToSet', type, id, path, itemId: uid, item: newItems[i], orderKey: liveKey });
      }
      prevKey = liveKey;
      continue;
    }

    const nextLisKey = findNextLisKey(classified, lisIndices, i + 1);
    const orderKey = keyBetween(prevKey, nextLisKey);

    if (row.kind === 'new') {
      bodies.push({ kind: 'addToSet', type, id, path, itemId: uid, item: newItems[i], orderKey });
    } else if (!row.contentEqual) {
      // Present, content differs, position changed → addToSet at fresh
      // orderKey. Carries new item + new position in one envelope.
      bodies.push({ kind: 'addToSet', type, id, path, itemId: uid, item: newItems[i], orderKey });
    } else {
      // Present, content equal, position changed → moveBefore.
      bodies.push({ kind: 'moveBefore', type, id, path, itemId: uid, orderKey });
    }

    prevKey = orderKey;
  }

  return bodies;
}

/**
 * Patience-sort LIS over the present rows' live orderKeys, in
 * new-position order. Returns the set of new-position indices whose
 * present row belongs to one longest strictly-increasing subsequence.
 *
 * Content equality does NOT participate in LIS membership — both
 * content-equal and content-changed rows are eligible. The envelope
 * kind (no-op vs. addToSet at the same orderKey) is chosen at emit
 * time based on `contentEqual`.
 *
 * Ties: the algorithm picks the lexicographically-earliest LIS, which
 * keeps the result deterministic across runs.
 */
function computeLisIndices(classified: ReadonlyArray<ClassifiedRow>): Set<number> {
  const present: Array<{ pos: number; key: string }> = [];
  for (let i = 0; i < classified.length; i++) {
    const row = classified[i];
    if (row.kind === 'present' && row.liveOrderKey !== null) {
      present.push({ pos: i, key: row.liveOrderKey });
    }
  }
  if (present.length === 0) return new Set();

  const tails: number[] = [];
  const parents: Array<number | null> = new Array(present.length).fill(null);

  for (let ai = 0; ai < present.length; ai++) {
    const key = present[ai].key;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (present[tails[mid]].key < key) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) parents[ai] = tails[lo - 1];
    if (lo === tails.length) tails.push(ai);
    else tails[lo] = ai;
  }

  const result = new Set<number>();
  let cursor: number | null = tails[tails.length - 1];
  while (cursor !== null) {
    result.add(present[cursor].pos);
    cursor = parents[cursor];
  }
  return result;
}

function findNextLisKey(
  classified: ReadonlyArray<ClassifiedRow>,
  lisIndices: ReadonlySet<number>,
  fromIdx: number,
): string | null {
  for (let j = fromIdx; j < classified.length; j++) {
    if (lisIndices.has(j)) return classified[j].liveOrderKey;
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
