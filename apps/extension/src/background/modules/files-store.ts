/**
 * Files Store — SW-side wrapper around the IDB `BlobStore` that
 * serializes mutating operations through `withLock` (Phase 10
 * discipline). Blob UPLOADS write to IDB, which is atomic per
 * transaction; the outer lock still matters when a single upload
 * dedups or when list → delete → list cycles race across tabs.
 *
 * Reads (`list`, `get`) are lock-free — IDB transactions give us
 * atomic snapshot semantics for free.
 *
 * See `@/shared/files/blob-store` for the IDB contract and
 * ARCHITECTURE.md §6 for the file-reference model.
 */

import type { FileRef } from '@openheaders/core/files';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import * as BlobStore from '@/shared/files/blob-store';
import { getActiveWorkspaceId } from './workspace-store';

function withFilesLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(entityLockName(workspaceId, 'files', 'singleton'), fn, { op: 'files-mutate' });
}

// ── Change listeners ────────────────────────────────────────────────
//
// Same pattern as environment-store: store modules emit a cheap
// "something mutated" ping and the background wiring translates it
// into a typed `filesChanged` broadcast. Renderers subscribe to the
// broadcast, not to the store, so multi-tab sync stays live without
// shared-worker hacks.

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onFilesStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(): void {
  for (const fn of listeners) fn();
}

/**
 * Upload a blob. Returns the resulting FileRef. Dedups within the
 * workspace by content hash (see `putBlob`).
 */
export async function putFile(input: { blob: Blob; filename: string; mimeType?: string }): Promise<FileRef> {
  const workspaceId = getActiveWorkspaceId();
  const ref = await withFilesLock(workspaceId, async () => {
    const result = await BlobStore.putBlob(workspaceId, input);
    logger.debug('FilesStore', `Stored "${result.filename}" (${result.size}B, ${result.hash.slice(0, 14)}…)`);
    return result;
  });
  notifyChange();
  return ref;
}

/** List every file in the active workspace. Metadata only (no bytes). */
export async function listFiles(): Promise<FileRef[]> {
  const workspaceId = getActiveWorkspaceId();
  return BlobStore.listBlobs(workspaceId);
}

/**
 * Return the raw bytes for the given `fileId`. Used by the request
 * executor when building a multipart body and by the UI to offer a
 * download. Returns null when the fileId isn't stored in this workspace.
 */
export async function getFileBlob(fileId: string): Promise<Blob | null> {
  const workspaceId = getActiveWorkspaceId();
  return BlobStore.getBlob(workspaceId, fileId);
}

/**
 * Return the raw bytes by content hash — first entry in the workspace
 * with that hash wins. Used by `{{file.X}}` template resolution when
 * users reference a file by content rather than identity.
 */
export async function getFileBlobByHash(hash: string): Promise<Blob | null> {
  const workspaceId = getActiveWorkspaceId();
  return BlobStore.getBlobByHash(workspaceId, hash);
}

/** Delete a file by `fileId`. Returns `true` iff an entry was removed. */
export async function deleteFile(fileId: string): Promise<boolean> {
  const workspaceId = getActiveWorkspaceId();
  const removed = await withFilesLock(workspaceId, async () => {
    const dropped = await BlobStore.deleteBlob(workspaceId, fileId);
    if (dropped) logger.info('FilesStore', `Deleted file ${fileId}`);
    return dropped;
  });
  if (removed) notifyChange();
  return removed;
}

/**
 * Drop every blob owned by a workspace. Called by the
 * workspace-orchestrator during workspace delete to keep the
 * per-workspace-data-keys discipline honest.
 */
export async function purgeFilesForWorkspace(workspaceId: string): Promise<void> {
  await withFilesLock(workspaceId, async () => {
    await BlobStore.clearWorkspaceBlobs(workspaceId);
    logger.info('FilesStore', `Purged all files for workspace ${workspaceId}`);
  });
  notifyChange();
}
