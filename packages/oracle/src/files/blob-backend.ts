/**
 * Cross-host file-storage seam — the interface every blob backend must
 * satisfy, plus the `setBlobBackend` install hook and the proxy that
 * `blob-store.ts`'s free functions delegate through.
 *
 * Every host installs its backend explicitly at boot:
 *   - Browser hosts deep-import {@link IdbBlobBackend} from
 *     `@openheaders/oracle/files/idb-blob-backend`.
 *   - Node hosts deep-import `FileSystemBlobBackend` from
 *     `@openheaders/oracle/files/fs-blob-backend`.
 * Either way the choice is the caller's — this module owns no runtime
 * dependency on a specific backend.
 */

import type { FileRef } from '@openheaders/core/files';

export interface BlobBackend {
  put(workspaceId: string, input: { blob: Blob; filename: string; mimeType?: string }): Promise<FileRef>;
  get(workspaceId: string, fileId: string): Promise<Blob | null>;
  getByHash(workspaceId: string, hash: string): Promise<Blob | null>;
  list(workspaceId: string): Promise<FileRef[]>;
  delete(workspaceId: string, fileId: string): Promise<boolean>;
  rename(
    workspaceId: string,
    fileId: string,
    next: { filename: string; mimeType?: string },
  ): Promise<FileRef | null>;
  clearWorkspace(workspaceId: string): Promise<void>;
  /**
   * Optional reset hook — drops cached connection state. Tests invoke
   * through {@link __resetBlobStoreForTests}; production callers don't.
   */
  reset?(): void | Promise<void>;
}

let installed: BlobBackend | null = null;

/**
 * Install (or replace) the blob backend. Hosts call this once at boot.
 */
export function setBlobBackend(impl: BlobBackend): void {
  installed = impl;
}

/** Returns the installed backend. Throws if no host wired one up. */
export function getBlobBackend(): BlobBackend {
  if (installed === null) {
    throw new Error(
      'BlobBackend not installed — call setBlobBackend() during host boot ' +
        '(e.g. IdbBlobBackend in browser hosts, FileSystemBlobBackend in Node)',
    );
  }
  return installed;
}
