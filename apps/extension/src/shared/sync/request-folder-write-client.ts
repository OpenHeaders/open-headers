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
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import { type MutationEnvelope, type RequestFolderParentRef } from '@openheaders/core/sync';
import {
  getRequestFolderSyncMirrorForWorkspace,
  type RequestFolderSyncMirror,
} from '@/context/request-folder-sync-mirror';
import { getRequestSyncMirrorForWorkspace } from '@/context/request-sync-mirror';
import {
  buildCreateRequestFolderBatch,
  buildDeleteRequestFolderBatch,
  buildDeleteRequestFolderEntityBatch,
  buildMoveRequestFolderBatch,
  buildRenameRequestFolderBatch,
} from '@/shared/sync/request-folder-mutations';
import { buildDeleteBatch as buildDeleteRequestBatch } from '@/shared/sync/request-mutations';

export { createRequestFolderSyncMirror } from '@/context/request-folder-sync-mirror';

export type RequestFolderSimpleResult = SyncSimpleResult;

export interface RequestFolderWriteOptions extends BaseSyncWriteOptions {
  mirror?: RequestFolderSyncMirror;
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
  return applySyncPayload(buildCreateRequestFolderBatch(input, ctx));
}

export interface ApplyRequestFolderDeleteInput {
  folderUid: string;
  parent: RequestFolderParentRef;
}

/**
 * Delete a request-folder and cascade-delete every descendant request
 * + nested request-folder. Mirrors `request-store.deleteRequestFolder`
 * (legacy SW handler) so cascade is consistent across surfaces.
 *
 * The folder's tombstone covers its parent slot via the parent ref;
 * descendants ride bare delete envelopes. Each child + the parent is a
 * separate batch.
 */
export async function applyRequestFolderDelete(
  input: ApplyRequestFolderDeleteInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const folderMirror = resolveMirror(opts, getRequestFolderSyncMirrorForWorkspace);
  await folderMirror.hydrated;
  const folder = folderMirror.listRequestFolders().find((f) => f.uid === input.folderUid);
  if (!folder) return { ok: false, reason: 'not-found' };
  const childPathPrefix = `${folder.path}/`;

  const requestMirror = getRequestSyncMirrorForWorkspace(opts.workspaceId);
  await requestMirror.hydrated;

  const cascadingRequestUids = requestMirror
    .listRequests()
    .filter((r) => r.path.startsWith(childPathPrefix))
    .map((r) => r.uid);
  const cascadingFolderUids = folderMirror
    .listRequestFolders()
    .filter((f) => f.uid !== input.folderUid && f.path.startsWith(childPathPrefix))
    .map((f) => f.uid);

  const baseCtx = resolveRendererContext(opts);
  for (const reqUid of cascadingRequestUids) {
    const ctx = baseCtx.next({ batchId: `request-folder-delete-cascade-req-${reqUid}` });
    const ack = await applySyncPayload(buildDeleteRequestBatch(reqUid, ctx));
    if (!ack.ok) return ack;
  }
  for (const nestedUid of cascadingFolderUids) {
    const ctx = baseCtx.next({ batchId: `request-folder-delete-cascade-nested-${nestedUid}` });
    const ack = await applySyncPayload({
      batch: buildDeleteRequestFolderEntityBatch(nestedUid, ctx),
      sideEffects: [],
    });
    if (!ack.ok) return ack;
  }

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
