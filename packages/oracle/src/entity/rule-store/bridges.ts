// ── Sync engine bridge ──────────────────────────────────────────────

import { logger } from '@openheaders/core/utils';
import type { CollectionCache } from '@openheaders/oracle/sync/caches/collection-cache';
import {
  COLLECTION_REGISTRATION,
  FOLDER_REGISTRATION,
  RULE_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
import type { FolderCache } from '@openheaders/oracle/sync/caches/folder-cache';
import type { RuleCache } from '@openheaders/oracle/sync/caches/rule-cache';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service';
import {
  cacheUnsubscribe,
  collectionCacheUnsubscribe,
  collections,
  folderCacheUnsubscribe,
  folders,
  notifyChange,
  rules,
  setCacheUnsubscribe,
  setCollectionCacheUnsubscribe,
  setCollections,
  setFolderCacheUnsubscribe,
  setFolders,
  setRules,
} from './state';

/**
 * Wire the local `rules` array to the active workspace's
 * {@link RuleCache}: seed the oracle from the hydrated rules, then
 * subscribe to broadcast-driven re-projections so subsequent
 * mutations (in-process and — Phase C onward — remote) flow back into
 * the local mirror.
 *
 * Call AFTER `initSyncService(workspaceId)` AND AFTER
 * `hydrateFromStorage()` (or `switchToWorkspace`). Re-runs are safe —
 * the prior cache subscription is dropped first.
 */
export async function bridgeToSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RuleCache>(RULE_REGISTRATION);
  if (!cache) {
    logger.info('RuleStore', 'bridgeToSyncEngine: no active cache; skipping');
    return;
  }
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    setCacheUnsubscribe(null);
  }
  setCacheUnsubscribe(
    cache.onChange(() => {
      setRules(cache.getRules());
      notifyChange();
    }),
  );
  await cache.seedFromPersistedRules(rules);
  // After the seed, broadcasts have driven the listener above so
  // `rules` already reflects cache.getRules(). Belt-and-braces: copy
  // the cache view explicitly so a zero-rules workspace (no
  // broadcasts → listener never fires) still ends up with `rules`
  // pointed at the cache's snapshot.
  setRules(cache.getRules());
}

/**
 * Wire the local `collections` array to the active workspace's
 * {@link CollectionCache}: seed the oracle from the hydrated
 * collections, then subscribe to broadcast-driven re-projections so
 * subsequent mutations flow back into the local mirror. Same shape as
 * {@link bridgeToSyncEngine}; idempotent. Call AFTER
 * `initSyncService(workspaceId)` AND AFTER hydration / switch.
 */
export async function bridgeCollectionSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<CollectionCache>(COLLECTION_REGISTRATION);
  if (!cache) {
    logger.info('RuleStore', 'bridgeCollectionSyncEngine: no active cache; skipping');
    return;
  }
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    setCollectionCacheUnsubscribe(null);
  }
  setCollectionCacheUnsubscribe(
    cache.onChange(() => {
      setCollections(cache.getCollections());
      notifyChange();
    }),
  );
  await cache.seedFromPersistedCollections(collections);
  setCollections(cache.getCollections());
}

/**
 * Wire the local `folders` array to the active workspace's
 * {@link FolderCache}: seed the oracle from the hydrated folders +
 * collections (the seed walks the parent linkage from `path` strings),
 * then subscribe to broadcast-driven re-projections so subsequent
 * mutations flow back into the local mirror. Idempotent. Call AFTER
 * `bridgeCollectionSyncEngine()` so the parent collection slots already
 * exist in the oracle when each folder seeds.
 */
export async function bridgeFolderSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<FolderCache>(FOLDER_REGISTRATION);
  if (!cache) {
    logger.info('RuleStore', 'bridgeFolderSyncEngine: no active cache; skipping');
    return;
  }
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    setFolderCacheUnsubscribe(null);
  }
  setFolderCacheUnsubscribe(
    cache.onChange(() => {
      setFolders(cache.getFolders());
      notifyChange();
    }),
  );
  await cache.seedFromPersistedFolders(folders, collections);
  setFolders(cache.getFolders());
}
