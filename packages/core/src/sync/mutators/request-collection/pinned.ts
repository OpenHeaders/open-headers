/**
 * `setRequestCollectionPinnedAndDefault` — pinned-envs + default-env
 * setter for request collections. Mirrors `collection/pinned.ts`
 * (rule-collection side): both fields are whole-value LWW `setField`s
 * on the scalar shell, committed in one batch so observers never see
 * "default cleared but pinned still old."
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveRequestCollectionSideEffects } from './side-effects';
import { REQUEST_COLLECTION_ENTITY_TYPE } from './types';

export interface SetRequestCollectionPinnedAndDefaultArgs {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

export function setRequestCollectionPinnedAndDefault(
  ctx: MutatorContext,
  args: SetRequestCollectionPinnedAndDefaultArgs,
): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'setField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: 'pinnedEnvironmentIds',
      value: [...args.pinnedEnvironmentIds],
    },
    {
      kind: 'setField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: 'defaultEnvironmentId',
      value: args.defaultEnvironmentId,
    },
  ];
  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(deriveRequestCollectionSideEffects) };
}
