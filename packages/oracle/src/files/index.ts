/**
 * Public surface of `@openheaders/oracle/files`.
 *
 * The free-function API (`putBlob`, `getBlob`, …) is preserved 1:1 from
 * the pre-seam single-file implementation — callers don't need to know
 * a backend swap exists. Concrete backends are deep-imports:
 *   - `@openheaders/oracle/files/idb-blob-backend` for browser hosts.
 *   - `@openheaders/oracle/files/fs-blob-backend` for Node hosts.
 * Either way the host installs at boot via {@link setBlobBackend}; this
 * barrel pulls in neither IDB nor `node:fs` so it bundles cleanly for
 * both targets.
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
