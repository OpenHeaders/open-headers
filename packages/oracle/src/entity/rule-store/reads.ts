// ── Reads ────────────────────────────────────────────────────────────

import { COLLECTION_ENTITY_TYPE, FOLDER_CHILDREN_PATH, FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Collection, CollectionTree, Rule, TreeNode } from '@openheaders/core/types';
import type { CollectionCache } from '@openheaders/oracle/sync/collection-cache';
import { COLLECTION_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import { getCacheForWorkspace, getOracleForCurrentWorkspace } from '@openheaders/oracle/sync/service';
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
 * Same structure the desktop derives from the filesystem.
 */
export function getCollectionTrees(): CollectionTree[] {
  return collections.map((collection) => {
    const tree = buildTreeForParent(COLLECTION_ENTITY_TYPE, collection.uid, collection.path);
    return { ...collection, tree };
  });
}

/**
 * Build TreeNode[] for the children of a parent (collection or folder).
 *
 * Folder siblings render in the order carried by the parent's `folders`
 * set (§7.2 + §23.5 — orderKey-driven fractional-indexing). Rules
 * inside the same parent keep their cache-array order (rules don't
 * live in a parent set today; each rule is its own entity with a path).
 */
function buildTreeForParent(
  parentType: typeof COLLECTION_ENTITY_TYPE | typeof FOLDER_ENTITY_TYPE,
  parentUid: string,
  parentPath: string,
): TreeNode[] {
  const nodes: TreeNode[] = [];

  const oracle = getOracleForCurrentWorkspace();
  const slots = oracle ? oracle.liveOrderedSetItems(parentType, parentUid, FOLDER_CHILDREN_PATH) : [];

  // Use slot order when the oracle has parent linkage (post-hydration).
  // Boot fallback: if no slots are live yet, derive children from the
  // path-string filter so the tree is non-empty during the SW wake →
  // hydrate window.
  let childFolders: LocalFolder[];
  if (slots.length > 0) {
    const byUid = new Map(folders.map((f) => [f.uid, f]));
    childFolders = slots.map((slot) => byUid.get(slot.itemId)).filter((f): f is LocalFolder => Boolean(f));
  } else {
    childFolders = folders.filter((f) => {
      const parent = f.path.substring(0, f.path.lastIndexOf('/'));
      return parent === parentPath;
    });
  }

  for (const folder of childFolders) {
    const children = buildTreeForParent(FOLDER_ENTITY_TYPE, folder.uid, folder.path);
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children,
    });
  }

  const childRules = rules.filter((r) => {
    const parent = r.path.substring(0, r.path.lastIndexOf('/'));
    return parent === parentPath;
  });

  for (const rule of childRules) {
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
