/**
 * Renderer-side imperative entry point for Folder writes.
 *
 * Mirrors `collection-write-client.ts`. Each helper builds a folder
 * `MutationBatch` against the active folder mirror + per-surface HLC
 * sequencer and fires `oh.sync.apply` directly. No SW round-trip per
 * primitive.
 *
 * The catalog factories already model the cross-entity batches (folder
 * entity + parent slot for create/delete; intra-parent moveBefore vs.
 * cross-parent reparent for move) — the write client is a thin wire
 * layer on top.
 */

import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import { type MutationEnvelope } from '@openheaders/core/sync';
import type { FolderParentRef } from '@openheaders/core/sync';
import {
  createFolderSyncMirror,
  type FolderSyncMirror,
  getFolderSyncMirrorForWorkspace,
} from '@/context/folder-sync-mirror';
import { getRuleSyncMirrorForWorkspace } from '@/context/rule-sync-mirror';
import {
  buildCreateFolderBatch,
  buildDeleteFolderBatch,
  buildDeleteFolderEntityBatch,
  buildMoveFolderBatch,
  buildRenameFolderBatch,
} from '@openheaders/oracle/sync-builders/folder-mutations';
import { buildDeleteBatch as buildDeleteRuleBatch } from '@openheaders/oracle/sync-builders/rule-mutations';

export { createFolderSyncMirror } from '@/context/folder-sync-mirror';

export type FolderSimpleResult = SyncSimpleResult;

export interface FolderWriteOptions extends BaseSyncWriteOptions {
  mirror?: FolderSyncMirror;
}

export interface ApplyFolderRenameInput {
  folderUid: string;
  name: string;
}

export async function applyFolderRename(
  input: ApplyFolderRenameInput,
  opts: FolderWriteOptions,
): Promise<FolderSimpleResult> {
  // Mirror lookup gates "not-found" — a rename against a folder the
  // mirror doesn't know about would still apply at the oracle if the
  // entity exists, but the editor UX wants the early fail signal.
  const mirror = resolveMirror(opts, getFolderSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getFolderMirror(input.folderUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameFolderBatch(input, ctx));
}

export interface ApplyFolderCreateInput {
  folderUid: string;
  parent: FolderParentRef;
  name: string;
  /** Optional fractional-indexing key for the parent's child set. */
  orderKey?: string;
}

export async function applyFolderCreate(
  input: ApplyFolderCreateInput,
  opts: FolderWriteOptions,
): Promise<FolderSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `folder-create-${input.folderUid}` },
  );
  return applySyncPayload(buildCreateFolderBatch(input, ctx));
}

export interface ApplyFolderDeleteInput {
  folderUid: string;
  parent: FolderParentRef;
}

/**
 * Delete a (rules) folder and cascade-delete every descendant rule +
 * nested folder. Mirrors `rule-store.deleteFolder` (legacy SW handler)
 * so cascade is consistent across surfaces.
 */
export async function applyFolderDelete(
  input: ApplyFolderDeleteInput,
  opts: FolderWriteOptions,
): Promise<FolderSimpleResult> {
  const folderMirror = resolveMirror(opts, getFolderSyncMirrorForWorkspace);
  await folderMirror.hydrated;
  const folder = folderMirror.listFolders().find((f) => f.uid === input.folderUid);
  if (!folder) return { ok: false, reason: 'not-found' };
  const childPathPrefix = `${folder.path}/`;

  const ruleMirror = getRuleSyncMirrorForWorkspace(opts.workspaceId);
  await ruleMirror.hydrated;

  const cascadingRuleUids = ruleMirror
    .listRules()
    .filter((r) => r.path?.startsWith(childPathPrefix))
    .map((r) => r.uid);
  const cascadingFolderUids = folderMirror
    .listFolders()
    .filter((f) => f.uid !== input.folderUid && f.path.startsWith(childPathPrefix))
    .map((f) => f.uid);

  const baseCtx = resolveRendererContext(opts);
  for (const ruleUid of cascadingRuleUids) {
    const ctx = baseCtx.next({ batchId: `folder-delete-cascade-rule-${ruleUid}` });
    const ack = await applySyncPayload(buildDeleteRuleBatch(ruleUid, ctx));
    if (!ack.ok) return ack;
  }
  for (const nestedUid of cascadingFolderUids) {
    const ctx = baseCtx.next({ batchId: `folder-delete-cascade-nested-${nestedUid}` });
    const ack = await applySyncPayload({
      batch: buildDeleteFolderEntityBatch(nestedUid, ctx),
      sideEffects: [],
    });
    if (!ack.ok) return ack;
  }

  const ctx = baseCtx.next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `folder-delete-${input.folderUid}` },
  );
  return applySyncPayload(buildDeleteFolderBatch(input, ctx));
}

export interface ApplyFolderMoveInput {
  folderUid: string;
  newParent: FolderParentRef;
  /** Required — derive from the renderer's sibling-mirror via
   *  `keyBetween(predKey, anchorKey)` at emit time. */
  orderKey: string;
  oldParent?: FolderParentRef;
}

export async function applyFolderMove(
  input: ApplyFolderMoveInput,
  opts: FolderWriteOptions,
): Promise<FolderSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
    opts.batchId ? { batchId: opts.batchId } : { batchId: `folder-move-${input.folderUid}` },
  );
  return applySyncPayload(buildMoveFolderBatch(input, ctx));
}

export type { MutationEnvelope };
