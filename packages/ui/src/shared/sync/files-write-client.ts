/**
 * Renderer-side imperative entry point for files catalog writes.
 *
 * Mirrors `pause-markers-write-client.ts` for the singleton files
 * entity. Each helper builds a `MutationBatch` and fires
 * `oh.sync.apply` directly. **Bytes are NOT handled here** — these
 * helpers only mutate the `FileRef` catalog. Renderers that need to
 * actually upload bytes still go through the existing `putFile` RPC,
 * which routes the byte write through `BlobStore` + emits the catalog
 * mutation in the same SW path.
 *
 * Shipped alongside the SW write-site conversion as a future-ready
 * surface for renderer-direct catalog updates (rename, metadata edits)
 * — none of those gestures land in this slice but the seam is in
 * place.
 */

import type { FileRefSlot } from '@openheaders/core/sync';
import {
  createFilesSyncMirror,
  type FilesSyncMirror,
  getFilesSyncMirrorForWorkspace,
} from '../../context/files-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import { buildAddFileRefBatch, buildRemoveFileRefBatch, buildRenameFileRefBatch } from '@openheaders/core/sync-builders/files-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createFilesSyncMirror } from '../../context/files-sync-mirror';

export type FilesResult = SyncSimpleResult;

export interface FilesWriteOptions extends BaseSyncWriteOptions {
  mirror?: FilesSyncMirror;
}

export interface ApplyFileAddInput {
  ref: FileRefSlot;
}

export async function applyFileAdd(input: ApplyFileAddInput, opts: FilesWriteOptions): Promise<FilesResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildAddFileRefBatch(input, ctx));
}

export interface ApplyFileRemoveInput {
  fileId: string;
}

export async function applyFileRemove(input: ApplyFileRemoveInput, opts: FilesWriteOptions): Promise<FilesResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveFileRefBatch(input, ctx));
}

export interface ApplyFileRenameInput {
  ref: FileRefSlot;
}

export async function applyFileRename(input: ApplyFileRenameInput, opts: FilesWriteOptions): Promise<FilesResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameFileRefBatch(input, ctx));
}

export function activeMirror(workspaceId: string): FilesSyncMirror {
  return getFilesSyncMirrorForWorkspace(workspaceId);
}
