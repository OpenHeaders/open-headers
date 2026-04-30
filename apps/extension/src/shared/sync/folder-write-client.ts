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
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import { type MutationEnvelope } from '@openheaders/core/sync';
import type { FolderParentRef } from '@openheaders/core/sync';
import {
  createFolderSyncMirror,
  type FolderSyncMirror,
  getActiveFolderSyncMirror,
} from '@/context/folder-sync-mirror';
import {
  buildCreateFolderBatch,
  buildDeleteFolderBatch,
  buildMoveFolderBatch,
  buildRenameFolderBatch,
} from '@/shared/sync/folder-mutations';

export { createFolderSyncMirror } from '@/context/folder-sync-mirror';

export type FolderSimpleResult = SyncSimpleResult;

export interface FolderWriteOptions extends BaseSyncWriteOptions {
  mirror?: FolderSyncMirror;
}

function resolveMirror(opts: FolderWriteOptions): FolderSyncMirror {
  return opts.mirror ?? getActiveFolderSyncMirror();
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
  const mirror = resolveMirror(opts);
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

export async function applyFolderDelete(
  input: ApplyFolderDeleteInput,
  opts: FolderWriteOptions,
): Promise<FolderSimpleResult> {
  const ctx = resolveRendererContext(opts).next(
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
