/**
 * Renderer-side imperative entry point for request-collection writes.
 *
 * Mirrors `collection-write-client.ts` but routed through the
 * request-collection entity type. Variables-replacement folds through
 * the shared {@link buildVariablesReplacement} helper so the diff math
 * lives in one place across every per-uid variable scope.
 */

import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import { type MutationEnvelope } from '@openheaders/core/sync';
import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
  requestCollectionInvalidateResolverIntent,
  type VariableType,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import {
  getActiveRequestCollectionSyncMirror,
  type RequestCollectionSyncMirror,
} from '@/context/request-collection-sync-mirror';
import {
  buildDeleteRequestCollectionBatch,
  buildRemoveRequestCollectionVarBatch,
  buildRenameRequestCollectionBatch,
  buildRenameRequestCollectionVarBatch,
  buildSetRequestCollectionVarBatch,
  buildSetRequestCollectionVarTypeBatch,
} from '@/shared/sync/request-collection-mutations';
import { buildVariablesReplacement } from '@/shared/sync/variables-replacement';

export { createRequestCollectionSyncMirror } from '@/context/request-collection-sync-mirror';

export type RequestCollectionSimpleResult = SyncSimpleResult;

export interface RequestCollectionWriteOptions extends BaseSyncWriteOptions {
  mirror?: RequestCollectionSyncMirror;
}

export interface ApplyRequestCollectionRenameInput {
  collectionUid: string;
  name: string;
}

export async function applyRequestCollectionRename(
  input: ApplyRequestCollectionRenameInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const mirror = resolveMirror(opts, getActiveRequestCollectionSyncMirror);
  if (!mirror.getRequestCollectionMirror(input.collectionUid)) {
    return { ok: false, reason: 'not-found' };
  }
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameRequestCollectionBatch(input, ctx));
}

export interface ApplyRequestCollectionDeleteInput {
  collectionUid: string;
}

export async function applyRequestCollectionDelete(
  input: ApplyRequestCollectionDeleteInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
    opts.batchId
      ? { batchId: opts.batchId }
      : { batchId: `request-collection-delete-${input.collectionUid}` },
  );
  return applySyncPayload({
    batch: buildDeleteRequestCollectionBatch(input.collectionUid, ctx),
    sideEffects: [],
  });
}

export interface ApplyRequestCollectionSetVarInput {
  requestCollectionUid: string;
  name: string;
  value: string;
  type?: VariableType;
}

export async function applyRequestCollectionSetVar(
  input: ApplyRequestCollectionSetVarInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetRequestCollectionVarBatch(input, ctx));
}

export interface ApplyRequestCollectionRemoveVarInput {
  requestCollectionUid: string;
  name: string;
}

export async function applyRequestCollectionRemoveVar(
  input: ApplyRequestCollectionRemoveVarInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveRequestCollectionVarBatch(input, ctx));
}

export interface ApplyRequestCollectionRenameVarInput {
  requestCollectionUid: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
}

export async function applyRequestCollectionRenameVar(
  input: ApplyRequestCollectionRenameVarInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameRequestCollectionVarBatch(input, ctx));
}

export interface ApplyRequestCollectionSetVarTypeInput {
  requestCollectionUid: string;
  name: string;
  value: string;
  type: VariableType;
}

export async function applyRequestCollectionSetVarType(
  input: ApplyRequestCollectionSetVarTypeInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetRequestCollectionVarTypeBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list. Adds + value/
 * type changes emit `addToSet`; deletions emit `removeFromSet`. Diff
 * shape lives in {@link buildVariablesReplacement} (shared across
 * per-uid variable scopes); empty input → `{ ok: true }` short-circuit.
 */
export async function applyRequestCollectionVariablesReplacement(
  collectionUid: string,
  newVars: readonly V5.Variable[],
  oldVars: readonly V5.Variable[],
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `request-collection-vars-replace-${collectionUid}`,
  });
  const payload = buildVariablesReplacement(
    {
      entityType: REQUEST_COLLECTION_ENTITY_TYPE,
      varsPath: REQUEST_COLLECTION_VARS_PATH,
      makeSideEffects: (uid, hlc) => [requestCollectionInvalidateResolverIntent(uid, hlc)],
    },
    ctx,
    { entityUid: collectionUid, newVars, oldVars },
  );
  if (!payload) return { ok: true };
  return applySyncPayload(payload);
}

export type { MutationEnvelope };
