// ── Sync engine bridge ──────────────────────────────────────────────

import {
  REQUEST_COLLECTION_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  REQUEST_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
import type { RequestCache } from '@openheaders/oracle/sync/request-cache';
import type { RequestCollectionCache } from '@openheaders/oracle/sync/request-collection-cache';
import type { RequestFolderCache } from '@openheaders/oracle/sync/request-folder-cache';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service';
import {
  cacheUnsubscribe,
  collectionCacheUnsubscribe,
  collections,
  folderCacheUnsubscribe,
  folders,
  notifyChange,
  requests,
  setCacheUnsubscribe,
  setCollectionCacheUnsubscribe,
  setCollections,
  setFolderCacheUnsubscribe,
  setFolders,
  setRequests,
} from './state';

/**
 * Wire the local `requests` array to the active workspace's
 * {@link RequestCache}: seed the oracle from the hydrated requests,
 * then subscribe to broadcast-driven re-projections so subsequent
 * mutations flow back into the local mirror. Idempotent — the prior
 * cache subscription is dropped first.
 */
export async function bridgeRequestSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestCache>(REQUEST_REGISTRATION);
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    setCacheUnsubscribe(null);
  }
  setCacheUnsubscribe(
    cache.onChange(() => {
      setRequests(cache.getRequests());
      notifyChange();
    }),
  );
  await cache.seedFromPersistedRequests(requests);
  setRequests(cache.getRequests());
}

/**
 * Wire the local `collections` array to the active workspace's
 * request-collection cache. Same shape as `bridgeRequestSyncEngine`.
 */
export async function bridgeRequestCollectionSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestCollectionCache>(REQUEST_COLLECTION_REGISTRATION);
  if (!cache) return;
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    setCollectionCacheUnsubscribe(null);
  }
  setCollectionCacheUnsubscribe(
    cache.onChange(() => {
      setCollections(cache.getRequestCollections());
      notifyChange();
    }),
  );
  await cache.seedFromPersistedRequestCollections(collections);
  setCollections(cache.getRequestCollections());
}

/**
 * Wire the local `folders` array to the active workspace's
 * request-folder cache. Call AFTER `bridgeRequestCollectionSyncEngine()`
 * so the parent collection slots already exist in the oracle when each
 * folder seeds.
 */
export async function bridgeRequestFolderSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestFolderCache>(REQUEST_FOLDER_REGISTRATION);
  if (!cache) return;
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    setFolderCacheUnsubscribe(null);
  }
  setFolderCacheUnsubscribe(
    cache.onChange(() => {
      setFolders(cache.getRequestFolders());
      notifyChange();
    }),
  );
  await cache.seedFromPersistedRequestFolders(folders, collections);
  setFolders(cache.getRequestFolders());
}
