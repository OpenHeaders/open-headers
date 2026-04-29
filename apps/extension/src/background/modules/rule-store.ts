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
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  collectionInvalidateResolverIntent,
  FOLDER_ENTITY_TYPE,
  type FolderParentRef,
  mintBatch as mintCollectionBatch,
  type MutationBody,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import {
  buildDeleteCollectionBatch,
  buildRenameCollectionBatch,
  buildSetPinnedAndDefaultBatch,
} from '@/shared/sync/collection-mutations';
import { seedCollection } from '@/shared/sync/collection-projection';
import {
  buildCreateFolderBatch,
  buildDeleteFolderBatch,
  buildDeleteFolderEntityBatch,
  buildRenameFolderBatch,
} from '@/shared/sync/folder-mutations';
import { buildAddBatch, buildDeleteBatch } from '@/shared/sync/rule-mutations';
import { getActiveCollectionCache } from '../sync/collection-cache';
import { getActiveFolderCache } from '../sync/folder-cache';
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

/**
 * Synchronously return the default collection if it already exists,
 * or mint and seed one through the oracle. The seed batch fires
 * fire-and-forget; the local mirror updates on the broadcast that
 * follows. Callers that need the post-commit collection on disk
 * should `await ensureDefaultCollection()`.
 */
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
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  // Optimistic local insert so synchronous callers see the new
  // collection immediately; the oracle's broadcast will confirm the
  // identical post-commit shape (variables list re-projected from
  // its addToSet members).
  collections = [...collections, collection];
  void applyCollectionMutationOrThrow(
    (ctx) => ({ batch: seedCollection(collection, ctx), sideEffects: [] }),
    'ensureDefaultCollection',
  );
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
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  collections = [...collections, collection];
  void applyCollectionMutationOrThrow(
    (ctx) => ({ batch: seedCollection(collection, ctx), sideEffects: [] }),
    'createCollection',
  );
  return collection;
}

/**
 * Outcome of a collection write. The legacy stale-draft branch is
 * retired in Phase B — convergence is per-(field) LWW at the oracle,
 * not a versioned compare-and-set.
 */
export type CollectionWriteResult =
  | { ok: true; collection: V5.Collection }
  | { ok: false; reason: 'not-found' };

export async function renameCollection(uid: string, name: string): Promise<CollectionWriteResult> {
  assertLoaded();
  const existing = collections.find((c) => c.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };
  await applyCollectionMutationOrThrow(
    (ctx) => buildRenameCollectionBatch({ collectionUid: uid, name }, ctx),
    'renameCollection',
  );
  return { ok: true, collection: { ...existing, name } };
}

export async function deleteCollection(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'collection', uid),
    async () => {
      const collection = collections.find((c) => c.uid === uid);
      if (!collection) return false;

      // Cascade rule + folder deletes through the oracle so every cache
      // stays consistent. The collection's tombstone covers its parent
      // slot for top-level folders; nested folders/rules are deleted by
      // uid through the oracle.
      const cascadingRuleUids = rules.filter((r) => r.path.startsWith(collection.path)).map((r) => r.uid);
      const cascadingFolderUids = folders.filter((f) => f.path.startsWith(collection.path)).map((f) => f.uid);
      for (const ruleUid of cascadingRuleUids) {
        await applyRuleMutationOrThrow((ctx) => buildDeleteBatch(ruleUid, ctx), 'deleteCollection-cascade');
      }
      for (const folderUid of cascadingFolderUids) {
        await applyFolderMutationOrThrow(
          (ctx) => ({
            batch: buildDeleteFolderEntityBatch(folderUid, ctx),
            sideEffects: [],
          }),
          'deleteCollection-cascade-folder',
        );
      }
      // Tombstone the collection through the oracle — the broadcast
      // drives the cache + local mirror update.
      await applyCollectionMutationOrThrow(
        (ctx) => ({ batch: buildDeleteCollectionBatch(uid, ctx), sideEffects: [] }),
        'deleteCollection',
      );
      return true;
    },
    { op: 'collection-delete' },
  );
}

/**
 * Replace a collection's scoped variables. SW entry point used by the
 * legacy `updateCollectionVariables` bridge dispatch; the renderer
 * goes through `applyCollectionVariablesReplacement` directly via
 * `useVariableMutator` / `useCollectionMutator`. Both paths converge
 * through the same oracle.
 */
export async function updateCollectionVariables(
  uid: string,
  variables: V5.Variable[],
): Promise<CollectionWriteResult> {
  assertLoaded();
  const existing = collections.find((c) => c.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };

  await applyCollectionMutationOrThrow((ctx) => {
    const replaceCtx = { ...ctx, batchId: ctx.batchId ?? `coll-replace-${uid}` };
    const bodies = buildVariableReplacementBodies(uid, existing.variables, variables);
    if (bodies.length === 0) return { batch: mintCollectionBatch(replaceCtx, []), sideEffects: [] };
    return {
      batch: mintCollectionBatch(replaceCtx, bodies),
      sideEffects: [collectionInvalidateResolverIntent(uid, replaceCtx.hlc)],
    };
  }, 'updateCollectionVariables');

  return { ok: true, collection: { ...existing, variables } };
}

export async function updateCollectionPinnedEnvs(
  collectionUid: string,
  pinnedEnvironmentIds: string[],
  defaultEnvironmentId: string | null,
): Promise<boolean> {
  assertLoaded();
  if (!collections.some((c) => c.uid === collectionUid)) return false;
  await applyCollectionMutationOrThrow(
    (ctx) =>
      buildSetPinnedAndDefaultBatch({ collectionUid, pinnedEnvironmentIds, defaultEnvironmentId }, {
        ...ctx,
        batchId: ctx.batchId ?? `coll-pinned-${collectionUid}`,
      }),
    'updateCollectionPinnedEnvs',
  );
  return true;
}

function buildVariableReplacementBodies(
  collectionUid: string,
  oldVars: readonly V5.Variable[],
  newVars: readonly V5.Variable[],
): MutationBody[] {
  const oldByName = new Map<string, V5.Variable>();
  for (const v of oldVars) oldByName.set(v.name, v);
  const newByName = new Map<string, V5.Variable>();
  for (const v of newVars) {
    if (!v.name.trim()) continue;
    newByName.set(v.name, v);
  }

  const bodies: MutationBody[] = [];
  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: COLLECTION_ENTITY_TYPE,
      id: collectionUid,
      path: COLLECTION_VARS_PATH,
      itemId: name,
    });
  }
  for (const [name, variable] of newByName) {
    const prev = oldByName.get(name);
    if (
      prev &&
      prev.value === variable.value &&
      (prev.type ?? 'default') === (variable.type ?? 'default')
    ) {
      continue;
    }
    bodies.push({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: collectionUid,
      path: COLLECTION_VARS_PATH,
      itemId: name,
      item: { name, value: variable.value, type: variable.type ?? 'default' },
    });
  }
  return bodies;
}

// ── Folders ─────────────────────────────────────────────────────────

/**
 * Resolve `parentPath` to a {@link FolderParentRef} via the local
 * mirrors. `parentPath` matches a collection root (`rules/<slug>-<uid>`)
 * or a folder path (`<collectionPath>/<slug>-<uid>`); we look up
 * collections first because their paths are shorter prefixes of
 * descendant folders.
 */
function resolveFolderParent(parentPath: string): FolderParentRef | null {
  const collection = collections.find((c) => c.path === parentPath);
  if (collection) return { type: COLLECTION_ENTITY_TYPE, uid: collection.uid };
  const folder = folders.find((f) => f.path === parentPath);
  if (folder) return { type: FOLDER_ENTITY_TYPE, uid: folder.uid };
  return null;
}

/**
 * Create a folder under `parentPath`. Routes through the oracle via
 * the folder catalog's atomic `(create folder + addToSet on parent)`
 * batch (§11.2). Returns the synthesized folder shape immediately —
 * the broadcast-driven `bridgeFolderSyncEngine` confirms the same
 * post-commit shape on the next tick.
 */
export async function createFolder(name: string, parentPath: string): Promise<LocalFolder | null> {
  assertLoaded();
  const parent = resolveFolderParent(parentPath);
  if (!parent) {
    logger.info('RuleStore', `createFolder: parent path not resolvable: ${parentPath}`);
    return null;
  }
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  await applyFolderMutationOrThrow(
    (ctx) =>
      buildCreateFolderBatch(
        { folderUid: uid, parent, name, pathSegment: folderName },
        { ...ctx, batchId: ctx.batchId ?? `folder-create-${uid}` },
      ),
    'createFolder',
  );
  return { schemaVersion: 5, uid, path: `${parentPath}/${folderName}`, name };
}

export async function renameFolder(uid: string, name: string): Promise<boolean> {
  assertLoaded();
  if (!folders.some((f) => f.uid === uid)) return false;
  await applyFolderMutationOrThrow(
    (ctx) => buildRenameFolderBatch({ folderUid: uid, name }, ctx),
    'renameFolder',
  );
  return true;
}

export async function deleteFolder(uid: string): Promise<boolean> {
  assertLoaded();
  const folder = folders.find((f) => f.uid === uid);
  if (!folder) return false;
  const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
  const parent = resolveFolderParent(parentPath);

  // Cascade descendant rule + folder deletes through the oracle.
  // Folder cascade walks every nested folder by path-prefix; rules use
  // the same pattern (rules can also live inside nested folders).
  const cascadingRuleUids = rules.filter((r) => r.path.startsWith(`${folder.path}/`)).map((r) => r.uid);
  const cascadingNestedFolderUids = folders
    .filter((f) => f.uid !== uid && f.path.startsWith(`${folder.path}/`))
    .map((f) => f.uid);
  for (const ruleUid of cascadingRuleUids) {
    await applyRuleMutationOrThrow((ctx) => buildDeleteBatch(ruleUid, ctx), 'deleteFolder-cascade-rule');
  }
  for (const nestedUid of cascadingNestedFolderUids) {
    await applyFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteFolderEntityBatch(nestedUid, ctx), sideEffects: [] }),
      'deleteFolder-cascade-folder',
    );
  }
  // Final delete: the folder itself + its parent slot. Parent ref is
  // resolved above; if missing (parent already tombstoned), fall back
  // to the bare entity tombstone — the parent's tombstone covers slot
  // cleanup.
  if (parent) {
    await applyFolderMutationOrThrow(
      (ctx) => buildDeleteFolderBatch({ folderUid: uid, parent }, ctx),
      'deleteFolder',
    );
  } else {
    await applyFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteFolderEntityBatch(uid, ctx), sideEffects: [] }),
      'deleteFolder',
    );
  }
  return true;
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

async function applyFolderMutationOrThrow(
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
      `RuleStore.${op}: oracle rejected folder batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

async function applyCollectionMutationOrThrow(
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
      `RuleStore.${op}: oracle rejected collection batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

// ── Persistence (scoped to loadedWorkspaceId) ──────────────────────
//
// Rules + collections + folders persistence is owned by the sync
// engine's {@link RuleCache} + {@link CollectionCache} +
// {@link FolderCache} — `chrome.storage.local` writes happen on every
// broadcast-driven re-projection.

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
let collectionCacheUnsubscribe: (() => void) | null = null;
let folderCacheUnsubscribe: (() => void) | null = null;

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

/**
 * Wire the local `collections` array to the active workspace's
 * {@link CollectionCache}: seed the oracle from the hydrated
 * collections, then subscribe to broadcast-driven re-projections so
 * subsequent mutations flow back into the local mirror. Same shape as
 * {@link bridgeToSyncEngine}; idempotent. Call AFTER
 * `initSyncService(workspaceId)` AND AFTER hydration / switch.
 */
export async function bridgeCollectionSyncEngine(): Promise<void> {
  const cache = getActiveCollectionCache();
  if (!cache) {
    logger.info('RuleStore', 'bridgeCollectionSyncEngine: no active cache; skipping');
    return;
  }
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    collectionCacheUnsubscribe = null;
  }
  collectionCacheUnsubscribe = cache.onChange(() => {
    collections = cache.getCollections();
    notifyChange();
  });
  await cache.seedFromPersistedCollections(collections);
  collections = cache.getCollections();
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
  const cache = getActiveFolderCache();
  if (!cache) {
    logger.info('RuleStore', 'bridgeFolderSyncEngine: no active cache; skipping');
    return;
  }
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    folderCacheUnsubscribe = null;
  }
  folderCacheUnsubscribe = cache.onChange(() => {
    folders = cache.getFolders();
    notifyChange();
  });
  await cache.seedFromPersistedFolders(folders, collections);
  folders = cache.getFolders();
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
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    collectionCacheUnsubscribe = null;
  }
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    folderCacheUnsubscribe = null;
  }
}
