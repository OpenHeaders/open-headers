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
 * the parent-owned fractional-indexing key (with itemId as tie-break)
 * so two structurally-equal stores produce byte-identical canonical
 * JSON. Order computation lives in `liveOrderedItemsAt`.
 */

import type { EntityType } from '../envelope';
import { compareHlc } from '../hlc';
import { type Leaf, unflattenLeaves } from '../mutators';
import { liveOrderedItemsAt } from '../mutators/state';
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

  for (const setPath of state.setItems.keys()) {
    const live = liveOrderedItemsAt(state, setPath);
    if (live.length === 0) continue;
    leaves.push({ path: setPath, value: live.map((l) => l.item) });
  }

  // Sort leaves by path so unflattenLeaves builds containers in a
  // deterministic shape regardless of insertion order.
  leaves.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { type: state.type, id: state.id, data: unflattenLeaves(leaves) };
}
