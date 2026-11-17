/**
 * A deleted entity back in the tree — its file returned under the uid
 * the engine deleted: a rollback or a revert of the deletion, a checkout
 * of a branch that still holds it, a stash popped, a foreign commit that
 * restores it.
 *
 * The engine's delete stands until a restore later than it (the sync
 * design §7.2): a plain create at that uid is answered `tombstoned` and
 * brings nothing back. The tree is the newest fact for an entity's
 * existence as it is for every field of it, so the create the delta
 * minted for such a uid is a restore — the entity lives again, started
 * over from its file.
 */

import type { MutationEnvelope } from '@openheaders/core/sync';
import type { EmissionBatch } from './workspace-import-emission';

/** Whether the engine holds `(type, id)` deleted. */
export type DeletedEntityReader = (type: string, id: string) => boolean;

export function restoreDeletedReturns(
  batches: readonly EmissionBatch[],
  isDeleted: DeletedEntityReader,
): EmissionBatch[] {
  const restoring = (envelope: MutationEnvelope): MutationEnvelope => {
    const { body } = envelope;
    if (body.kind !== 'create' || !isDeleted(body.type, body.id)) return envelope;
    return { ...envelope, body: { ...body, restore: true } };
  };
  return batches.map((entry) => {
    const mutations = entry.batch.mutations.map(restoring);
    if (mutations.every((envelope, index) => envelope === entry.batch.mutations[index])) return entry;
    return { ...entry, batch: { ...entry.batch, mutations } };
  });
}
