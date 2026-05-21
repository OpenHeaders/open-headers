/**
 * `renameRequestCollection` — set the request collection's display name.
 *
 * Semantically `setField('name', _)`; named for awareness/UI clarity
 * the same way `renameCollection` is on rule collections.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveRequestCollectionSideEffects } from './side-effects';
import { REQUEST_COLLECTION_ENTITY_TYPE } from './types';

export interface RenameRequestCollectionArgs {
  collectionUid: string;
  name: string;
}

export function renameRequestCollection(ctx: MutatorContext, args: RenameRequestCollectionArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: 'name',
      value: args.name,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveRequestCollectionSideEffects) };
}
