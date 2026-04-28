/**
 * Materialize {@link EntityState} → externally-observable snapshot.
 *
 * Convergence rests on this being a pure function of the per-unit
 * max-HLC-wins records:
 *   - per-leaf field path: include the value iff its HLC exceeds any
 *     covering field tombstone HLC at the same path (§7.2 unsetField).
 *   - per-(setPath, itemId): include the item iff its add HLC exceeds
 *     the corresponding remove tombstone HLC.
 *   - whole entity: omit if any tombstone exists (delete-wins,
 *     permanent — §7.2).
 *
 * Set items are emitted under their setPath as an array sorted by
 * itemId so two structurally-equal stores produce byte-identical
 * canonical JSON.
 */

import type { EntityType } from '../envelope';
import { compareHlc } from '../hlc';
import { type Leaf, unflattenLeaves } from '../mutators';
import type { EntityState } from '../mutators/types';

export interface MaterializedEntity {
  type: EntityType;
  id: string;
  data: unknown;
}

export function materializeEntity(state: EntityState): MaterializedEntity | null {
  if (state.tombstone) return null;

  const leaves: Leaf[] = [];

  for (const [path, entry] of state.fieldValues) {
    const tombstoneHlc = state.fieldTombstones.get(path);
    if (tombstoneHlc && compareHlc(tombstoneHlc, entry.hlc) >= 0) continue;
    leaves.push({ path, value: entry.value });
  }

  for (const [setPath, items] of state.setItems) {
    const tombstones = state.setTombstones.get(setPath);
    const live: Array<{ itemId: string; item: unknown }> = [];
    for (const [itemId, addEntry] of items) {
      const removeHlc = tombstones?.get(itemId);
      if (removeHlc && compareHlc(removeHlc, addEntry.addHlc) >= 0) continue;
      live.push({ itemId, item: addEntry.item });
    }
    if (live.length === 0) continue;
    live.sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
    leaves.push({ path: setPath, value: live.map((l) => l.item) });
  }

  // Sort leaves by path so unflattenLeaves builds containers in a
  // deterministic shape regardless of insertion order.
  leaves.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { type: state.type, id: state.id, data: unflattenLeaves(leaves) };
}
