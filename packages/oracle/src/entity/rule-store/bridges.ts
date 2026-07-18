// ── Sync engine bridge ──────────────────────────────────────────────

import { logger } from '@openheaders/core/utils';
import type { CollectionCache } from '@openheaders/oracle/sync/caches/collection-cache';
import type { FolderCache } from '@openheaders/oracle/sync/caches/folder-cache';
import type { RuleCache } from '@openheaders/oracle/sync/caches/rule-cache';
import {
  COLLECTION_REGISTRATION,
  FOLDER_REGISTRATION,
  RULE_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service/accessors';
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

function subscribeRuleMirror(cache: RuleCache): void {
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
}

function subscribeCollectionMirror(cache: CollectionCache): void {
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
}

function subscribeFolderMirror(cache: FolderCache): void {
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
}

/**
 * Wire the local `rules` array to the active workspace's
 * {@link RuleCache}: subscribe to broadcast-driven re-projections so
 * subsequent mutations flow back into the local mirror, and copy the
 * cache's current snapshot in.
 *
 * Does NOT seed the oracle — the workspace service's `hydrated` gate
 * (awaited inside `setRuntimeActive`) already seeded the cache from
 * the same per-workspace storage keys the store hydrates from. Used by
 * the boot / workspace-switch re-wire pass; {@link bridgeToSyncEngine}
 * layers the seed on top for callers whose store state is fresher than
 * the oracle (the active-workspace import path).
 *
 * Idempotent — the prior cache subscription is dropped first.
 */
export function wireRuleSyncEngine(): void {
  const cache = getActiveCacheForRegistration<RuleCache>(RULE_REGISTRATION);
  if (!cache) {
    logger.info('RuleStore', 'wireRuleSyncEngine: no active cache; skipping');
    return;
  }
  subscribeRuleMirror(cache);
  setRules(cache.getRules());
}

/**
 * Wire the local `rules` array to the active workspace's
 * {@link RuleCache} AND seed the oracle from the hydrated rules.
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
  subscribeRuleMirror(cache);
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
 * {@link CollectionCache}. Same wire-only shape as
 * {@link wireRuleSyncEngine}; idempotent.
 */
export function wireRuleCollectionSyncEngine(): void {
  const cache = getActiveCacheForRegistration<CollectionCache>(COLLECTION_REGISTRATION);
  if (!cache) {
    logger.info('RuleStore', 'wireRuleCollectionSyncEngine: no active cache; skipping');
    return;
  }
  subscribeCollectionMirror(cache);
  setCollections(cache.getCollections());
}

/**
 * Wire the local `collections` array to the active workspace's
 * {@link CollectionCache} AND seed the oracle from the hydrated
 * collections. Same shape as {@link bridgeToSyncEngine}; idempotent.
 * Call AFTER `initSyncService(workspaceId)` AND AFTER hydration /
 * switch.
 */
export async function bridgeCollectionSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<CollectionCache>(COLLECTION_REGISTRATION);
  if (!cache) {
    logger.info('RuleStore', 'bridgeCollectionSyncEngine: no active cache; skipping');
    return;
  }
  subscribeCollectionMirror(cache);
  await cache.seedFromPersistedCollections(collections);
  setCollections(cache.getCollections());
}

/**
 * Wire the local `folders` array to the active workspace's
 * {@link FolderCache}. Same wire-only shape as
 * {@link wireRuleSyncEngine}; idempotent.
 */
export function wireRuleFolderSyncEngine(): void {
  const cache = getActiveCacheForRegistration<FolderCache>(FOLDER_REGISTRATION);
  if (!cache) {
    logger.info('RuleStore', 'wireRuleFolderSyncEngine: no active cache; skipping');
    return;
  }
  subscribeFolderMirror(cache);
  setFolders(cache.getFolders());
}

/**
 * Wire the local `folders` array to the active workspace's
 * {@link FolderCache} AND seed the oracle from the hydrated folders +
 * collections (the seed walks the parent linkage from `path` strings).
 * Idempotent. Call AFTER `bridgeCollectionSyncEngine()` so the parent
 * collection slots already exist in the oracle when each folder seeds.
 */
export async function bridgeFolderSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<FolderCache>(FOLDER_REGISTRATION);
  if (!cache) {
    logger.info('RuleStore', 'bridgeFolderSyncEngine: no active cache; skipping');
    return;
  }
  subscribeFolderMirror(cache);
  await cache.seedFromPersistedFolders(folders, collections);
  setFolders(cache.getFolders());
}
