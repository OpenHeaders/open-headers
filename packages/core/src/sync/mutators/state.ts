/**
 * Pure helpers for {@link EntityState} updates. The document store
 * holds these maps; mutators receive a state and a fresh envelope
 * and produce a status. State is mutated in place under the
 * per-entity lock — the lock guarantees complete observation, so
 * imperative mutation is safe and avoids per-mutation cloning of
 * potentially large maps.
 */

import type { EntityType } from '../envelope';
import type { HLC } from '../hlc';
import { compareHlc } from '../hlc';
import { seedKey } from '../order';
import type { EntityState, FieldOrigin } from './types';

export function newEntityState(type: EntityType, id: string): EntityState {
  return {
    type,
    id,
    tombstone: null,
    createHlc: null,
    fieldValues: new Map(),
    fieldTombstones: new Map(),
    setItems: new Map(),
    setTombstones: new Map(),
    setOrder: new Map(),
  };
}

/** Write a field value if `hlc` exceeds the existing entry's HLC. Returns true on apply. */
export function writeFieldIfNewer(
  state: EntityState,
  path: string,
  value: unknown,
  hlc: HLC,
  origin: FieldOrigin,
): boolean {
  const existing = state.fieldValues.get(path);
  if (existing && compareHlc(hlc, existing.hlc) <= 0) return false;
  state.fieldValues.set(path, { value, hlc, origin });
  return true;
}

/** Write a field tombstone if `hlc` exceeds the existing entry's HLC. */
export function writeFieldTombstoneIfNewer(state: EntityState, path: string, hlc: HLC): boolean {
  const existing = state.fieldTombstones.get(path);
  if (existing && compareHlc(hlc, existing) <= 0) return false;
  state.fieldTombstones.set(path, hlc);
  return true;
}

export function writeSetAddIfNewer(state: EntityState, path: string, itemId: string, item: unknown, hlc: HLC): boolean {
  let bucket = state.setItems.get(path);
  if (!bucket) {
    bucket = new Map();
    state.setItems.set(path, bucket);
  }
  const existing = bucket.get(itemId);
  if (existing && compareHlc(hlc, existing.addHlc) <= 0) return false;
  bucket.set(itemId, { item, addHlc: hlc });
  return true;
}

export function writeSetTombstoneIfNewer(state: EntityState, path: string, itemId: string, hlc: HLC): boolean {
  let bucket = state.setTombstones.get(path);
  if (!bucket) {
    bucket = new Map();
    state.setTombstones.set(path, bucket);
  }
  const existing = bucket.get(itemId);
  if (existing && compareHlc(hlc, existing) <= 0) return false;
  bucket.set(itemId, hlc);
  return true;
}

/** Mark the entity tombstoned. Tombstones are permanent under v1 (§7.2 delete-wins). */
export function writeEntityTombstone(state: EntityState, hlc: HLC): boolean {
  if (state.tombstone && compareHlc(hlc, state.tombstone) <= 0) return false;
  state.tombstone = hlc;
  return true;
}

/**
 * LWW write of a fractional-indexing key for a (setPath, itemId).
 * Used by both `moveBefore` (explicit) and `addToSet` (seed). Returns
 * true if the write applied.
 */
export function writeSetOrderIfNewer(state: EntityState, path: string, itemId: string, key: string, hlc: HLC): boolean {
  let bucket = state.setOrder.get(path);
  if (!bucket) {
    bucket = new Map();
    state.setOrder.set(path, bucket);
  }
  const existing = bucket.get(itemId);
  if (existing && compareHlc(hlc, existing.hlc) <= 0) return false;
  bucket.set(itemId, { key, hlc });
  return true;
}

/**
 * Live (not tombstoned) members at `path`, sorted by their order key
 * with itemId as the deterministic tie-breaker. Shared by move-key
 * computation and the materializer.
 */
export function liveOrderedItemsAt(
  state: EntityState,
  path: string,
): Array<{ itemId: string; item: unknown; key: string }> {
  const items = state.setItems.get(path);
  if (!items) return [];
  const tombstones = state.setTombstones.get(path);
  const order = state.setOrder.get(path);
  const live: Array<{ itemId: string; item: unknown; key: string }> = [];
  for (const [itemId, addEntry] of items) {
    const removeHlc = tombstones?.get(itemId);
    if (removeHlc && compareHlc(removeHlc, addEntry.addHlc) >= 0) continue;
    const key = order?.get(itemId)?.key ?? seedKey();
    live.push({ itemId, item: addEntry.item, key });
  }
  live.sort((a, b) => {
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    return a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0;
  });
  return live;
}
