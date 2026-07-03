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
  deriveSideEffectsForEnvelope,
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  newMutationId,
  PRE_BOOTSTRAP_ORG_ID,
  removeCollectionVar,
  renameCollection,
  setCollectionVar,
  setDefaultEnvironmentId,
  setPinnedAndDefault,
  setPinnedEnvironments,
} from '@openheaders/core/sync';
import type { Variable } from '@openheaders/core/types';

export type CollectionMutationPayload = MutatorIntent;

/**
 * Build a `delete` envelope for a collection. The catalog doesn't ship
 * a dedicated factory because delete is the generic primitive — the
 * envelope shape is uniform across entities. Lifted here so the SW
 * call site doesn't have to assemble envelope fields by hand.
 *
 * Deleting a collection drops its variables from resolver scope, so the
 * payload carries the `INVALIDATE_RESOLVER` side effect — single-sourced
 * through {@link deriveSideEffectsForEnvelope} so the deleting host's
 * own resolver cache flushes, exactly as a peer's does on receive.
 */
export function buildDeleteCollectionBatch(collectionUid: string, ctx: MutatorContext): CollectionMutationPayload {
  const batch: MutationBatch = {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: [
      {
        mutationId: newMutationId(),
        hlc: ctx.hlc,
        origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
        workspaceId: ctx.workspaceId,
        orgId: ctx.orgId ?? PRE_BOOTSTRAP_ORG_ID,
        mutatorVersion: COLLECTION_MUTATOR_VERSION,
        body: { kind: 'delete', type: COLLECTION_ENTITY_TYPE, id: collectionUid },
      },
    ],
  };
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}

export interface SetCollectionVarInput {
  collectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
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
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function buildRemoveCollectionVarBatch(
  input: RemoveCollectionVarInput,
  ctx: MutatorContext,
): CollectionMutationPayload {
  return removeCollectionVar(ctx, input);
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
