/**
 * Rule Store — single source of truth for rules in the active
 * workspace.
 *
 * The store holds the CURRENT active workspace's rules/collections/
 * folders in memory. Switching workspaces flushes any pending writes,
 * loads the target workspace's persisted data, and replaces the
 * singletons atomically.
 *
 * Persistence — every key scoped under the active workspace id:
 *   - rules       → `oh.ws.<id>.rules`
 *   - collections → `oh.ws.<id>.collections`
 *   - folders     → `oh.ws.<id>.folders`
 *
 * Tree shape is derived at read time from flat stored data (path encodes
 * hierarchy). On-disk layout for team workspaces (v2) mirrors this with
 * Bruno-style YAML directories managed by the desktop app.
 */

export {
  bridgeCollectionSyncEngine,
  bridgeFolderSyncEngine,
  bridgeToSyncEngine,
  wireRuleCollectionSyncEngine,
  wireRuleFolderSyncEngine,
  wireRuleSyncEngine,
} from './bridges';
export {
  type CollectionWriteResult,
  createCollection,
  deleteCollection,
  ensureDefaultCollection,
  renameCollection,
  updateCollectionPinnedEnvs,
} from './collections';
export { createFolder, deleteFolder, renameFolder } from './folders';
export { hydrateFromStorage, switchToWorkspace } from './hydration';
export { getCollections, getCollectionsForWorkspace, getCollectionTrees, getFolders, getRules } from './reads';
export { addRule, addRuleToCollection, deleteRule } from './rules';
export { type LocalFolder, onStoreChange } from './state';
export { __resetForTests } from './testing';
