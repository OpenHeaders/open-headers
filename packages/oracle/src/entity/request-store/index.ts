/**
 * Request Store — single source of truth for HTTP requests in the
 * active workspace.
 *
 * Mirrors `rule-store` post Phase B: writes route through the sync
 * oracle (catalog factory → MutationBatch → `oracle.apply`); the
 * {@link RequestCache} owns `chrome.storage.local` persistence + drives
 * the local mirror via broadcast-driven re-projection. Reads stay
 * synchronous off the local mirror so consumers (executor, sidebar,
 * inspector) don't have to thread the oracle through their call paths.
 *
 * Storage (every key scoped under the active workspace id):
 *   - requests            → `oh.ws.<id>.requests`           (cache-owned)
 *   - requestCollections  → `oh.ws.<id>.requestCollections` (legacy direct write — request collections + folders are queued for their own pipeline pass; see status doc Session 21)
 *   - requestFolders      → `oh.ws.<id>.requestFolders`     (legacy direct write)
 *
 * Paths live under `requests/` (vs. `rules/` for rule-store) so the
 * two entity trees never collide in on-disk format used by team
 * workspaces.
 */

export {
  bridgeRequestCollectionSyncEngine,
  bridgeRequestFolderSyncEngine,
  bridgeRequestSyncEngine,
} from './bridges';
export {
  createRequestCollection,
  deleteRequestCollection,
  ensureDefaultRequestCollection,
  renameRequestCollection,
} from './collections';
export { createRequestFolder, deleteRequestFolder, renameRequestFolder } from './folders';
export { hydrateFromStorage, switchToWorkspace } from './hydration';
export {
  getRequestCollections,
  getRequestCollectionTrees,
  getRequestFolders,
  getRequests,
} from './reads';
export {
  addRequest,
  addRequestToCollection,
  deleteRequest,
  getRequest,
  getRequestCollectionsForWorkspace,
  getRequestInWorkspace,
  getRequestUidsForWorkspace,
  isRequestStoreHydrated,
  type RequestWriteResult,
  updateRequest,
} from './requests';
export { type LocalFolder, onRequestStoreChange } from './state';
export { __resetForTests } from './testing';
