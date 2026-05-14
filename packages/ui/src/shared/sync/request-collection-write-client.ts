/**
 * Renderer-side imperative entry point for request-collection writes.
 *
 * Mirrors `collection-write-client.ts` but routed through the
 * request-collection entity type. Identity for variable rows is
 * `variable.uid`; variables-replacement folds through the shared
 * {@link buildVariablesReplacement} helper.
 */

import { MIN_SCHEMA_VERSION } from '@openheaders/core/schemas';
import {
  type MutationEnvelope,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
  requestCollectionInvalidateResolverIntent,
} from '@openheaders/core/sync';
import type { Collection, Variable } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import {
  getRequestCollectionSyncMirrorForWorkspace,
  type RequestCollectionSyncMirror,
} from '../../context/request-collection-sync-mirror';
import { getRequestFolderSyncMirrorForWorkspace } from '../../context/request-folder-sync-mirror';
import { getRequestSyncMirrorForWorkspace } from '../../context/request-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import {
  buildDeleteRequestCollectionBatch,
  buildRemoveRequestCollectionVarBatch,
  buildRenameRequestCollectionBatch,
  buildSetRequestCollectionVarBatch,
} from '@openheaders/core/sync-builders/request-collection-mutations';
import { seedRequestCollection } from '@openheaders/core/sync-builders/request-collection-projection';
import { buildDeleteRequestFolderEntityBatch } from '@openheaders/core/sync-builders/request-folder-mutations';
import { buildDeleteBatch as buildDeleteRequestBatch } from '@openheaders/core/sync-builders/request-mutations';
import { buildVariablesReplacement } from '@openheaders/core/sync-builders';

export { createRequestCollectionSyncMirror } from '../../context/request-collection-sync-mirror';

export type RequestCollectionSimpleResult = SyncSimpleResult;

export interface RequestCollectionWriteOptions extends BaseSyncWriteOptions {
  mirror?: RequestCollectionSyncMirror;
}

/**
 * Renderer-direct request-collection create. Mints uid + path locally,
 * builds the seed batch, and fires `oh.sync.apply` against the workspace
 * carried on `opts`. Mirrors `applyCollectionCreate`.
 */
export type RequestCollectionMutationResult =
  | { ok: true; collection: Collection }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface ApplyRequestCollectionCreateInput {
  name: string;
}

export async function applyRequestCollectionCreate(
  input: ApplyRequestCollectionCreateInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionMutationResult> {
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const collection: Collection = {
    schemaVersion: MIN_SCHEMA_VERSION,
    uid,
    path: `requests/${folderName}`,
    name: input.name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const ack = await applySyncPayload({ batch: seedRequestCollection(collection, ctx), sideEffects: [] });
  if (ack.ok) return { ok: true, collection };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export interface ApplyRequestCollectionRenameInput {
  collectionUid: string;
  name: string;
}

export async function applyRequestCollectionRename(
  input: ApplyRequestCollectionRenameInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const mirror = resolveMirror(opts, getRequestCollectionSyncMirrorForWorkspace);
  if (!mirror.getRequestCollectionMirror(input.collectionUid)) {
    return { ok: false, reason: 'not-found' };
  }
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameRequestCollectionBatch(input, ctx));
}

export interface ApplyRequestCollectionDeleteInput {
  collectionUid: string;
}

/**
 * Delete a request-collection and cascade-delete every descendant
 * request + request-folder. Cascade walks the per-workspace request
 * and request-folder mirrors, finds path-prefixed descendants, and
 * issues a delete envelope per descendant before tombstoning the
 * collection itself. Mirrors `request-store.deleteRequestCollection`
 * (the legacy SW handler) so the cascade is consistent regardless of
 * which surface authored the gesture.
 *
 * Each child + the parent ride a separate batch (`oh.sync.apply`
 * round-trip per envelope) — matches the SW legacy pattern. Per-child
 * atomicity is enough for cache + projection consistency; the
 * collection's tombstone arriving last guarantees the sidebar tree
 * never shows an orphan with its parent already gone.
 */
export async function applyRequestCollectionDelete(
  input: ApplyRequestCollectionDeleteInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const collectionMirror = resolveMirror(opts, getRequestCollectionSyncMirrorForWorkspace);
  await collectionMirror.hydrated;
  const collectionEntry = collectionMirror.getRequestCollectionMirror(input.collectionUid);
  if (!collectionEntry) return { ok: false, reason: 'not-found' };
  const collectionPath = collectionEntry.collection.path;
  const childPathPrefix = `${collectionPath}/`;

  const requestMirror = getRequestSyncMirrorForWorkspace(opts.workspaceId);
  const requestFolderMirror = getRequestFolderSyncMirrorForWorkspace(opts.workspaceId);
  await Promise.all([requestMirror.hydrated, requestFolderMirror.hydrated]);

  const cascadingRequestUids = requestMirror
    .listRequests()
    .filter((r) => r.path.startsWith(childPathPrefix))
    .map((r) => r.uid);
  const cascadingFolderUids = requestFolderMirror
    .listRequestFolders()
    .filter((f) => f.path.startsWith(childPathPrefix))
    .map((f) => f.uid);

  const baseCtx = resolveRendererContext(opts);
  for (const reqUid of cascadingRequestUids) {
    const ctx = baseCtx.next({ batchId: `request-collection-delete-cascade-req-${reqUid}` });
    const ack = await applySyncPayload(buildDeleteRequestBatch(reqUid, ctx));
    if (!ack.ok) return ack;
  }
  for (const folderUid of cascadingFolderUids) {
    const ctx = baseCtx.next({ batchId: `request-collection-delete-cascade-folder-${folderUid}` });
    const ack = await applySyncPayload({
      batch: buildDeleteRequestFolderEntityBatch(folderUid, ctx),
      sideEffects: [],
    });
    if (!ack.ok) return ack;
  }

  const ctx = baseCtx.next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `request-collection-delete-${input.collectionUid}` },
  );
  return applySyncPayload({
    batch: buildDeleteRequestCollectionBatch(input.collectionUid, ctx),
    sideEffects: [],
  });
}

export interface ApplyRequestCollectionSetVarInput {
  requestCollectionUid: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
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
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export async function applyRequestCollectionRemoveVar(
  input: ApplyRequestCollectionRemoveVarInput,
  opts: RequestCollectionWriteOptions,
): Promise<RequestCollectionSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveRequestCollectionVarBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list keyed by uid.
 * Diff shape lives in {@link buildVariablesReplacement}; empty input →
 * `{ ok: true }` short-circuit.
 */
export async function applyRequestCollectionVariablesReplacement(
  collectionUid: string,
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
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
