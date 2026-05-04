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
 * Identity for variable rows is `variable.uid`. `applyCollectionSetVar`
 * upserts the whole record (handles add, edit, rename, type-toggle
 * uniformly); `applyCollectionRemoveVar` keys by uid;
 * `applyCollectionVariablesReplacement` diffs two lists by uid via the
 * shared helper.
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
} from '@openheaders/core/sync';
import {
  type CollectionSyncMirror,
  createCollectionSyncMirror,
} from '@/context/collection-sync-mirror';
import {
  buildRemoveCollectionVarBatch,
  buildRenameCollectionBatch,
  buildSetCollectionVarBatch,
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
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: V5.Variable;
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
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export async function applyCollectionRemoveVar(
  input: ApplyCollectionRemoveVarInput,
  opts: CollectionWriteOptions,
): Promise<CollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveCollectionVarBatch(input, ctx));
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
 * Editor convenience: persist a complete variables list keyed by uid.
 * Diff shape lives in {@link buildVariablesReplacement}; empty input →
 * `{ ok: true }` short-circuit without firing.
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
