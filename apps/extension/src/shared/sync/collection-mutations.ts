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
  type MutatorContext,
  type MutatorIntent,
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
