/**
 * BlobStore — public free-function API for the seam at
 * {@link BlobBackend}. Each export delegates to the currently-installed
 * backend (IDB by default; Node hosts swap via {@link setBlobBackend}
 * at boot). The contract here is preserved 1:1 from the pre-seam
 * single-file implementation so existing callers
 * (`packages/oracle/src/entity/files-store.ts`,
 * `packages/oracle/src/sync/files-cache.ts`, extension tests) keep
 * working without code changes.
 *
 * Pure helpers ({@link hashBlob}) live in `hash.ts` because they share
 * across every backend without storage involvement.
 *
 * The `__resetBlobStoreForTests` hook resets cached connection state
 * on whichever backend is currently installed — IDB drops its
 * `dbPromise`, the filesystem backend is stateless after construction.
 */

import type { FileRef } from '@openheaders/core/files';
import { getBlobBackend } from './blob-backend';
import { IdbBlobBackend } from './idb-blob-backend';

export { hashBlob } from './hash';

/** Reset cached connection state on the installed backend. Test hook. */
export function __resetBlobStoreForTests(): void {
  const backend = getBlobBackend();
  if (backend instanceof IdbBlobBackend) backend.reset();
}

export function putBlob(
  workspaceId: string,
  input: { blob: Blob; filename: string; mimeType?: string },
): Promise<FileRef> {
  return getBlobBackend().put(workspaceId, input);
}

export function getBlob(workspaceId: string, fileId: string): Promise<Blob | null> {
  return getBlobBackend().get(workspaceId, fileId);
}

export function getBlobByHash(workspaceId: string, hash: string): Promise<Blob | null> {
  return getBlobBackend().getByHash(workspaceId, hash);
}

export function listBlobs(workspaceId: string): Promise<FileRef[]> {
  return getBlobBackend().list(workspaceId);
}

export function deleteBlob(workspaceId: string, fileId: string): Promise<boolean> {
  return getBlobBackend().delete(workspaceId, fileId);
}

export function renameBlob(
  workspaceId: string,
  fileId: string,
  next: { filename: string; mimeType?: string },
): Promise<FileRef | null> {
  return getBlobBackend().rename(workspaceId, fileId, next);
}

export function clearWorkspaceBlobs(workspaceId: string): Promise<void> {
  return getBlobBackend().clearWorkspace(workspaceId);
}
