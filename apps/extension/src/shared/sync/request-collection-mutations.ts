/**
 * Request-collection write-site → oracle helpers.
 *
 * Mirrors `collection-mutations.ts`. The catalog ships rename-only at
 * v1; `buildDeleteRequestCollectionBatch` is the generic delete envelope
 * lifted here so the SW call site doesn't have to assemble fields by
 * hand — same shape as `buildDeleteCollectionBatch` for rule
 * collections.
 */

import {
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  newMutationId,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_MUTATOR_VERSION,
  renameRequestCollection,
} from '@openheaders/core/sync';

export type RequestCollectionMutationPayload = MutatorIntent;

/**
 * Build a `delete` envelope for a request collection. Generic primitive
 * — no dedicated catalog factory, identical shape across entities.
 */
export function buildDeleteRequestCollectionBatch(
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
        mutatorVersion: REQUEST_COLLECTION_MUTATOR_VERSION,
        body: { kind: 'delete', type: REQUEST_COLLECTION_ENTITY_TYPE, id: collectionUid },
      },
    ],
  };
}

export interface RenameRequestCollectionInput {
  collectionUid: string;
  name: string;
}

export function buildRenameRequestCollectionBatch(
  input: RenameRequestCollectionInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return renameRequestCollection(ctx, input);
}
