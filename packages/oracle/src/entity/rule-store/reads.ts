// ── Reads ────────────────────────────────────────────────────────────

import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
} from '@openheaders/core/sync';
import type { Collection, CollectionTree, Rule, TreeNode } from '@openheaders/core/types';
import { indexTreeChildren, orderedChildren, type TreeChildIndex } from '@openheaders/core/utils';
import type { CollectionCache } from '@openheaders/oracle/sync/caches/collection-cache';
import { COLLECTION_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import { getCacheForWorkspace, getOracleForCurrentWorkspace } from '@openheaders/oracle/sync/service/accessors';
import { collections, folders, type LocalFolder, rules } from './state';

export function getRules(): Rule[] {
  // Cache is the source of truth once `bridgeToSyncEngine()` has wired
  // the oracle's broadcast through to our local mirror. The local
  // `rules` array tracks the cache via the change listener — keep it
  // as the read path so callers stay synchronous + oracle-decoupled.
  return rules;
}

export function getCollections(): Collection[] {
  return collections;
}

/**
 * Snapshot every rule collection in an explicit workspace via its
 * {@link CollectionCache}. Returns `[]` when no service is materialized
 * for the workspace. SW-internal consumers operating on a non-Active
 * workspace (live-refresh chain executor's variable scope feed) read
 * through here instead of {@link getCollections}, which is Active-bound
 * by design (renderer/popup).
 */
export function getCollectionsForWorkspace(workspaceId: string): Collection[] {
  const cache = getCacheForWorkspace<CollectionCache>(COLLECTION_REGISTRATION, workspaceId);
  return cache ? cache.getCollections() : [];
}

export function getFolders(): LocalFolder[] {
  return folders;
}

/**
 * Build CollectionTree[] from flat collections + folders + rules.
 * Same structure the desktop derives from the filesystem. Collections
 * come in the cache's roots order.
 */
export function getCollectionTrees(): CollectionTree[] {
  const index = indexTreeChildren(
    folders,
    rules,
    (f) => f.path,
    (r) => r.path,
  );
  return collections.map((collection) => {
    const tree = buildTreeForParent(index, COLLECTION_ENTITY_TYPE, collection.uid, collection.path);
    return { ...collection, tree };
  });
}

/**
 * Build TreeNode[] for the children of a parent (collection or folder):
 * child folders first, then rules, each run in the order carried by the
 * parent's `folders` / `items` set (§7.2 + §23.5 — orderKey-driven
 * fractional indexing). Children without a live slot yet — the SW wake →
 * hydrate window, an old client's create — follow by their stored path
 * (`orderedChildren`), so the tree is never empty and never requires a
 * slot on read.
 */
function buildTreeForParent(
  index: TreeChildIndex<LocalFolder, Rule>,
  parentType: typeof COLLECTION_ENTITY_TYPE | typeof FOLDER_ENTITY_TYPE,
  parentUid: string,
  parentPath: string,
): TreeNode[] {
  const nodes: TreeNode[] = [];
  const oracle = getOracleForCurrentWorkspace();
  const slotUids = (setPath: string): string[] =>
    oracle ? oracle.liveOrderedSetItems(parentType, parentUid, setPath).map((slot) => slot.itemId) : [];
  const children = orderedChildren(index, parentPath, {
    folders: slotUids(FOLDER_CHILDREN_PATH),
    items: slotUids(FOLDER_ITEMS_PATH),
  });

  for (const folder of children.folders) {
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children: buildTreeForParent(index, FOLDER_ENTITY_TYPE, folder.uid, folder.path),
    });
  }

  for (const rule of children.leaves) {
    nodes.push({
      type: 'rule',
      uid: rule.uid,
      name: rule.name,
      path: rule.path,
      ruleType: rule.type,
      enabled: rule.enabled,
    });
  }

  return nodes;
}
