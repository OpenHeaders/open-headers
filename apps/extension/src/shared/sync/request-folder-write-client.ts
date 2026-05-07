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
import {
  buildCreateRequestFolderBatch,
  buildDeleteRequestFolderBatch,
  buildMoveRequestFolderBatch,
  buildRenameRequestFolderBatch,
} from '@/shared/sync/request-folder-mutations';

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

export async function applyRequestFolderDelete(
  input: ApplyRequestFolderDeleteInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
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
