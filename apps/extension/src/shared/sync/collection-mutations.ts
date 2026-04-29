/**
 * Collection write-site → oracle helpers.
 *
 * Mirrors `env-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory
 * in `@openheaders/core/sync` and a {@link MutatorContext}. Pure
 * transforms — no oracle reads, no IO — used by both the SW
 * (boot-time hydration via the collection cache) and the renderer
 * (`useCollectionMutator` write client).
 */

import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_MUTATOR_VERSION,
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  newMutationId,
  removeCollectionVar,
  renameCollection,
  renameCollectionVar,
  setCollectionVar,
  setCollectionVarType,
  setDefaultEnvironmentId,
  setPinnedAndDefault,
  setPinnedEnvironments,
  type VariableType,
} from '@openheaders/core/sync';

export type CollectionMutationPayload = MutatorIntent;

/**
 * Build a `delete` envelope for a collection. The catalog doesn't ship
 * a dedicated factory because delete is the generic primitive — the
 * envelope shape is uniform across entities. Lifted here so the SW
 * call site doesn't have to assemble envelope fields by hand.
 */
export function buildDeleteCollectionBatch(collectionUid: string, ctx: MutatorContext): MutationBatch {
  return {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: [
      {
        mutationId: newMutationId(),
        hlc: ctx.hlc,
        origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
        workspaceId: ctx.workspaceId,
        mutatorVersion: COLLECTION_MUTATOR_VERSION,
        body: { kind: 'delete', type: COLLECTION_ENTITY_TYPE, id: collectionUid },
      },
    ],
  };
}

export interface SetCollectionVarInput {
  collectionUid: string;
  name: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildSetCollectionVarBatch(
  input: SetCollectionVarInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return setCollectionVar(ctx, input);
}

export interface RemoveCollectionVarInput {
  collectionUid: string;
  name: string;
}

export function buildRemoveCollectionVarBatch(
  input: RemoveCollectionVarInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return removeCollectionVar(ctx, input);
}

export interface RenameCollectionVarInput {
  collectionUid: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export function buildRenameCollectionVarBatch(
  input: RenameCollectionVarInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return renameCollectionVar(ctx, input);
}

export interface RenameCollectionInput {
  collectionUid: string;
  name: string;
}

export function buildRenameCollectionBatch(
  input: RenameCollectionInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return renameCollection(ctx, input);
}

export interface SetCollectionVarTypeInput {
  collectionUid: string;
  name: string;
  value: string;
  type: VariableType;
}

export function buildSetCollectionVarTypeBatch(
  input: SetCollectionVarTypeInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return setCollectionVarType(ctx, input);
}

export interface SetPinnedEnvironmentsInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
}

export function buildSetPinnedEnvironmentsBatch(
  input: SetPinnedEnvironmentsInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return setPinnedEnvironments(ctx, input);
}

export interface SetDefaultEnvironmentIdInput {
  collectionUid: string;
  defaultEnvironmentId: string | null;
}

export function buildSetDefaultEnvironmentIdBatch(
  input: SetDefaultEnvironmentIdInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return setDefaultEnvironmentId(ctx, input);
}

export interface SetPinnedAndDefaultInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

export function buildSetPinnedAndDefaultBatch(
  input: SetPinnedAndDefaultInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return setPinnedAndDefault(ctx, input);
}
