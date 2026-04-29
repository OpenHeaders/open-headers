/**
 * Files mutator catalog — routing constants.
 *
 * Singleton entity per workspace. The catalog governs the workspace's
 * `FileRef[]` registry — `(fileId, hash, filename, mimeType, size)` per
 * uploaded blob. Actual blob bytes live in IndexedDB via the
 * platform-specific `BlobStore`; the sync engine never sees the bytes.
 *
 * Set member identity = `fileId`. Concurrent uploads on different
 * surfaces converge under per-(setPath, itemId) LWW with disjoint
 * fileIds, so two parallel uploads always produce two distinct entries
 * (matches the existing UX: same-bytes-different-name = two files).
 *
 * No side effects. File changes don't recompile DNR (rules don't
 * reference files at the catalog level) and don't invalidate the
 * variables resolver (the request-executor reads `listFiles()` lazily
 * at request time and rebuilds the FileRegistry per request).
 *
 * Not sensitive — file metadata is user-visible. The bytes themselves
 * are kept opaque by the platform store; the catalog carries only the
 * `(fileId, hash, filename, mimeType, size)` shell.
 */

/** Routing key carried on every files mutation envelope. */
export const FILES_ENTITY_TYPE = 'files';

/** Fixed singleton id — every workspace has exactly one of these. */
export const FILES_ID = 'files';

/** Set path holding the `FileRefSlot` entries on the singleton. */
export const FILES_REFS_PATH = 'refs';

/**
 * Set-item shape carried inside the files entity. Mirrors the public
 * `FileRef` shape from `@openheaders/core/files`; stored directly so the
 * projector can rebuild a `FileRef[]` straight from `liveSetItems`
 * without joining against a parallel store.
 */
export interface FileRefSlot {
  fileId: string;
  hash: string;
  filename: string;
  mimeType?: string;
  size: number;
}
