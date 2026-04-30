/**
 * Renderer-side imperative entry point for template-folder writes.
 *
 * Mirrors `request-folder-write-client.ts` but routed through the
 * template-folder entity type.
 */

import { applySyncPayload, type SyncSimpleResult } from '@/shared/sync/apply-payload';
import { type MutationEnvelope, type TemplateFolderParentRef } from '@openheaders/core/sync';
import {
  getActiveTemplateFolderSyncMirror,
  type TemplateFolderSyncMirror,
} from '@/context/template-folder-sync-mirror';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/renderer-mutator-context';
import {
  buildCreateTemplateFolderBatch,
  buildDeleteTemplateFolderBatch,
  buildMoveTemplateFolderBatch,
  buildRenameTemplateFolderBatch,
} from '@/shared/sync/template-folder-mutations';

export { createTemplateFolderSyncMirror } from '@/context/template-folder-sync-mirror';

export type TemplateFolderSimpleResult = SyncSimpleResult;

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
  return applySyncPayload(buildRenameTemplateFolderBatch(input, ctx));
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
  return applySyncPayload(buildCreateTemplateFolderBatch(input, ctx));
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
  return applySyncPayload(buildDeleteTemplateFolderBatch(input, ctx));
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
  return applySyncPayload(buildMoveTemplateFolderBatch(input, ctx));
}

export type { MutationEnvelope };
