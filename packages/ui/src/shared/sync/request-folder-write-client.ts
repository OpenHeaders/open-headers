/**
 * Renderer-side imperative entry point for request-folder writes.
 *
 * Mirrors `folder-write-client.ts` but routed through the
 * request-folder entity type. Catalog factories already model the
 * cross-entity batches (folder entity + parent slot for create/delete;
 * intra-parent moveBefore vs. cross-parent reparent for move) — the
 * write client is a thin wire layer on top.
 */

import {
  type MutationEnvelope,
  REQUEST_FOLDER_AUTHS_PATH,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
  REQUEST_FOLDER_TREE_KINDS,
  type RequestFolderParentRef,
} from '@openheaders/core/sync';
import {
  buildCreateRequestFolderBatch,
  buildDeleteRequestFolderBatch,
  buildMoveRequestFolderBatch,
  buildRenameRequestFolderBatch,
  buildSetRequestFolderAuthPoolBatch,
  buildSetRequestFolderScriptsBatch,
  type SetRequestFolderScriptsInput,
} from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import type { AuthPoolEntry } from '@openheaders/core/types';
import {
  getRequestCollectionSyncMirrorForWorkspace,
  type RequestCollectionSyncMirror,
} from '../../context/mirrors/request-collection-sync-mirror';
import {
  getRequestFolderSyncMirrorForWorkspace,
  type RequestFolderSyncMirror,
} from '../../context/mirrors/request-folder-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import {
  applyRequestTreeDescendantDeletes,
  type RequestTreeMirrorOverrides,
  requestTreeDescendants,
} from './tree-descendants';
import { appendChildKey, requestTreeMirrors } from './tree-placement';

export { createRequestFolderSyncMirror } from '../../context/mirrors/request-folder-sync-mirror';

export type RequestFolderSimpleResult = SyncSimpleResult;

export interface RequestFolderWriteOptions extends BaseSyncWriteOptions, RequestTreeMirrorOverrides {
  mirror?: RequestFolderSyncMirror;
  /** The tree's collection mirror — read for a create's append key and walked by a delete's cascade (test override). */
  collectionMirror?: RequestCollectionSyncMirror;
}

export interface ApplyRequestFolderRenameInput {
  folderUid: string;
  name: string;
}

export async function applyRequestFolderRename(
  input: ApplyRequestFolderRenameInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const mirror = resolveMirror(opts, getRequestFolderSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getRequestFolderMirror(input.folderUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameRequestFolderBatch(input, ctx));
}

export interface ApplyRequestFolderCreateInput {
  folderUid: string;
  parent: RequestFolderParentRef;
  name: string;
  orderKey?: string;
}

export async function applyRequestFolderCreate(
  input: ApplyRequestFolderCreateInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `request-folder-create-${input.folderUid}` },
  );
  // A container's children are one order: a new folder lands after
  // the last child of any kind, as a new leaf does.
  const tree = {
    kinds: REQUEST_FOLDER_TREE_KINDS,
    childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
    itemsPath: REQUEST_FOLDER_ITEMS_PATH,
    collectionMirror: opts.collectionMirror ?? getRequestCollectionSyncMirrorForWorkspace(opts.workspaceId),
    folderMirror: resolveMirror(opts, getRequestFolderSyncMirrorForWorkspace),
  };
  await Promise.all([tree.collectionMirror.hydrated, tree.folderMirror.hydrated]);
  const orderKey = input.orderKey ?? appendChildKey(tree, input.parent);
  return applySyncPayload(buildCreateRequestFolderBatch({ ...input, orderKey }, ctx));
}

export type ApplyRequestFolderSetScriptsInput = SetRequestFolderScriptsInput;

/** Persist the folder's ancestor script slots (both in one batch).
 *  `value: undefined` clears a slot — field absent ↔ no script. */
export async function applyRequestFolderSetScripts(
  input: ApplyRequestFolderSetScriptsInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const mirror = resolveMirror(opts, getRequestFolderSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getRequestFolderMirror(input.folderUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `request-folder-scripts-${input.folderUid}`,
  });
  return applySyncPayload(buildSetRequestFolderScriptsBatch(input, ctx));
}

export interface ApplyRequestFolderSetAuthPoolInput {
  folderUid: string;
  /** The whole pool; empty with no default = the level goes transparent. */
  auths: readonly AuthPoolEntry[];
  defaultAuthUid: string | undefined;
}

/** Persist the folder's auth pool — see `applyRequestCollectionSetAuthPool`. */
export async function applyRequestFolderSetAuthPool(
  input: ApplyRequestFolderSetAuthPoolInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const mirror = resolveMirror(opts, getRequestFolderSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getRequestFolderMirror(input.folderUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const currentKeys = new Map(
    mirror.liveOrderedSetItems(input.folderUid, REQUEST_FOLDER_AUTHS_PATH).map((e) => [e.itemId, e.orderKey] as const),
  );
  const ctx = resolveRendererContext(opts).next({
    batchId: opts.batchId ?? `request-folder-auth-${input.folderUid}`,
  });
  const payload = buildSetRequestFolderAuthPoolBatch(
    {
      folderUid: input.folderUid,
      auths: input.auths,
      defaultAuthUid: input.defaultAuthUid,
      current: entry.folder,
      currentKeys,
    },
    ctx,
  );
  if (payload.batch.mutations.length === 0) return { ok: true };
  return applySyncPayload(payload);
}

export interface ApplyRequestFolderDeleteInput {
  folderUid: string;
  parent: RequestFolderParentRef;
}

/**
 * Delete a request-folder and everything under it. The cascade walks
 * the parent-owned sets (`tree-descendants.ts`) — every request kind,
 * nested folders deepest-first — and tombstones each on its own batch
 * before the folder's own; mirrors the SW store's `deleteRequestFolder`
 * so the gesture lands the same from either surface. The folder's
 * tombstone covers its parent slot via the parent ref.
 */
export async function applyRequestFolderDelete(
  input: ApplyRequestFolderDeleteInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const folderMirror = resolveMirror(opts, getRequestFolderSyncMirrorForWorkspace);
  await folderMirror.hydrated;
  if (!folderMirror.getRequestFolderMirror(input.folderUid)) return { ok: false, reason: 'not-found' };

  const tree = requestTreeMirrors(opts.workspaceId, { collectionMirror: opts.collectionMirror, folderMirror });
  const descendants = await requestTreeDescendants(tree, opts.workspaceId, opts, {
    type: REQUEST_FOLDER_ENTITY_TYPE,
    uid: input.folderUid,
  });
  const baseCtx = resolveRendererContext(opts);
  const cascade = await applyRequestTreeDescendantDeletes(descendants, baseCtx, 'request-folder-delete-cascade');
  if (!cascade.ok) return cascade;

  const ctx = baseCtx.next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `request-folder-delete-${input.folderUid}` },
  );
  return applySyncPayload(buildDeleteRequestFolderBatch(input, ctx));
}

export interface ApplyRequestFolderMoveInput {
  folderUid: string;
  newParent: RequestFolderParentRef;
  orderKey: string;
  oldParent?: RequestFolderParentRef;
}

export async function applyRequestFolderMove(
  input: ApplyRequestFolderMoveInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `request-folder-move-${input.folderUid}` },
  );
  return applySyncPayload(buildMoveRequestFolderBatch(input, ctx));
}

export type { MutationEnvelope };
