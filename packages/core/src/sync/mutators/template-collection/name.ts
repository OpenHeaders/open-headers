/**
 * `renameTemplateCollection` — set the template collection's display name.
 *
 * Semantically `setField('name', _)`; named for awareness/UI clarity
 * the same way `renameCollection` is on rule collections.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { TEMPLATE_COLLECTION_ENTITY_TYPE } from './types';

export interface RenameTemplateCollectionArgs {
  collectionUid: string;
  name: string;
}

export function renameTemplateCollection(
  ctx: MutatorContext,
  args: RenameTemplateCollectionArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: TEMPLATE_COLLECTION_ENTITY_TYPE,
        id: args.collectionUid,
        path: 'name',
        value: args.name,
      },
    ]),
    sideEffects: [],
  };
}
