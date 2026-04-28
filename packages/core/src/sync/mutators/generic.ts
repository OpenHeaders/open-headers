/**
 * Generic mutator dispatch (§7.1).
 *
 * Each mutator is a pure function over an {@link EntityState}. They
 * mutate the state in place — the per-entity lock guarantees the
 * caller has serialized observation; allocating a fresh state per
 * mutation would burn cycles for no semantic benefit.
 *
 * Convergence rests on max-HLC-wins at the smallest persistent unit:
 *   - whole entity → tombstone HLC (delete-wins, permanent)
 *   - per-field path → fieldValues / fieldTombstones (LWW)
 *   - per-(setPath, itemId) → setItems / setTombstones (LWW)
 */

import type { MutationEnvelope } from '../envelope';
import { flattenToLeaves } from './flatten';
import {
  writeEntityTombstone,
  writeFieldIfNewer,
  writeFieldTombstoneIfNewer,
  writeSetAddIfNewer,
  writeSetTombstoneIfNewer,
} from './state';
import type { EntityState, MutatorOutcome } from './types';

export function applyMutation(state: EntityState, envelope: MutationEnvelope): MutatorOutcome {
  // Delete-wins absolutely (§7.2): once tombstoned, every later mutation drops.
  // Note: tombstone applies regardless of HLC compare — see "no HLC escape hatch".
  if (state.tombstone && envelope.body.kind !== 'delete') {
    return { status: 'tombstoned' };
  }

  const { body, hlc } = envelope;

  switch (body.kind) {
    case 'create': {
      const leaves = flattenToLeaves(body.payload);
      let any = false;
      for (const { path, value } of leaves) {
        if (writeFieldIfNewer(state, path, value, hlc)) any = true;
      }
      return { status: any ? 'applied' : 'superseded-by-hlc' };
    }
    case 'delete': {
      const applied = writeEntityTombstone(state, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'setField': {
      const applied = writeFieldIfNewer(state, body.path, body.value, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'unsetField': {
      const applied = writeFieldTombstoneIfNewer(state, body.path, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'addToSet': {
      const applied = writeSetAddIfNewer(state, body.path, body.itemId, body.item, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'removeFromSet': {
      const applied = writeSetTombstoneIfNewer(state, body.path, body.itemId, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'moveBefore': {
      // Reordering primitive — implemented in Phase A's rule-mutator
      // session via fractional indexing on the parent's order array
      // (§7.2). The generic store records nothing for moves; entity
      // mutators own the semantics.
      return { status: 'applied' };
    }
  }
}
