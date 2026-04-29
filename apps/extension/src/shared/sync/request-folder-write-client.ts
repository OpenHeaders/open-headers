/**
 * Renderer-side imperative entry point for request-folder writes.
 *
 * Mirrors `folder-write-client.ts` but routed through the
 * request-folder entity type. Catalog factories already model the
 * cross-entity batches (folder entity + parent slot for create/delete;
 * intra-parent moveBefore vs. cross-parent reparent for move) — the
 * write client is a thin wire layer on top.
 */

import { type MutationEnvelope, type RequestFolderParentRef } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  getActiveRequestFolderSyncMirror,
  type RequestFolderSyncMirror,
} from '@/context/request-folder-sync-mirror';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  buildCreateRequestFolderBatch,
  buildDeleteRequestFolderBatch,
  buildMoveRequestFolderBatch,
  buildRenameRequestFolderBatch,
  type RequestFolderMutationPayload,
} from '@/shared/sync/request-folder-mutations';

export { createRequestFolderSyncMirror } from '@/context/request-folder-sync-mirror';

export type RequestFolderSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface RequestFolderWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: RequestFolderSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: RequestFolderWriteOptions): RequestFolderSyncMirror {
  return opts.mirror ?? getActiveRequestFolderSyncMirror();
}

function resolveContext(opts: RequestFolderWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(
  payload: RequestFolderMutationPayload,
): Promise<RequestFolderSimpleResult> {
  if (payload.batch.mutations.length === 0) return { ok: true };
  try {
    const resp = await call('oh.sync.apply', {
      batch: payload.batch,
      sideEffects: payload.sideEffects,
    });
    if (resp.ok) return { ok: true };
    return { ok: false, reason: 'other', message: resp.failure?.detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, reason: 'other', message };
  }
}

export interface ApplyRequestFolderRenameInput {
  folderUid: string;
  name: string;
}

export async function applyRequestFolderRename(
  input: ApplyRequestFolderRenameInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getRequestFolderMirror(input.folderUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildRenameRequestFolderBatch(input, ctx));
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
  const ctx = resolveContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `request-folder-create-${input.folderUid}` },
  );
  return applyPayload(buildCreateRequestFolderBatch(input, ctx));
}

export interface ApplyRequestFolderDeleteInput {
  folderUid: string;
  parent: RequestFolderParentRef;
}

export async function applyRequestFolderDelete(
  input: ApplyRequestFolderDeleteInput,
  opts: RequestFolderWriteOptions,
): Promise<RequestFolderSimpleResult> {
  const ctx = resolveContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `request-folder-delete-${input.folderUid}` },
  );
  return applyPayload(buildDeleteRequestFolderBatch(input, ctx));
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
  const ctx = resolveContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `request-folder-move-${input.folderUid}` },
  );
  return applyPayload(buildMoveRequestFolderBatch(input, ctx));
}

export type { MutationEnvelope };
