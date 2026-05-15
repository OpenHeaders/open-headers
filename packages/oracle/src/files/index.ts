/**
 * Public surface of `@openheaders/oracle/files`.
 *
 * The free-function API (`putBlob`, `getBlob`, …) is preserved 1:1 from
 * the pre-seam single-file implementation — callers don't need to know
 * a backend swap exists. Hosts that need a non-IDB backend
 * (`apps/desktop/src/main/install-rpc-host.ts`) install one via
 * {@link setBlobBackend} at boot.
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
export {
  ensureBlobMetadataSchema,
  FileSystemBlobBackend,
  type FileSystemBlobBackendOptions,
} from './fs-blob-backend';
export { IdbBlobBackend } from './idb-blob-backend';
