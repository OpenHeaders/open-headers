/**
 * Renderer-side imperative entry point for Collection writes.
 *
 * Mirrors `env-write-client.ts`. Every helper builds a
 * `MutationBatch` against the active collection mirror and fires
 * `oh.sync.apply` directly — no SW round-trip per primitive, no
 * `updateCollectionVariables` shim. The §19.4 synchronous-render
 * discipline lives in the editor; this module is what the editor
 * reaches for once the user commits.
 *
 * `applyCollectionVariablesReplacement` is the editor convenience:
 * take the editor's pre-image (`oldVars`) + post-image (`newVars`)
 * and fold them into the catalog primitives — diff is `setCollectionVar`
 * for adds/changes and `removeCollectionVar` for deletions, all
 * bundled under one `batchId`.
 */

import type { V5 } from '@openheaders/core/types';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import type { MutationEnvelope } from '@openheaders/core/sync';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  collectionInvalidateResolverIntent,
  type VariableType,
} from '@openheaders/core/sync';
import {
  type CollectionSyncMirror,
  createCollectionSyncMirror,
} from '@/context/collection-sync-mirror';
import {
  buildRemoveCollectionVarBatch,
  buildRenameCollectionBatch,
  buildRenameCollectionVarBatch,
  buildSetCollectionVarBatch,
  buildSetCollectionVarTypeBatch,
  buildSetDefaultEnvironmentIdBatch,
  buildSetPinnedAndDefaultBatch,
  buildSetPinnedEnvironmentsBatch,
} from '@/shared/sync/collection-mutations';
import { buildVariablesReplacement } from '@/shared/sync/variables-replacement';

export { createCollectionSyncMirror } from '@/context/collection-sync-mirror';

export type CollectionSimpleResult = SyncSimpleResult;

export interface CollectionWriteOptions extends BaseSyncWriteOptions {
  mirror?: CollectionSyncMirror;
}

export interface ApplyCollectionSetVarInput {
  collectionUid: string;
  name: string;
  value: string;
  type?: VariableType;
}

export async function applyCollectionSetVar(
  input: ApplyCollectionSetVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetCollectionVarBatch(input, ctx));
}

export interface ApplyCollectionRemoveVarInput {
  collectionUid: string;
  name: string;
}

export async function applyCollectionRemoveVar(
  input: ApplyCollectionRemoveVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveCollectionVarBatch(input, ctx));
}

export interface ApplyCollectionRenameVarInput {
  collectionUid: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
}

export async function applyCollectionRenameVar(
  input: ApplyCollectionRenameVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameCollectionVarBatch(input, ctx));
}

export interface ApplyCollectionSetVarTypeInput {
  collectionUid: string;
  name: string;
  value: string;
  type: VariableType;
}

export async function applyCollectionSetVarType(
  input: ApplyCollectionSetVarTypeInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetCollectionVarTypeBatch(input, ctx));
}

export interface ApplyRenameCollectionInput {
  collectionUid: string;
  name: string;
}

export async function applyRenameCollection(
  input: ApplyRenameCollectionInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameCollectionBatch(input, ctx));
}

export interface ApplySetPinnedEnvironmentsInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
}

export async function applySetPinnedEnvironments(
  input: ApplySetPinnedEnvironmentsInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetPinnedEnvironmentsBatch(input, ctx));
}

export interface ApplySetDefaultEnvironmentIdInput {
  collectionUid: string;
  defaultEnvironmentId: string | null;
}

export async function applySetDefaultEnvironmentId(
  input: ApplySetDefaultEnvironmentIdInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetDefaultEnvironmentIdBatch(input, ctx));
}

export interface ApplySetPinnedAndDefaultInput {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

export async function applySetPinnedAndDefault(
  input: ApplySetPinnedAndDefaultInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `coll-pinned-${input.collectionUid}`,
  });
  return applySyncPayload(buildSetPinnedAndDefaultBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list. Adds + value/
 * type changes emit `addToSet`; deletions emit `removeFromSet`. Diff
 * shape lives in {@link buildVariablesReplacement} (shared across
 * per-uid variable scopes); empty input → `{ ok: true }` short-circuit
 * without firing.
 */
export async function applyCollectionVariablesReplacement(
  collectionUid: string,
  newVars: readonly V5.Variable[],
  oldVars: readonly V5.Variable[],
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `coll-replace-${collectionUid}` });
  const payload = buildVariablesReplacement(
    {
      entityType: COLLECTION_ENTITY_TYPE,
      varsPath: COLLECTION_VARS_PATH,
      makeSideEffects: (uid, hlc) => [collectionInvalidateResolverIntent(uid, hlc)],
    },
    ctx,
    { entityUid: collectionUid, newVars, oldVars },
  );
  if (!payload) return { ok: true };
  return applySyncPayload(payload);
}

export type { MutationEnvelope };
