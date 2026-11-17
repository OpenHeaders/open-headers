/**
 * Generic mutator dispatch (§7.1).
 *
 * Each mutator is a pure function over an {@link EntityState}. They
 * mutate the state in place — the per-entity lock guarantees the
 * caller has serialized observation; allocating a fresh state per
 * mutation would burn cycles for no semantic benefit.
 *
 * Convergence rests on max-HLC-wins at the smallest persistent unit:
 *   - whole entity → tombstone HLC against restore HLC (§7.2: a delete
 *     wins over every write but a later restore)
 *   - per-field path → fieldValues / fieldTombstones (LWW)
 *   - per-(setPath, itemId) → setItems / setTombstones (LWW)
 *
 * Every mutation is written to the state, a deleted entity's too: the
 * state is a function of the set of envelopes and never of their
 * order, so a write that arrives ahead of the restore it follows is
 * there when the restore lands. What a deleted entity takes shows
 * nothing and answers `tombstoned`.
 */

import type { MutationEnvelope } from '../envelope';
import { compareHlc } from '../hlc';
import { seedKey } from '../order';
import { flattenToLeaves } from './flatten';
import {
  isCurrentWrite,
  isEntityDeleted,
  writeEntityRestoreIfNewer,
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
  const wrote = writeMutation(state, envelope, applyOrigin);
  if (envelope.body.kind === 'delete') {
    // A delete a later restore outlives changes nothing that shows.
    return { status: wrote && isEntityDeleted(state) ? 'applied' : 'superseded-by-hlc' };
  }
  if (isEntityDeleted(state)) return { status: 'tombstoned' };
  return { status: wrote && isCurrentWrite(state, envelope.hlc) ? 'applied' : 'superseded-by-hlc' };
}

/** Write one mutation to the state. Returns whether a record it holds changed. */
function writeMutation(state: EntityState, envelope: MutationEnvelope, applyOrigin: FieldOrigin): boolean {
  const { body, hlc } = envelope;

  switch (body.kind) {
    case 'create': {
      // Record the earliest create so materialization can gate on it —
      // even when every leaf is superseded, the entity IS created.
      if (!state.createHlc || compareHlc(hlc, state.createHlc) < 0) {
        state.createHlc = hlc;
      }
      let any = body.restore === true && writeEntityRestoreIfNewer(state, hlc);
      for (const { path, value } of flattenToLeaves(body.payload)) {
        if (writeFieldIfNewer(state, path, value, hlc, applyOrigin)) any = true;
      }
      return any;
    }
    case 'delete':
      return writeEntityTombstone(state, hlc);
    case 'setField':
      return writeFieldIfNewer(state, body.path, body.value, hlc, applyOrigin);
    case 'unsetField':
      return writeFieldTombstoneIfNewer(state, body.path, hlc);
    case 'addToSet': {
      const added = writeSetAddIfNewer(state, body.path, body.itemId, body.item, hlc);
      // The order key is part of the envelope; if absent, default to
      // the seed. LWW per (setPath, itemId) — an explicit moveBefore
      // at a higher HLC overrides; a stale addToSet arriving after a
      // move can't reset.
      writeSetOrderIfNewer(state, body.path, body.itemId, body.orderKey ?? seedKey(), hlc);
      return added;
    }
    case 'removeFromSet':
      return writeSetTombstoneIfNewer(state, body.path, body.itemId, hlc);
    case 'moveBefore':
      // Writer-committed fractional-indexing key (§7.2 / §23.5).
      return writeSetOrderIfNewer(state, body.path, body.itemId, body.orderKey, hlc);
  }
}
