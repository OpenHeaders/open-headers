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
  deriveSideEffectsForEnvelope,
  type MutationBatch,
  type MutatorContext,
  type MutatorIntent,
  newBatchId,
  newMutationId,
  PRE_BOOTSTRAP_ORG_ID,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_MUTATOR_VERSION,
  removeRequestCollectionVar,
  renameRequestCollection,
  setRequestCollectionVar,
} from '@openheaders/core/sync';
import type { Variable } from '@openheaders/core/types';

export type RequestCollectionMutationPayload = MutatorIntent;

/**
 * Build a `delete` envelope for a request collection. Generic primitive
 * — no dedicated catalog factory, identical shape across entities.
 *
 * Deleting a request collection drops its variables from resolver
 * scope, so the payload carries the `INVALIDATE_RESOLVER` side effect —
 * single-sourced through {@link deriveSideEffectsForEnvelope} so the
 * deleting host's own resolver cache flushes, as a peer's does on
 * receive.
 */
export function buildDeleteRequestCollectionBatch(
  collectionUid: string,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  const batch: MutationBatch = {
    batchId: ctx.batchId ?? newBatchId(),
    mutations: [
      {
        mutationId: newMutationId(),
        hlc: ctx.hlc,
        origin: { surfaceId: ctx.surfaceId, deviceId: ctx.deviceId, userId: ctx.userId },
        workspaceId: ctx.workspaceId,
        orgId: ctx.orgId ?? PRE_BOOTSTRAP_ORG_ID,
        mutatorVersion: REQUEST_COLLECTION_MUTATOR_VERSION,
        body: { kind: 'delete', type: REQUEST_COLLECTION_ENTITY_TYPE, id: collectionUid },
      },
    ],
  };
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
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
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
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
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function buildRemoveRequestCollectionVarBatch(
  input: RemoveRequestCollectionVarInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return removeRequestCollectionVar(ctx, input);
}
