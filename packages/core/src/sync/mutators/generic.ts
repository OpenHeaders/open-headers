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
import { compareHlc } from '../hlc';
import { seedKey } from '../order';
import { flattenToLeaves } from './flatten';
import {
  writeEntityTombstone,
  writeFieldIfNewer,
  writeFieldTombstoneIfNewer,
  writeSetAddIfNewer,
  writeSetOrderIfNewer,
  writeSetTombstoneIfNewer,
} from './state';
import type { EntityState, FieldOrigin, MutatorOutcome } from './types';

export function applyMutation(
  state: EntityState,
  envelope: MutationEnvelope,
  applyOrigin: FieldOrigin = 'local',
): MutatorOutcome {
  // Delete-wins absolutely (§7.2): once tombstoned, every later mutation drops.
  // Note: tombstone applies regardless of HLC compare — see "no HLC escape hatch".
  if (state.tombstone && envelope.body.kind !== 'delete') {
    return { status: 'tombstoned' };
  }

  const { body, hlc } = envelope;

  switch (body.kind) {
    case 'create': {
      // Record the earliest create so materialization can gate on it —
      // even when every leaf is superseded, the entity IS created.
      if (!state.createHlc || compareHlc(hlc, state.createHlc) < 0) {
        state.createHlc = hlc;
      }
      const leaves = flattenToLeaves(body.payload);
      let any = false;
      for (const { path, value } of leaves) {
        if (writeFieldIfNewer(state, path, value, hlc, applyOrigin)) any = true;
      }
      return { status: any ? 'applied' : 'superseded-by-hlc' };
    }
    case 'delete': {
      const applied = writeEntityTombstone(state, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'setField': {
      const applied = writeFieldIfNewer(state, body.path, body.value, hlc, applyOrigin);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'unsetField': {
      const applied = writeFieldTombstoneIfNewer(state, body.path, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'addToSet': {
      const applied = writeSetAddIfNewer(state, body.path, body.itemId, body.item, hlc);
      // The order key is part of the envelope; if absent, default to
      // the seed. LWW per (setPath, itemId) — an explicit moveBefore
      // at a higher HLC overrides; a stale addToSet arriving after a
      // move can't reset.
      writeSetOrderIfNewer(state, body.path, body.itemId, body.orderKey ?? seedKey(), hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'removeFromSet': {
      const applied = writeSetTombstoneIfNewer(state, body.path, body.itemId, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
    case 'moveBefore': {
      // Writer-committed fractional-indexing key (§7.2 / §23.5).
      const applied = writeSetOrderIfNewer(state, body.path, body.itemId, body.orderKey, hlc);
      return { status: applied ? 'applied' : 'superseded-by-hlc' };
    }
  }
}
