/**
 * Cross-host file-storage seam — the interface every blob backend must
 * satisfy, plus the `setBlobBackend` install hook and the proxy that
 * `blob-store.ts`'s free functions delegate through.
 *
 * Why a seam: until this module, `blob-store.ts` hard-coded
 * `indexedDB.open(...)` at every operation — fine in the browser
 * extension and the web app, but unavailable in Electron's main process
 * and in any future headless Node daemon. Same pattern as
 * `SyncPersistenceProvider`: an IDB-backed default ships inline so
 * existing browser tests need no install call; non-browser hosts
 * (`apps/desktop/src/main/install-rpc-host.ts`) swap in a Node
 * implementation at boot.
 *
 * Method semantics are documented on the in-tree {@link IdbBlobBackend};
 * they're a 1:1 lift from the original `blob-store.ts` free-function
 * contract.
 *
 * `hashBlob` and `__resetBlobStoreForTests` stay on `blob-store.ts`
 * because they don't touch storage — pure helpers that every backend
 * shares.
 */

import type { FileRef } from '@openheaders/core/files';
import { IdbBlobBackend } from './idb-blob-backend';

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
}

const IDB_DEFAULT: BlobBackend = new IdbBlobBackend();
let installed: BlobBackend = IDB_DEFAULT;

/**
 * Install (or replace) the blob backend. Hosts call this once at boot;
 * tests use it to swap in a fake. The browser extension never calls it —
 * the IDB default already fits.
 */
export function setBlobBackend(impl: BlobBackend): void {
  installed = impl;
}

/** Returns the installed backend (the IDB default when unwired). */
export function getBlobBackend(): BlobBackend {
  return installed;
}
