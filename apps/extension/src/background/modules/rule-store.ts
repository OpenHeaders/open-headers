/**
 * Rule Store — single source of truth for V5 rules in the extension.
 *
 * Two rule sources coexist:
 *   1. **App rules** — from WebSocket (desktop app), authoritative when connected
 *   2. **Local rules** — created in the extension popup, always available
 *
 * getRules() returns the merged set (app rules first, then local rules).
 * Local rules have `uid` prefixed with "local-" to avoid collisions.
 *
 * Local rules belong to **local collections** with the same
 * Collection → Folder → Rule hierarchy as the desktop (V5.CollectionTree).
 * The tree is derived at read time from flat stored data (paths encode hierarchy).
 *
 * Persistence:
 *   - App rules → storage.local key "v5Rules" (cache for offline restart)
 *   - Local rules → storage.local key "v5LocalRules" (user-created, permanent)
 *   - Local collections → storage.local key "v5LocalCollections"
 *   - Local folders → storage.local key "v5LocalFolders"
 */

import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { storage } from '@utils/browser-api';
import { logger } from '@utils/logger';

const APP_STORAGE_KEY = 'v5Rules';
const LOCAL_RULES_KEY = 'v5LocalRules';
const LOCAL_COLLECTIONS_KEY = 'v5LocalCollections';
const LOCAL_FOLDERS_KEY = 'v5LocalFolders';

/** Stored folder — same concept as a directory with _folder.yaml on disk. */
export interface LocalFolder {
  uid: string;
  /** Relative path (e.g. "rules/my-rules-abc1/staging-f1k2"). */
  path: string;
  name: string;
}

let appRules: V5.Rule[] = [];
let localRules: V5.Rule[] = [];
let localCollections: V5.Collection[] = [];
let localFolders: LocalFolder[] = [];

// ── Change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
const changeListeners: Set<ChangeListener> = new Set();

/** Register a listener that fires after any rule/collection/folder mutation. */
export function onStoreChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange(): void {
  for (const listener of changeListeners) listener();
}

// ── Reads ────────────────────────────────────────────────────────────

export function getRules(): V5.Rule[] {
  return [...appRules, ...localRules];
}

export function getAppRules(): V5.Rule[] {
  return appRules;
}

export function getLocalRules(): V5.Rule[] {
  return localRules;
}

export function getLocalCollections(): V5.Collection[] {
  return localCollections;
}

export function getLocalFolders(): LocalFolder[] {
  return localFolders;
}

/**
 * Build CollectionTree[] from flat collections + folders + rules.
 * Same structure as the desktop derives from the filesystem.
 */
export function getLocalCollectionTrees(): V5.CollectionTree[] {
  return localCollections.map((collection) => {
    const tree = buildTreeForPath(collection.path);
    return { ...collection, tree };
  });
}

/** Recursively build V5.TreeNode[] for items under a given parent path. */
function buildTreeForPath(parentPath: string): V5.TreeNode[] {
  const nodes: V5.TreeNode[] = [];

  // Find folders that are direct children of this path
  const childFolders = localFolders.filter((f) => {
    const parentOfFolder = f.path.substring(0, f.path.lastIndexOf('/'));
    return parentOfFolder === parentPath;
  });

  for (const folder of childFolders) {
    const children = buildTreeForPath(folder.path);
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children,
    });
  }

  // Find rules that are direct children of this path
  const childRules = localRules.filter((r) => {
    const parentOfRule = r.path.substring(0, r.path.lastIndexOf('/'));
    return parentOfRule === parentPath;
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

// ── App rules (from WebSocket) ───────────────────────────────────────

export function setRulesFromApp(incoming: V5.Rule[]): void {
  appRules = incoming;
  storage.local.set({ [APP_STORAGE_KEY]: incoming }, () => {
    logger.debug('RuleStore', `Persisted ${incoming.length} app rules to storage`);
  });
  notifyChange();
}

// ── Local collections ────────────────────────────────────────────────

const DEFAULT_COLLECTION_NAME = 'My Rules';

function generateLocalUid(): string {
  return `local-${generateUid()}`;
}

export function ensureDefaultCollection(): V5.Collection {
  const existing = localCollections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateLocalUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: V5.Collection = {
    uid,
    path: `rules/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
  };
  localCollections = [...localCollections, collection];
  persistLocalCollections();
  return collection;
}

export function createLocalCollection(name: string): V5.Collection {
  const uid = generateLocalUid();
  const folderName = toFolderName(name, uid);
  const collection: V5.Collection = {
    uid,
    path: `rules/${folderName}`,
    name,
    variables: [],
  };
  localCollections = [...localCollections, collection];
  persistLocalCollections();
  return collection;
}

export function renameLocalCollection(uid: string, name: string): boolean {
  const index = localCollections.findIndex((c) => c.uid === uid);
  if (index === -1) return false;
  localCollections = [
    ...localCollections.slice(0, index),
    { ...localCollections[index], name },
    ...localCollections.slice(index + 1),
  ];
  persistLocalCollections();
  return true;
}

export function deleteLocalCollection(uid: string): boolean {
  const collection = localCollections.find((c) => c.uid === uid);
  if (!collection) return false;

  localCollections = localCollections.filter((c) => c.uid !== uid);
  localRules = localRules.filter((r) => !r.path.startsWith(collection.path));
  localFolders = localFolders.filter((f) => !f.path.startsWith(collection.path));
  persistLocalCollections();
  persistLocalRules();
  persistLocalFolders();
  return true;
}

function persistLocalCollections(): void {
  storage.local.set({ [LOCAL_COLLECTIONS_KEY]: localCollections }, () => {
    logger.debug('RuleStore', `Persisted ${localCollections.length} local collections to storage`);
  });
  notifyChange();
}

// ── Local folders ───────────────────────────────────────────────────

/**
 * Create a folder within a collection or another folder.
 * parentPath is the path of the parent (collection or folder).
 */
export function createLocalFolder(name: string, parentPath: string): LocalFolder {
  const uid = generateLocalUid();
  const folderName = toFolderName(name, uid);
  const folder: LocalFolder = {
    uid,
    path: `${parentPath}/${folderName}`,
    name,
  };
  localFolders = [...localFolders, folder];
  persistLocalFolders();
  return folder;
}

export function renameLocalFolder(uid: string, name: string): boolean {
  const index = localFolders.findIndex((f) => f.uid === uid);
  if (index === -1) return false;
  localFolders = [
    ...localFolders.slice(0, index),
    { ...localFolders[index], name },
    ...localFolders.slice(index + 1),
  ];
  persistLocalFolders();
  return true;
}

export function deleteLocalFolder(uid: string): boolean {
  const folder = localFolders.find((f) => f.uid === uid);
  if (!folder) return false;

  // Delete the folder and all nested folders + rules
  localFolders = localFolders.filter((f) => f.uid !== uid && !f.path.startsWith(`${folder.path}/`));
  localRules = localRules.filter((r) => !r.path.startsWith(`${folder.path}/`));
  persistLocalFolders();
  persistLocalRules();
  return true;
}

function persistLocalFolders(): void {
  storage.local.set({ [LOCAL_FOLDERS_KEY]: localFolders }, () => {
    logger.debug('RuleStore', `Persisted ${localFolders.length} local folders to storage`);
  });
  notifyChange();
}

// ── Local rules (extension CRUD) ─────────────────────────────────────

/**
 * Add a local rule. parentPath is the collection or folder path.
 */
export function addLocalRule(rule: Omit<V5.Rule, 'uid' | 'path'>, parentPath: string): V5.Rule {
  const uid = generateLocalUid();
  const folderName = toFolderName(rule.name, uid);
  const created: V5.Rule = {
    ...rule,
    uid,
    path: `${parentPath}/${folderName}`,
  } as V5.Rule;
  localRules = [...localRules, created];
  persistLocalRules();
  return created;
}

/**
 * Add a local rule within a collection (by collection uid).
 * Resolves the collection path, then calls addLocalRule.
 */
export function addLocalRuleToCollection(rule: Omit<V5.Rule, 'uid' | 'path'>, collectionUid: string): V5.Rule {
  const collection = localCollections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `rules/${collectionUid}`;
  return addLocalRule(rule, parentPath);
}

export function updateLocalRule(uid: string, updates: Partial<Omit<V5.Rule, 'uid' | 'path'>>): boolean {
  const index = localRules.findIndex((r) => r.uid === uid);
  if (index === -1) return false;

  const existing = localRules[index];
  const updated = { ...existing, ...updates } as V5.Rule;
  localRules = [
    ...localRules.slice(0, index),
    updated,
    ...localRules.slice(index + 1),
  ];
  persistLocalRules();
  return true;
}

export function deleteLocalRule(uid: string): boolean {
  const before = localRules.length;
  localRules = localRules.filter((r) => r.uid !== uid);
  if (localRules.length === before) return false;
  persistLocalRules();
  return true;
}

export function toggleLocalRule(uid: string, enabled: boolean): boolean {
  const index = localRules.findIndex((r) => r.uid === uid);
  if (index === -1) return false;
  localRules = [
    ...localRules.slice(0, index),
    { ...localRules[index], enabled },
    ...localRules.slice(index + 1),
  ];
  persistLocalRules();
  return true;
}

function persistLocalRules(): void {
  storage.local.set({ [LOCAL_RULES_KEY]: localRules }, () => {
    logger.debug('RuleStore', `Persisted ${localRules.length} local rules to storage`);
  });
  notifyChange();
}

// ── Hydration ────────────────────────────────────────────────────────

export function hydrateFromStorage(): Promise<V5.Rule[]> {
  return new Promise((resolve) => {
    storage.local.get(
      [APP_STORAGE_KEY, LOCAL_RULES_KEY, LOCAL_COLLECTIONS_KEY, LOCAL_FOLDERS_KEY],
      (result: Record<string, unknown>) => {
        const storedApp = result[APP_STORAGE_KEY] as V5.Rule[] | undefined;
        const storedLocal = result[LOCAL_RULES_KEY] as V5.Rule[] | undefined;
        const storedCollections = result[LOCAL_COLLECTIONS_KEY] as V5.Collection[] | undefined;
        const storedFolders = result[LOCAL_FOLDERS_KEY] as LocalFolder[] | undefined;

        if (Array.isArray(storedApp) && storedApp.length > 0) {
          appRules = storedApp;
          logger.info('RuleStore', `Hydrated ${storedApp.length} app rules from storage`);
        }
        if (Array.isArray(storedLocal) && storedLocal.length > 0) {
          localRules = storedLocal;
          logger.info('RuleStore', `Hydrated ${storedLocal.length} local rules from storage`);
        }
        if (Array.isArray(storedCollections) && storedCollections.length > 0) {
          localCollections = storedCollections;
          logger.info('RuleStore', `Hydrated ${storedCollections.length} local collections from storage`);
        }
        if (Array.isArray(storedFolders) && storedFolders.length > 0) {
          localFolders = storedFolders;
          logger.info('RuleStore', `Hydrated ${storedFolders.length} local folders from storage`);
        }

        resolve(getRules());
      },
    );
  });
}
