/**
 * Request-collection write-site → oracle helpers.
 *
 * Mirrors `collection-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration via the request-collection cache) and the
 * renderer (`useRequestCollectionMutator` / variable write client).
 */

import {
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  newMutationId,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_MUTATOR_VERSION,
  removeRequestCollectionVar,
  renameRequestCollection,
  renameRequestCollectionVar,
  setRequestCollectionVar,
  setRequestCollectionVarType,
  type VariableType,
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

export interface SetRequestCollectionVarInput {
  requestCollectionUid: string;
  name: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildSetRequestCollectionVarBatch(
  input: SetRequestCollectionVarInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionVar(ctx, input);
}

export interface RemoveRequestCollectionVarInput {
  requestCollectionUid: string;
  name: string;
}

export function buildRemoveRequestCollectionVarBatch(
  input: RemoveRequestCollectionVarInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return removeRequestCollectionVar(ctx, input);
}

export interface RenameRequestCollectionVarInput {
  requestCollectionUid: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildRenameRequestCollectionVarBatch(
  input: RenameRequestCollectionVarInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return renameRequestCollectionVar(ctx, input);
}

export interface SetRequestCollectionVarTypeInput {
  requestCollectionUid: string;
  name: string;
  value: string;
  type: VariableType;
}

export function buildSetRequestCollectionVarTypeBatch(
  input: SetRequestCollectionVarTypeInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionVarType(ctx, input);
}
