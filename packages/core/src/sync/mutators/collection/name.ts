/**
 * `renameCollection` — set the collection's display name.
 *
 * Semantically `setField('name', _)`; named for awareness/UI clarity
 * the same way `toggleEnabled` is on rules and `renameEnvironment` is
 * on environments.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { COLLECTION_ENTITY_TYPE } from './types';

export interface RenameCollectionArgs {
  collectionUid: string;
  name: string;
}

export function renameCollection(ctx: MutatorContext, args: RenameCollectionArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      { kind: 'setField', type: COLLECTION_ENTITY_TYPE, id: args.collectionUid, path: 'name', value: args.name },
    ]),
    sideEffects: [],
  };
}
