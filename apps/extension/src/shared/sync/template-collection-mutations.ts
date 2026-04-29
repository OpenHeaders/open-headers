/**
 * Template-collection write-site → oracle helpers.
 *
 * Mirrors `request-collection-mutations.ts`. The catalog ships
 * rename-only at v1; `buildDeleteTemplateCollectionBatch` is the generic
 * delete envelope lifted here so the SW call site doesn't have to
 * assemble fields by hand — same shape as
 * `buildDeleteRequestCollectionBatch`.
 */

import {
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  newMutationId,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_MUTATOR_VERSION,
  renameTemplateCollection,
} from '@openheaders/core/sync';

export type TemplateCollectionMutationPayload = MutatorIntent;

/**
 * Build a `delete` envelope for a template collection. Generic primitive
 * — no dedicated catalog factory, identical shape across entities.
 */
export function buildDeleteTemplateCollectionBatch(
  collectionUid: string,
  ctx: MutatorContext,
): MutationBatch {
  return {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: [
      {
        mutationId: newMutationId(),
        hlc: ctx.hlc,
        origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
        workspaceId: ctx.workspaceId,
        mutatorVersion: TEMPLATE_COLLECTION_MUTATOR_VERSION,
        body: { kind: 'delete', type: TEMPLATE_COLLECTION_ENTITY_TYPE, id: collectionUid },
      },
    ],
  };
}

export interface RenameTemplateCollectionInput {
  collectionUid: string;
  name: string;
}

export function buildRenameTemplateCollectionBatch(
  input: RenameTemplateCollectionInput,
  ctx: MutatorContext,
): TemplateCollectionMutationPayload {
  return renameTemplateCollection(ctx, input);
}
