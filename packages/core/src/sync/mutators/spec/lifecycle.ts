/**
 * `deleteSpec` — spec entity lifecycle. Creation goes through the seed
 * builder (`sync-builders/projections/spec-projection.ts`): the create
 * payload is the scalar shell and every file lands as an `addToSet`,
 * so there is no whole-entity create factory here (same posture as
 * environments).
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { SPEC_ENTITY_TYPE } from './types';

export interface DeleteSpecArgs {
  specUid: string;
}

/** Delete a spec. Tombstone is permanent under §7.2 delete-wins. */
export function deleteSpec(ctx: MutatorContext, args: DeleteSpecArgs): MutatorIntent {
  const batch = mintBatch(ctx, [{ kind: 'delete', type: SPEC_ENTITY_TYPE, id: args.specUid }]);
  return { batch, sideEffects: [] };
}
