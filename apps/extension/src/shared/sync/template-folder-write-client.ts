/**
 * Renderer-side imperative entry point for template-folder writes.
 *
 * Mirrors `request-folder-write-client.ts` but routed through the
 * template-folder entity type.
 */

import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import { type MutationEnvelope, type TemplateFolderParentRef } from '@openheaders/core/sync';
import {
  getTemplateFolderSyncMirrorForWorkspace,
  type TemplateFolderSyncMirror,
} from '@/context/template-folder-sync-mirror';
import { getTemplateSyncMirrorForWorkspace } from '@/context/template-sync-mirror';
import {
  buildCreateTemplateFolderBatch,
  buildDeleteTemplateFolderBatch,
  buildDeleteTemplateFolderEntityBatch,
  buildMoveTemplateFolderBatch,
  buildRenameTemplateFolderBatch,
} from '@openheaders/core/sync-builders/template-folder-mutations';
import { buildDeleteBatch as buildDeleteTemplateBatch } from '@openheaders/core/sync-builders/template-mutations';

export { createTemplateFolderSyncMirror } from '@/context/template-folder-sync-mirror';

export type TemplateFolderSimpleResult = SyncSimpleResult;

export interface TemplateFolderWriteOptions extends BaseSyncWriteOptions {
  mirror?: TemplateFolderSyncMirror;
}

export interface ApplyTemplateFolderRenameInput {
  folderUid: string;
  name: string;
}

export async function applyTemplateFolderRename(
  input: ApplyTemplateFolderRenameInput,
  opts: TemplateFolderWriteOptions,
): Promise<TemplateFolderSimpleResult> {
  const mirror = resolveMirror(opts, getTemplateFolderSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getTemplateFolderMirror(input.folderUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
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
  const ctx = resolveRendererContext(opts).next(
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

/**
 * Delete a template-folder and cascade-delete every descendant template
 * + nested template-folder. Mirrors `template-store.deleteTemplateFolder`
 * (legacy SW handler) so cascade is consistent across surfaces.
 */
export async function applyTemplateFolderDelete(
  input: ApplyTemplateFolderDeleteInput,
  opts: TemplateFolderWriteOptions,
): Promise<TemplateFolderSimpleResult> {
  const folderMirror = resolveMirror(opts, getTemplateFolderSyncMirrorForWorkspace);
  await folderMirror.hydrated;
  const folder = folderMirror.listTemplateFolders().find((f) => f.uid === input.folderUid);
  if (!folder) return { ok: false, reason: 'not-found' };
  const childPathPrefix = `${folder.path}/`;

  const templateMirror = getTemplateSyncMirrorForWorkspace(opts.workspaceId);
  await templateMirror.hydrated;

  const cascadingTemplateUids = templateMirror
    .listTemplates()
    .filter((t) => t.path?.startsWith(childPathPrefix))
    .map((t) => t.uid);
  const cascadingFolderUids = folderMirror
    .listTemplateFolders()
    .filter((f) => f.uid !== input.folderUid && f.path.startsWith(childPathPrefix))
    .map((f) => f.uid);

  const baseCtx = resolveRendererContext(opts);
  for (const tplUid of cascadingTemplateUids) {
    const ctx = baseCtx.next({ batchId: `template-folder-delete-cascade-tpl-${tplUid}` });
    const ack = await applySyncPayload(buildDeleteTemplateBatch(tplUid, ctx));
    if (!ack.ok) return ack;
  }
  for (const nestedUid of cascadingFolderUids) {
    const ctx = baseCtx.next({ batchId: `template-folder-delete-cascade-nested-${nestedUid}` });
    const ack = await applySyncPayload({
      batch: buildDeleteTemplateFolderEntityBatch(nestedUid, ctx),
      sideEffects: [],
    });
    if (!ack.ok) return ack;
  }

  const ctx = baseCtx.next(
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
  const ctx = resolveRendererContext(opts).next(
    opts.batchId
      ? { batchId: opts.batchId }
      : { batchId: `template-folder-move-${input.folderUid}` },
  );
  return applySyncPayload(buildMoveTemplateFolderBatch(input, ctx));
}

export type { MutationEnvelope };
