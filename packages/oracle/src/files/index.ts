/**
 * Public surface of `@openheaders/oracle/files`.
 *
 * The free-function API (`putBlob`, `getBlob`, …) is preserved 1:1 from
 * the pre-seam single-file implementation — callers don't need to know
 * a backend swap exists. Browser-safe backends ship here; Node-only
 * ones (`FileSystemBlobBackend`) live behind a deep import
 * (`@openheaders/oracle/files/fs-blob-backend`) so this barrel stays
 * importable from a service-worker / browser bundle without pulling
 * in `node:fs` / `node:path`.
 */

export {
  type BlobBackend,
  getBlobBackend,
  setBlobBackend,
} from './blob-backend';
export {
  __resetBlobStoreForTests,
  clearWorkspaceBlobs,
  deleteBlob,
  getBlob,
  getBlobByHash,
  hashBlob,
  listBlobs,
  putBlob,
  renameBlob,
} from './blob-store';
export { IdbBlobBackend } from './idb-blob-backend';
