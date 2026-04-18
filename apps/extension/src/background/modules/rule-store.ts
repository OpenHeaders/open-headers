/**
 * Rule Store — single source of truth for V5 rules in the active
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

import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { getActiveWorkspaceId } from './workspace-store';

/** Stored folder — same concept as a directory with _folder.yaml on disk.
 *  Identical shape to the `PersistedLocalFolder` declared in the key
 *  registry; exported under this name because rule-store is the
 *  historical home of the type. */
export type LocalFolder = PersistedLocalFolder;

// ── In-memory state (scoped to the currently active workspace) ──────

let rules: V5.Rule[] = [];
let collections: V5.Collection[] = [];
let folders: LocalFolder[] = [];
/** Id of the workspace whose data is currently loaded. Null until first
 *  hydration. Used to assert that reads/writes never outlive a switch. */
let loadedWorkspaceId: string | null = null;

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
  return rules;
}

export function getCollections(): V5.Collection[] {
  return collections;
}

export function getFolders(): LocalFolder[] {
  return folders;
}

/**
 * Build CollectionTree[] from flat collections + folders + rules.
 * Same structure the desktop derives from the filesystem.
 */
export function getCollectionTrees(): V5.CollectionTree[] {
  return collections.map((collection) => {
    const tree = buildTreeForPath(collection.path);
    return { ...collection, tree };
  });
}

/** Recursively build V5.TreeNode[] for items under a given parent path. */
function buildTreeForPath(parentPath: string): V5.TreeNode[] {
  const nodes: V5.TreeNode[] = [];

  const childFolders = folders.filter((f) => {
    const parent = f.path.substring(0, f.path.lastIndexOf('/'));
    return parent === parentPath;
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

// ── Collections ─────────────────────────────────────────────────────

const DEFAULT_COLLECTION_NAME = 'My Rules';

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('RuleStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

export function ensureDefaultCollection(): V5.Collection {
  const existing = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: V5.Collection = {
    schemaVersion: 5,
    uid,
    path: `rules/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
  };
  collections = [...collections, collection];
  void persistCollections();
  return collection;
}

export function createCollection(name: string): V5.Collection {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const collection: V5.Collection = {
    schemaVersion: 5,
    uid,
    path: `rules/${folderName}`,
    name,
    variables: [],
  };
  collections = [...collections, collection];
  void persistCollections();
  return collection;
}

export function renameCollection(uid: string, name: string): boolean {
  const index = collections.findIndex((c) => c.uid === uid);
  if (index === -1) return false;
  collections = [...collections.slice(0, index), { ...collections[index], name }, ...collections.slice(index + 1)];
  void persistCollections();
  return true;
}

export function deleteCollection(uid: string): boolean {
  const collection = collections.find((c) => c.uid === uid);
  if (!collection) return false;

  collections = collections.filter((c) => c.uid !== uid);
  rules = rules.filter((r) => !r.path.startsWith(collection.path));
  folders = folders.filter((f) => !f.path.startsWith(collection.path));
  void persistCollections();
  void persistRules();
  void persistFolders();
  return true;
}

/**
 * Replace a collection's scoped variables. Used by the Variables editor
 * (collection-vars tab) and by the Inspector "add variable" affordance.
 * Returns false if the collection uid isn't in the active workspace.
 */
export function updateCollectionVariables(uid: string, variables: V5.Variable[]): boolean {
  const index = collections.findIndex((c) => c.uid === uid);
  if (index === -1) return false;
  collections = [...collections.slice(0, index), { ...collections[index], variables }, ...collections.slice(index + 1)];
  void persistCollections();
  return true;
}

// ── Folders ─────────────────────────────────────────────────────────

export function createFolder(name: string, parentPath: string): LocalFolder {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const folder: LocalFolder = {
    schemaVersion: 5,
    uid,
    path: `${parentPath}/${folderName}`,
    name,
  };
  folders = [...folders, folder];
  void persistFolders();
  return folder;
}

export function renameFolder(uid: string, name: string): boolean {
  const index = folders.findIndex((f) => f.uid === uid);
  if (index === -1) return false;
  folders = [...folders.slice(0, index), { ...folders[index], name }, ...folders.slice(index + 1)];
  void persistFolders();
  return true;
}

export function deleteFolder(uid: string): boolean {
  const folder = folders.find((f) => f.uid === uid);
  if (!folder) return false;

  folders = folders.filter((f) => f.uid !== uid && !f.path.startsWith(`${folder.path}/`));
  rules = rules.filter((r) => !r.path.startsWith(`${folder.path}/`));
  void persistFolders();
  void persistRules();
  return true;
}

// ── Rules ───────────────────────────────────────────────────────────

/**
 * Add a rule. `parentPath` is the collection or folder path.
 * `schemaVersion` is owned by the store — callers provide the feature
 * payload, the store stamps the persisted version.
 */
export function addRule(rule: Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>, parentPath: string): V5.Rule {
  const uid = generateUid();
  const folderName = toFolderName(rule.name, uid);
  const created = {
    schemaVersion: 5,
    ...rule,
    uid,
    path: `${parentPath}/${folderName}`,
  } as V5.Rule;
  rules = [...rules, created];
  void persistRules();
  return created;
}

/**
 * Add a rule within a collection by uid. Resolves the collection path,
 * then calls `addRule`.
 */
export function addRuleToCollection(
  rule: Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>,
  collectionUid: string,
): V5.Rule {
  const collection = collections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `rules/${collectionUid}`;
  return addRule(rule, parentPath);
}

export function updateRule(uid: string, updates: Partial<Omit<V5.Rule, 'uid' | 'path'>>): boolean {
  const index = rules.findIndex((r) => r.uid === uid);
  if (index === -1) return false;

  const existing = rules[index];
  const updated = { ...existing, ...updates } as V5.Rule;
  rules = [...rules.slice(0, index), updated, ...rules.slice(index + 1)];
  void persistRules();
  return true;
}

export function deleteRule(uid: string): boolean {
  const before = rules.length;
  rules = rules.filter((r) => r.uid !== uid);
  if (rules.length === before) return false;
  void persistRules();
  return true;
}

export function toggleRule(uid: string, enabled: boolean): boolean {
  const index = rules.findIndex((r) => r.uid === uid);
  if (index === -1) return false;
  rules = [...rules.slice(0, index), { ...rules[index], enabled }, ...rules.slice(index + 1)];
  void persistRules();
  return true;
}

// ── Persistence (scoped to loadedWorkspaceId) ──────────────────────

async function persistRules(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).rules, rules);
  logger.debug('RuleStore', `Persisted ${rules.length} rules (ws=${workspaceId})`);
  notifyChange();
}

async function persistCollections(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).collections, collections);
  logger.debug('RuleStore', `Persisted ${collections.length} collections (ws=${workspaceId})`);
  notifyChange();
}

async function persistFolders(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).folders, folders);
  logger.debug('RuleStore', `Persisted ${folders.length} folders (ws=${workspaceId})`);
  notifyChange();
}

// ── Hydration / workspace switch ────────────────────────────────────

interface WorkspaceSnapshot {
  rules: V5.Rule[];
  collections: V5.Collection[];
  folders: LocalFolder[];
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  const keys = wsKeys(workspaceId);
  const result = await extensionStorage.getMany({
    rules: keys.rules,
    collections: keys.collections,
    folders: keys.folders,
  });
  return {
    rules: Array.isArray(result.rules) ? result.rules : [],
    collections: Array.isArray(result.collections) ? result.collections : [],
    folders: Array.isArray(result.folders) ? result.folders : [],
  };
}

/**
 * Hydrate the store from the currently active workspace's persisted
 * data. Call after `workspaceStore.bootstrap()` so getActiveWorkspaceId
 * resolves. Idempotent — subsequent calls re-load from storage, which
 * is fine because the single owner (background.ts) calls us once.
 */
export async function hydrateFromStorage(): Promise<V5.Rule[]> {
  const workspaceId = getActiveWorkspaceId();
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  rules = snapshot.rules;
  collections = snapshot.collections;
  folders = snapshot.folders;
  loadedWorkspaceId = workspaceId;
  logger.info(
    'RuleStore',
    `Hydrated ws=${workspaceId}: ${rules.length} rules, ${collections.length} collections, ${folders.length} folders`,
  );
  return getRules();
}

/**
 * Atomically swap the in-memory state to a different workspace. Reads
 * the target workspace's persisted data first, then replaces the
 * singletons and notifies. Writes in flight for the previous workspace
 * are serialized through the in-process event loop — storage.local.set
 * calls are queued in order, so calling this after the last mutation
 * in workspace A is safe.
 */
export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  rules = snapshot.rules;
  collections = snapshot.collections;
  folders = snapshot.folders;
  loadedWorkspaceId = workspaceId;
  logger.info(
    'RuleStore',
    `Switched to ws=${workspaceId}: ${rules.length} rules, ${collections.length} collections, ${folders.length} folders`,
  );
  notifyChange();
}

// ── Test helpers ────────────────────────────────────────────────────

/** Test-only: reset the module without touching storage. */
export function __resetForTests(): void {
  rules = [];
  collections = [];
  folders = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
}
