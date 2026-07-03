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
  setRules,
} from './state';

/** Test-only: reset the module without touching storage. */
export function __resetForTests(): void {
  setRules([]);
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
