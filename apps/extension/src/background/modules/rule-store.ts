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

import { CollectionSchema, FolderSchema, RuleSchema } from '@openheaders/core/schemas';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { buildAddBatch, buildDeleteBatch } from '@/shared/sync/rule-mutations';
import { getActiveRuleCache } from '../sync/rule-cache';
import { getOracleForCurrentWorkspace, nextSwMutatorContext } from '../sync/service';
import { driftRecorder } from './storage-drift';
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
  // Cache is the source of truth once `bridgeToSyncEngine()` has wired
  // the oracle's broadcast through to our local mirror. The local
  // `rules` array tracks the cache via the change listener — keep it
  // as the read path so callers stay synchronous + oracle-decoupled.
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
    // Phase 10 write counter — advances on every
    // renameCollection / deleteCollection / updateCollectionVariables.
    version: 1,
    uid,
    path: `rules/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
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
    version: 1,
    uid,
    path: `rules/${folderName}`,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  collections = [...collections, collection];
  void persistCollections();
  return collection;
}

/**
 * Outcome of a versioned collection write (Phase 10 stale-draft
 * contract — parallel to `RuleWriteResult`). Editors that load a
 * collection's variables track the returned version and pass it back
 * as `expectedVersion` on save.
 */
export type CollectionWriteResult =
  | { ok: true; version: number; collection: V5.Collection }
  | { ok: false; reason: 'stale-draft'; serverVersion: number; serverCollection: V5.Collection }
  | { ok: false; reason: 'not-found' };

export interface UpdateCollectionOptions {
  /**
   * Version the client loaded. Omit to opt out of stale-draft
   * detection — used by sidebar rename (no tracked version). The lock
   * alone serializes writes in that case, so the race is still safe.
   */
  expectedVersion?: number;
}

function collectionVersionOf(c: V5.Collection): number {
  return c.version;
}

export async function renameCollection(
  uid: string,
  name: string,
  options: UpdateCollectionOptions = {},
): Promise<CollectionWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'collection', uid),
    async () => {
      const index = collections.findIndex((c) => c.uid === uid);
      if (index === -1) return { ok: false, reason: 'not-found' } as CollectionWriteResult;
      const existing = collections[index];
      const current = collectionVersionOf(existing);
      if (options.expectedVersion !== undefined && options.expectedVersion !== current) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: current,
          serverCollection: existing,
        } as CollectionWriteResult;
      }
      const nextVersion = current + 1;
      const updated: V5.Collection = { ...existing, name, version: nextVersion };
      collections = [...collections.slice(0, index), updated, ...collections.slice(index + 1)];
      await persistCollections();
      return { ok: true, version: nextVersion, collection: updated } as CollectionWriteResult;
    },
    { op: 'collection-rename' },
  );
}

export async function deleteCollection(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'collection', uid),
    async () => {
      const collection = collections.find((c) => c.uid === uid);
      if (!collection) return false;

      // Cascade rule deletes through the oracle so the cache (and
      // hence chrome.storage.local) stays consistent with the
      // collection/folder removals we apply locally.
      const cascadingRuleUids = rules.filter((r) => r.path.startsWith(collection.path)).map((r) => r.uid);
      collections = collections.filter((c) => c.uid !== uid);
      folders = folders.filter((f) => !f.path.startsWith(collection.path));
      await persistCollections();
      await persistFolders();
      for (const ruleUid of cascadingRuleUids) {
        await applyRuleMutationOrThrow((ctx) => buildDeleteBatch(ruleUid, ctx), 'deleteCollection-cascade');
      }
      return true;
    },
    { op: 'collection-delete' },
  );
}

/**
 * Replace a collection's scoped variables. Used by the Variables editor
 * (collection-vars tab) and by the Inspector "add variable" affordance.
 * Returns the full Phase 10 write result so editors can detect
 * stale-draft conflicts when two tabs edit the same collection.
 */
export async function updateCollectionVariables(
  uid: string,
  variables: V5.Variable[],
  options: UpdateCollectionOptions = {},
): Promise<CollectionWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'collection', uid),
    async () => {
      const index = collections.findIndex((c) => c.uid === uid);
      if (index === -1) return { ok: false, reason: 'not-found' } as CollectionWriteResult;
      const existing = collections[index];
      const current = collectionVersionOf(existing);
      if (options.expectedVersion !== undefined && options.expectedVersion !== current) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: current,
          serverCollection: existing,
        } as CollectionWriteResult;
      }
      const nextVersion = current + 1;
      const updated: V5.Collection = { ...existing, variables, version: nextVersion };
      collections = [...collections.slice(0, index), updated, ...collections.slice(index + 1)];
      await persistCollections();
      return { ok: true, version: nextVersion, collection: updated } as CollectionWriteResult;
    },
    { op: 'collection-variables' },
  );
}

export async function updateCollectionPinnedEnvs(
  collectionUid: string,
  pinnedEnvironmentIds: string[],
  defaultEnvironmentId: string | null,
): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'collection', collectionUid),
    async () => {
      const index = collections.findIndex((c) => c.uid === collectionUid);
      if (index === -1) return false;
      const existing = collections[index];
      const updated: V5.Collection = {
        ...existing,
        pinnedEnvironmentIds,
        defaultEnvironmentId,
        version: existing.version + 1,
      };
      collections = [...collections.slice(0, index), updated, ...collections.slice(index + 1)];
      await persistCollections();
      return true;
    },
    { op: 'collection-pinned-envs' },
  );
}

// ── Folders ─────────────────────────────────────────────────────────

export function createFolder(name: string, parentPath: string): LocalFolder {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const folder: LocalFolder = {
    schemaVersion: 5,
    // Phase 10 write counter — advances on renameFolder / deleteFolder.
    version: 1,
    uid,
    path: `${parentPath}/${folderName}`,
    name,
  };
  folders = [...folders, folder];
  void persistFolders();
  return folder;
}

export async function renameFolder(uid: string, name: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'folder', uid),
    async () => {
      const index = folders.findIndex((f) => f.uid === uid);
      if (index === -1) return false;
      const existing = folders[index];
      const nextVersion = existing.version + 1;
      folders = [...folders.slice(0, index), { ...existing, name, version: nextVersion }, ...folders.slice(index + 1)];
      await persistFolders();
      return true;
    },
    { op: 'folder-rename' },
  );
}

export async function deleteFolder(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'folder', uid),
    async () => {
      const folder = folders.find((f) => f.uid === uid);
      if (!folder) return false;

      const cascadingRuleUids = rules.filter((r) => r.path.startsWith(`${folder.path}/`)).map((r) => r.uid);
      folders = folders.filter((f) => f.uid !== uid && !f.path.startsWith(`${folder.path}/`));
      await persistFolders();
      for (const ruleUid of cascadingRuleUids) {
        await applyRuleMutationOrThrow((ctx) => buildDeleteBatch(ruleUid, ctx), 'deleteFolder-cascade');
      }
      return true;
    },
    { op: 'folder-delete' },
  );
}

// ── Rules ───────────────────────────────────────────────────────────

/**
 * Add a rule. `parentPath` is the collection or folder path.
 * `schemaVersion` is owned by the store — callers provide the feature
 * payload, the store stamps the persisted version.
 *
 * Routes through the sync oracle: emits a seed batch (one create +
 * one addToSet per set-modeled item) and awaits the broadcast-driven
 * cache refresh so the returned rule is observable from `getRules()`
 * before the function resolves.
 */
export async function addRule(
  rule: Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>,
  parentPath: string,
): Promise<V5.Rule> {
  const uid = generateUid();
  const folderName = toFolderName(rule.name, uid);
  const created = {
    schemaVersion: 5,
    ...rule,
    uid,
    path: `${parentPath}/${folderName}`,
  } as V5.Rule;
  await applyRuleMutationOrThrow((ctx) => buildAddBatch(created, ctx), 'addRule');
  return created;
}

/**
 * Add a rule within a collection by uid. Resolves the collection path,
 * then calls `addRule`.
 */
export function addRuleToCollection(
  rule: Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>,
  collectionUid: string,
): Promise<V5.Rule> {
  const collection = collections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `rules/${collectionUid}`;
  return addRule(rule, parentPath);
}

export async function deleteRule(uid: string): Promise<boolean> {
  assertLoaded();
  if (!rules.some((r) => r.uid === uid)) return false;
  await applyRuleMutationOrThrow((ctx) => buildDeleteBatch(uid, ctx), 'deleteRule');
  return true;
}

// ── Sync engine plumbing ────────────────────────────────────────────

/**
 * Mint an SW context, build a batch via `factory`, and apply it through
 * the active oracle. Throws when the sync service hasn't been
 * initialized — that would mean a write site beat boot, which the
 * background's init order is designed to prevent. The throw surfaces
 * the order violation immediately rather than silently dropping the
 * write.
 */
async function applyRuleMutationOrThrow(
  factory: (ctx: import('@openheaders/core/sync').MutatorContext) => {
    batch: import('@openheaders/core/sync').MutationBatch;
    sideEffects: import('@openheaders/core/sync').SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RuleStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RuleStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

// ── Persistence (scoped to loadedWorkspaceId) ──────────────────────
//
// Rules persistence is owned by the sync engine's `RuleCache` —
// `chrome.storage.local` writes happen on every broadcast-driven
// re-projection. The collection + folder helpers below stay on the
// legacy direct-write path until Phase B brings them onto the oracle.

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
  const [rules, collections, folders] = await Promise.all([
    extensionStorage.getValidatedArray(keys.rules, RuleSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        statusSubsystem: 'rules',
        storageKey: keys.rules.key,
        workspaceId,
      }),
    }),
    extensionStorage.getValidatedArray(keys.collections, CollectionSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        statusSubsystem: 'rules',
        storageKey: keys.collections.key,
        workspaceId,
      }),
    }),
    extensionStorage.getValidatedArray(keys.folders, FolderSchema, {
      onError: driftRecorder({
        subsystem: 'rule-engine',
        statusSubsystem: 'rules',
        storageKey: keys.folders.key,
        workspaceId,
      }),
    }),
  ]);
  return { rules, collections, folders };
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

// ── Sync engine bridge ──────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;

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
  const cache = getActiveRuleCache();
  if (!cache) {
    logger.info('RuleStore', 'bridgeToSyncEngine: no active cache; skipping');
    return;
  }
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = cache.onChange(() => {
    rules = cache.getRules();
    notifyChange();
  });
  await cache.seedFromPersistedRules(rules);
  // After the seed, broadcasts have driven the listener above so
  // `rules` already reflects cache.getRules(). Belt-and-braces: copy
  // the cache view explicitly so a zero-rules workspace (no
  // broadcasts → listener never fires) still ends up with `rules`
  // pointed at the cache's snapshot.
  rules = cache.getRules();
}

// ── Test helpers ────────────────────────────────────────────────────

/** Test-only: reset the module without touching storage. */
export function __resetForTests(): void {
  rules = [];
  collections = [];
  folders = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}
