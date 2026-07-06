/**
 * `setTemplateCollectionPinnedAndDefault` — pinned-envs + default-env
 * setter for template collections. Mirrors `collection/pinned.ts`
 * (rule-collection side): both fields are whole-value LWW `setField`s
 * on the scalar shell, committed in one batch so observers never see
 * "default cleared but pinned still old."
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveTemplateCollectionSideEffects } from './side-effects';
import { TEMPLATE_COLLECTION_ENTITY_TYPE } from './types';

export interface SetTemplateCollectionPinnedAndDefaultArgs {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

export function setTemplateCollectionPinnedAndDefault(
  ctx: MutatorContext,
  args: SetTemplateCollectionPinnedAndDefaultArgs,
): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'setField',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: 'pinnedEnvironmentIds',
      value: [...args.pinnedEnvironmentIds],
    },
    {
      kind: 'setField',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: 'defaultEnvironmentId',
      value: args.defaultEnvironmentId,
    },
  ];
  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(deriveTemplateCollectionSideEffects) };
}
