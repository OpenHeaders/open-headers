// ── Test helpers ────────────────────────────────────────────────────

import {
  cacheUnsubscribe,
  changeListeners,
  collectionCacheUnsubscribe,
  folderCacheUnsubscribe,
  setCacheUnsubscribe,
  setCollectionCacheUnsubscribe,
  setCollections,
  setFolderCacheUnsubscribe,
  setFolders,
  setLoadedWorkspaceId,
  setRequests,
} from './state';

export function __resetForTests(): void {
  setRequests([]);
  setCollections([]);
  setFolders([]);
  setLoadedWorkspaceId(null);
  changeListeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    setCacheUnsubscribe(null);
  }
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    setCollectionCacheUnsubscribe(null);
  }
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    setFolderCacheUnsubscribe(null);
  }
}
