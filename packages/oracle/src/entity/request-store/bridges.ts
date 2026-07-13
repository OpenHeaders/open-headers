// ── Sync engine bridge ──────────────────────────────────────────────

import type { RequestCache } from '@openheaders/oracle/sync/caches/request-cache';
import type { RequestCollectionCache } from '@openheaders/oracle/sync/caches/request-collection-cache';
import type { RequestFolderCache } from '@openheaders/oracle/sync/caches/request-folder-cache';
import {
  REQUEST_COLLECTION_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  REQUEST_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
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

function subscribeRequestMirror(cache: RequestCache): void {
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
}

function subscribeCollectionMirror(cache: RequestCollectionCache): void {
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
}

function subscribeFolderMirror(cache: RequestFolderCache): void {
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
}

/**
 * Wire the local `requests` array to the active workspace's
 * {@link RequestCache}: subscribe to broadcast-driven re-projections
 * so subsequent mutations flow back into the local mirror, and copy
 * the cache's current snapshot in.
 *
 * Does NOT seed the oracle — the workspace service's `hydrated` gate
 * (awaited inside `setRuntimeActive`) already seeded the cache from
 * the same per-workspace storage keys the store hydrates from. Used by
 * the boot / workspace-switch re-wire pass;
 * {@link bridgeRequestSyncEngine} layers the seed on top for callers
 * whose store state is fresher than the oracle (the active-workspace
 * import path).
 *
 * Idempotent — the prior cache subscription is dropped first.
 */
export function wireRequestSyncEngine(): void {
  const cache = getActiveCacheForRegistration<RequestCache>(REQUEST_REGISTRATION);
  if (!cache) return;
  subscribeRequestMirror(cache);
  setRequests(cache.getRequests());
}

/**
 * Wire the local `requests` array to the active workspace's
 * {@link RequestCache} AND seed the oracle from the hydrated requests.
 * Idempotent — the prior cache subscription is dropped first.
 */
export async function bridgeRequestSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestCache>(REQUEST_REGISTRATION);
  if (!cache) return;
  subscribeRequestMirror(cache);
  await cache.seedFromPersistedRequests(requests);
  setRequests(cache.getRequests());
}

/**
 * Wire the local `collections` array to the active workspace's
 * request-collection cache. Same wire-only shape as
 * {@link wireRequestSyncEngine}.
 */
export function wireRequestCollectionSyncEngine(): void {
  const cache = getActiveCacheForRegistration<RequestCollectionCache>(REQUEST_COLLECTION_REGISTRATION);
  if (!cache) return;
  subscribeCollectionMirror(cache);
  setCollections(cache.getRequestCollections());
}

/**
 * Wire the local `collections` array to the active workspace's
 * request-collection cache AND seed the oracle. Same shape as
 * `bridgeRequestSyncEngine`.
 */
export async function bridgeRequestCollectionSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestCollectionCache>(REQUEST_COLLECTION_REGISTRATION);
  if (!cache) return;
  subscribeCollectionMirror(cache);
  await cache.seedFromPersistedRequestCollections(collections);
  setCollections(cache.getRequestCollections());
}

/**
 * Wire the local `folders` array to the active workspace's
 * request-folder cache. Same wire-only shape as
 * {@link wireRequestSyncEngine}.
 */
export function wireRequestFolderSyncEngine(): void {
  const cache = getActiveCacheForRegistration<RequestFolderCache>(REQUEST_FOLDER_REGISTRATION);
  if (!cache) return;
  subscribeFolderMirror(cache);
  setFolders(cache.getRequestFolders());
}

/**
 * Wire the local `folders` array to the active workspace's
 * request-folder cache AND seed the oracle. Call AFTER
 * `bridgeRequestCollectionSyncEngine()` so the parent collection slots
 * already exist in the oracle when each folder seeds.
 */
export async function bridgeRequestFolderSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestFolderCache>(REQUEST_FOLDER_REGISTRATION);
  if (!cache) return;
  subscribeFolderMirror(cache);
  await cache.seedFromPersistedRequestFolders(folders, collections);
  setFolders(cache.getRequestFolders());
}
