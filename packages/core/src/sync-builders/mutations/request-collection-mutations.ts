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
  mintBatch,
  newBatchId,
  newMutationId,
  PRE_BOOTSTRAP_ORG_ID,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_MUTATOR_VERSION,
  removeRequestCollectionVar,
  renameRequestCollection,
  setRequestCollectionPinnedAndDefault,
  setRequestCollectionScripts,
  setRequestCollectionSpecLink,
  setRequestCollectionVar,
} from '@openheaders/core/sync';
import { synthesizeFieldDiff } from '@openheaders/core/sync-builders';
import type { AuthConfig, SpecLink, Variable } from '@openheaders/core/types';

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

export interface SetRequestCollectionPinnedAndDefaultInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

export function buildSetRequestCollectionPinnedAndDefaultBatch(
  input: SetRequestCollectionPinnedAndDefaultInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionPinnedAndDefault(ctx, input);
}

export interface SetRequestCollectionScriptsInput {
  collectionUid: string;
  /** Slot updates; `value: undefined` removes the slot. */
  updates: ReadonlyArray<{ path: 'preRequestScript' | 'postResponseScript'; value: string | undefined }>;
}

export function buildSetRequestCollectionScriptsBatch(
  input: SetRequestCollectionScriptsInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionScripts(ctx, input);
}

export interface SetRequestCollectionSpecLinkInput {
  collectionUid: string;
  /** New generation bookkeeping; `undefined` clears the link. */
  specLink: SpecLink | undefined;
}

/**
 * Whole-object `setField('specLink', …)` is deliberate here — unlike
 * auth, the field never rides a create payload (generation links a
 * collection AFTER it exists), so there are no flattened create-time
 * leaves to clobber; both members always change together.
 */
export function buildSetRequestCollectionSpecLinkBatch(
  input: SetRequestCollectionSpecLinkInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  return setRequestCollectionSpecLink(ctx, input);
}

export interface SetRequestCollectionAuthInput {
  collectionUid: string;
  /** New ancestor default auth; `undefined` clears the field (the
   *  level goes transparent — the inherit walk passes through it). */
  auth: AuthConfig | undefined;
  /** Current materialized auth — the per-leaf diff baseline. */
  currentAuth: AuthConfig | undefined;
}

/**
 * Ancestor auth rides create payloads flattened to per-leaf paths
 * (`auth.type`, …), so edits mirror that granularity through
 * {@link synthesizeFieldDiff} — a whole-object `setField('auth', …)`
 * would let the stale create-time discriminant clobber the edit at
 * materialize time (same trap `buildUpdateBatch` documents for
 * request auth). A no-op edit yields an empty batch; callers
 * short-circuit on it.
 */
export function buildSetRequestCollectionAuthBatch(
  input: SetRequestCollectionAuthInput,
  ctx: MutatorContext,
): RequestCollectionMutationPayload {
  const bodies = synthesizeFieldDiff({
    type: REQUEST_COLLECTION_ENTITY_TYPE,
    id: input.collectionUid,
    basePath: 'auth',
    oldValue: input.currentAuth,
    newValue: input.auth,
  });
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
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
