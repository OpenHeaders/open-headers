/**
 * `renameCollection` — set the collection's display name.
 *
 * Semantically `setField('name', _)`; named for awareness/UI clarity
 * the same way `toggleEnabled` is on rules and `renameEnvironment` is
 * on environments.
 *
 * Side effects route through `deriveCollectionSideEffects` so the
 * "mutator side-effects = derive(envelope)" invariant holds for every
 * body kind. A rename derives no intents — but routing through the
 * shared derivation keeps mint-side and receive-side from drifting.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveCollectionSideEffects } from './side-effects';
import { COLLECTION_ENTITY_TYPE } from './types';

export interface RenameCollectionArgs {
  collectionUid: string;
  name: string;
}

export function renameCollection(ctx: MutatorContext, args: RenameCollectionArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    { kind: 'setField', type: COLLECTION_ENTITY_TYPE, id: args.collectionUid, path: 'name', value: args.name },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveCollectionSideEffects) };
}
