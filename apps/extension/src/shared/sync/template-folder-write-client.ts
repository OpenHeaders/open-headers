/**
 * Renderer-side imperative entry point for template-folder writes.
 *
 * Mirrors `request-folder-write-client.ts` but routed through the
 * template-folder entity type.
 */

import { type MutationEnvelope, type TemplateFolderParentRef } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  getActiveTemplateFolderSyncMirror,
  type TemplateFolderSyncMirror,
} from '@/context/template-folder-sync-mirror';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/rule-mutator-context';
import {
  buildCreateTemplateFolderBatch,
  buildDeleteTemplateFolderBatch,
  buildMoveTemplateFolderBatch,
  buildRenameTemplateFolderBatch,
  type TemplateFolderMutationPayload,
} from '@/shared/sync/template-folder-mutations';

export { createTemplateFolderSyncMirror } from '@/context/template-folder-sync-mirror';

export type TemplateFolderSimpleResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface TemplateFolderWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: TemplateFolderSyncMirror;
  context?: RendererContextHandle;
}

function resolveMirror(opts: TemplateFolderWriteOptions): TemplateFolderSyncMirror {
  return opts.mirror ?? getActiveTemplateFolderSyncMirror();
}

function resolveContext(opts: TemplateFolderWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

async function applyPayload(
  payload: TemplateFolderMutationPayload,
): Promise<TemplateFolderSimpleResult> {
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

export interface ApplyTemplateFolderRenameInput {
  folderUid: string;
  name: string;
}

export async function applyTemplateFolderRename(
  input: ApplyTemplateFolderRenameInput,
  opts: TemplateFolderWriteOptions,
): Promise<TemplateFolderSimpleResult> {
  const mirror = resolveMirror(opts);
  if (!mirror.getTemplateFolderMirror(input.folderUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applyPayload(buildRenameTemplateFolderBatch(input, ctx));
}

export interface ApplyTemplateFolderCreateInput {
  folderUid: string;
  parent: TemplateFolderParentRef;
  name: string;
  pathSegment?: string;
  orderKey?: string;
}

export async function applyTemplateFolderCreate(
  input: ApplyTemplateFolderCreateInput,
  opts: TemplateFolderWriteOptions,
): Promise<TemplateFolderSimpleResult> {
  const ctx = resolveContext(opts).next(
    opts.batchId
      ? { batchId: opts.batchId }
      : { batchId: `template-folder-create-${input.folderUid}` },
  );
  return applyPayload(buildCreateTemplateFolderBatch(input, ctx));
}

export interface ApplyTemplateFolderDeleteInput {
  folderUid: string;
  parent: TemplateFolderParentRef;
}

export async function applyTemplateFolderDelete(
  input: ApplyTemplateFolderDeleteInput,
  opts: TemplateFolderWriteOptions,
): Promise<TemplateFolderSimpleResult> {
  const ctx = resolveContext(opts).next(
    opts.batchId
      ? { batchId: opts.batchId }
      : { batchId: `template-folder-delete-${input.folderUid}` },
  );
  return applyPayload(buildDeleteTemplateFolderBatch(input, ctx));
}

export interface ApplyTemplateFolderMoveInput {
  folderUid: string;
  newParent: TemplateFolderParentRef;
  orderKey: string;
  oldParent?: TemplateFolderParentRef;
}

export async function applyTemplateFolderMove(
  input: ApplyTemplateFolderMoveInput,
  opts: TemplateFolderWriteOptions,
): Promise<TemplateFolderSimpleResult> {
  const ctx = resolveContext(opts).next(
    opts.batchId
      ? { batchId: opts.batchId }
      : { batchId: `template-folder-move-${input.folderUid}` },
  );
  return applyPayload(buildMoveTemplateFolderBatch(input, ctx));
}

export type { MutationEnvelope };
