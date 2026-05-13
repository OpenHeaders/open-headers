/**
 * Request Store — single source of truth for HTTP requests in the
 * active workspace.
 *
 * Mirrors `rule-store.ts` post Phase B: writes route through the sync
 * oracle (catalog factory → MutationBatch → `oracle.apply`); the
 * {@link RequestCache} owns `chrome.storage.local` persistence + drives
 * the local mirror via broadcast-driven re-projection. Reads stay
 * synchronous off the local mirror so consumers (executor, sidebar,
 * inspector) don't have to thread the oracle through their call paths.
 *
 * Storage (every key scoped under the active workspace id):
 *   - requests            → `oh.ws.<id>.requests`           (cache-owned)
 *   - requestCollections  → `oh.ws.<id>.requestCollections` (legacy direct write — request collections + folders are queued for their own pipeline pass; see status doc Session 21)
 *   - requestFolders      → `oh.ws.<id>.requestFolders`     (legacy direct write)
 *
 * Paths live under `requests/` (vs. `rules/` for rule-store) so the
 * two entity trees never collide in on-disk format used by team
 * workspaces.
 */

import { CollectionSchema, FolderSchema, RequestSchema } from '@openheaders/core/schemas';
import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
} from '@openheaders/core/sync';
import type { Collection, CollectionTree, Request, TreeNode } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import type { PersistedLocalFolder } from '@openheaders/oracle/storage';
import { extensionStorage, wsKeys } from '@openheaders/oracle/storage';
import {
  buildDeleteRequestCollectionBatch,
  buildRenameRequestCollectionBatch,
} from '@openheaders/oracle/sync-builders/request-collection-mutations';
import { seedRequestCollection } from '@openheaders/oracle/sync-builders/request-collection-projection';
import {
  buildCreateRequestFolderBatch,
  buildDeleteRequestFolderBatch,
  buildDeleteRequestFolderEntityBatch,
  buildRenameRequestFolderBatch,
} from '@openheaders/oracle/sync-builders/request-folder-mutations';
import { buildAddBatch, buildDeleteBatch, buildUpdateBatch } from '@openheaders/oracle/sync-builders/request-mutations';
import {
  REQUEST_COLLECTION_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  REQUEST_REGISTRATION,
} from '@openheaders/oracle/sync/entity-registry';
import type { RequestCache } from '@openheaders/oracle/sync/request-cache';
import type { RequestCollectionCache } from '@openheaders/oracle/sync/request-collection-cache';
import type { RequestFolderCache } from '@openheaders/oracle/sync/request-folder-cache';
import {
  getActiveCacheForRegistration,
  getCacheForWorkspace,
  getOracleForCurrentWorkspace,
  nextSwMutatorContext,
} from '@openheaders/oracle/sync/service';
import { driftRecorder } from '@openheaders/oracle/sync/storage-drift';
import { getActiveWorkspaceId } from './workspace-store';

/** Re-export from rule-store-style shape. Identical runtime layout. */
export type LocalFolder = PersistedLocalFolder;

// ── In-memory state (scoped to the currently active workspace) ──────

let requests: Request[] = [];
let collections: Collection[] = [];
let folders: LocalFolder[] = [];
let loadedWorkspaceId: string | null = null;

// ── Change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
const changeListeners: Set<ChangeListener> = new Set();

export function onRequestStoreChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange(): void {
  for (const listener of changeListeners) listener();
}

// ── Reads ────────────────────────────────────────────────────────────

export function getRequests(): Request[] {
  return requests;
}

export function getRequestCollections(): Collection[] {
  return collections;
}

export function getRequestFolders(): LocalFolder[] {
  return folders;
}

/** Build CollectionTree[] from flat collections + folders + requests. */
export function getRequestCollectionTrees(): CollectionTree[] {
  return collections.map((collection) => {
    const tree = buildTreeForParent(REQUEST_COLLECTION_ENTITY_TYPE, collection.uid, collection.path);
    return { ...collection, tree };
  });
}

/**
 * Build TreeNode[] for the children of a request-collection or
 * request-folder. Folder siblings render in the order carried by the
 * parent's `folders` set (§7.2 + §23.5). Requests inside the same
 * parent keep their cache-array order — requests don't live in a
 * parent set today.
 */
function buildTreeForParent(
  parentType: typeof REQUEST_COLLECTION_ENTITY_TYPE | typeof REQUEST_FOLDER_ENTITY_TYPE,
  parentUid: string,
  parentPath: string,
): TreeNode[] {
  const nodes: TreeNode[] = [];

  const oracle = getOracleForCurrentWorkspace();
  const slots = oracle ? oracle.liveOrderedSetItems(parentType, parentUid, REQUEST_FOLDER_CHILDREN_PATH) : [];

  let childFolders: PersistedLocalFolder[];
  if (slots.length > 0) {
    const byUid = new Map(folders.map((f) => [f.uid, f]));
    childFolders = slots.map((slot) => byUid.get(slot.itemId)).filter((f): f is PersistedLocalFolder => Boolean(f));
  } else {
    childFolders = folders.filter((f) => f.path.substring(0, f.path.lastIndexOf('/')) === parentPath);
  }

  for (const folder of childFolders) {
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children: buildTreeForParent(REQUEST_FOLDER_ENTITY_TYPE, folder.uid, folder.path),
    });
  }

  const childRequests = requests.filter((r) => r.path.substring(0, r.path.lastIndexOf('/')) === parentPath);
  for (const request of childRequests) {
    nodes.push({
      type: 'request',
      uid: request.uid,
      name: request.name,
      path: request.path,
      method: request.method,
    });
  }

  return nodes;
}

// ── Collections ─────────────────────────────────────────────────────

const DEFAULT_COLLECTION_NAME = 'My Requests';

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('RequestStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

export async function ensureDefaultRequestCollection(): Promise<Collection> {
  const existing = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `requests/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  // Optimistic local insert so synchronous callers see the new
  // collection immediately; the oracle's broadcast confirms the same
  // post-commit shape on the next tick.
  collections = [...collections, collection];
  await applyRequestCollectionMutationOrThrow(
    (ctx) => ({ batch: seedRequestCollection(collection, ctx), sideEffects: [] }),
    'ensureDefaultRequestCollection',
  );
  return collection;
}

export async function createRequestCollection(name: string): Promise<Collection> {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const collection: Collection = {
    schemaVersion: 5,
    uid,
    path: `requests/${folderName}`,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  collections = [...collections, collection];
  await applyRequestCollectionMutationOrThrow(
    (ctx) => ({ batch: seedRequestCollection(collection, ctx), sideEffects: [] }),
    'createRequestCollection',
  );
  return collection;
}

export async function renameRequestCollection(uid: string, name: string): Promise<boolean> {
  assertLoaded();
  if (!collections.some((c) => c.uid === uid)) return false;
  await applyRequestCollectionMutationOrThrow(
    (ctx) => buildRenameRequestCollectionBatch({ collectionUid: uid, name }, ctx),
    'renameRequestCollection',
  );
  return true;
}

export async function deleteRequestCollection(uid: string): Promise<boolean> {
  assertLoaded();
  const collection = collections.find((c) => c.uid === uid);
  if (!collection) return false;

  // Cascade descendant request + request-folder deletes through the
  // oracle so every cache stays consistent. The collection's tombstone
  // covers its parent slot for top-level folders; nested folders/requests
  // are deleted by uid through the oracle.
  const cascadingRequestUids = requests.filter((r) => r.path.startsWith(collection.path)).map((r) => r.uid);
  const cascadingFolderUids = folders.filter((f) => f.path.startsWith(collection.path)).map((f) => f.uid);
  for (const reqUid of cascadingRequestUids) {
    await applyRequestMutationOrThrow((ctx) => buildDeleteBatch(reqUid, ctx), 'deleteRequestCollection-cascade');
  }
  for (const folderUid of cascadingFolderUids) {
    await applyRequestFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteRequestFolderEntityBatch(folderUid, ctx), sideEffects: [] }),
      'deleteRequestCollection-cascade-folder',
    );
  }
  // Tombstone the collection through the oracle — the broadcast drives
  // the cache + local mirror update.
  await applyRequestCollectionMutationOrThrow(
    (ctx) => ({ batch: buildDeleteRequestCollectionBatch(uid, ctx), sideEffects: [] }),
    'deleteRequestCollection',
  );
  return true;
}

// ── Folders ─────────────────────────────────────────────────────────

/**
 * Resolve `parentPath` to a {@link RequestFolderParentRef} via the
 * local mirrors. `parentPath` matches a request collection root
 * (`requests/<slug>-<uid>`) or a request folder path.
 */
function resolveRequestFolderParent(parentPath: string): RequestFolderParentRef | null {
  const collection = collections.find((c) => c.path === parentPath);
  if (collection) return { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.uid };
  const folder = folders.find((f) => f.path === parentPath);
  if (folder) return { type: REQUEST_FOLDER_ENTITY_TYPE, uid: folder.uid };
  return null;
}

export async function createRequestFolder(name: string, parentPath: string): Promise<LocalFolder | null> {
  assertLoaded();
  const parent = resolveRequestFolderParent(parentPath);
  if (!parent) return null;
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  await applyRequestFolderMutationOrThrow(
    (ctx) =>
      buildCreateRequestFolderBatch(
        { folderUid: uid, parent, name, pathSegment: folderName },
        { ...ctx, batchId: ctx.batchId ?? `request-folder-create-${uid}` },
      ),
    'createRequestFolder',
  );
  return { schemaVersion: 5, uid, path: `${parentPath}/${folderName}`, name };
}

export async function renameRequestFolder(uid: string, name: string): Promise<boolean> {
  assertLoaded();
  if (!folders.some((f) => f.uid === uid)) return false;
  await applyRequestFolderMutationOrThrow(
    (ctx) => buildRenameRequestFolderBatch({ folderUid: uid, name }, ctx),
    'renameRequestFolder',
  );
  return true;
}

export async function deleteRequestFolder(uid: string): Promise<boolean> {
  assertLoaded();
  const folder = folders.find((f) => f.uid === uid);
  if (!folder) return false;
  const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'));
  const parent = resolveRequestFolderParent(parentPath);

  // Cascade descendant request + request-folder deletes through the
  // oracle. Same pattern as rule-folder cascades.
  const cascadingRequestUids = requests.filter((r) => r.path.startsWith(`${folder.path}/`)).map((r) => r.uid);
  const cascadingNestedFolderUids = folders
    .filter((f) => f.uid !== uid && f.path.startsWith(`${folder.path}/`))
    .map((f) => f.uid);
  for (const reqUid of cascadingRequestUids) {
    await applyRequestMutationOrThrow((ctx) => buildDeleteBatch(reqUid, ctx), 'deleteRequestFolder-cascade-request');
  }
  for (const nestedUid of cascadingNestedFolderUids) {
    await applyRequestFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteRequestFolderEntityBatch(nestedUid, ctx), sideEffects: [] }),
      'deleteRequestFolder-cascade-folder',
    );
  }
  // Final delete: the folder itself + its parent slot. Parent ref is
  // resolved above; if missing (parent already tombstoned), fall back
  // to the bare entity tombstone.
  if (parent) {
    await applyRequestFolderMutationOrThrow(
      (ctx) => buildDeleteRequestFolderBatch({ folderUid: uid, parent }, ctx),
      'deleteRequestFolder',
    );
  } else {
    await applyRequestFolderMutationOrThrow(
      (ctx) => ({ batch: buildDeleteRequestFolderEntityBatch(uid, ctx), sideEffects: [] }),
      'deleteRequestFolder',
    );
  }
  return true;
}

// ── Requests ────────────────────────────────────────────────────────

/** Seed shape for a fresh request — name + minimal defaults. */
export async function addRequest(
  name: string,
  parentPath: string,
  seed?: Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<Request> {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const created: Request = {
    schemaVersion: 5,
    uid,
    path: `${parentPath}/${folderName}`,
    name,
    method: seed?.method ?? 'GET',
    url: seed?.url ?? '',
    headers: seed?.headers ?? [],
    params: seed?.params ?? [],
    auth: seed?.auth ?? { type: 'inherit' },
    body: seed?.body ?? { type: 'none' },
    ...(seed?.description ? { description: seed.description } : {}),
    ...(seed?.credentialsMode ? { credentialsMode: seed.credentialsMode } : {}),
    ...(seed?.followRedirects !== undefined ? { followRedirects: seed.followRedirects } : {}),
    ...(seed?.preRequestScript ? { preRequestScript: seed.preRequestScript } : {}),
    ...(seed?.postResponseScript ? { postResponseScript: seed.postResponseScript } : {}),
  };
  await applyRequestMutationOrThrow((ctx) => buildAddBatch(created, ctx), 'addRequest');
  return created;
}

export function addRequestToCollection(
  name: string,
  collectionUid: string,
  seed?: Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<Request> {
  const collection = collections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `requests/${collectionUid}`;
  return addRequest(name, parentPath, seed);
}

export function getRequest(uid: string): Request | null {
  return requests.find((r) => r.uid === uid) ?? null;
}

/**
 * Look up a request scoped to an explicit workspace via its
 * {@link RequestCache}. Returns null when no service is materialized
 * for the workspace OR no request with that uid exists in it. Used by
 * the live-refresh chain executor when refreshing workflows in a
 * non-Active workspace under MWPT-FULL session #19 — the Active-bound
 * {@link getRequest} would silently miss requests that live in a per-
 * tab editing-scope workspace.
 */
export function getRequestInWorkspace(uid: string, workspaceId: string): Request | null {
  const cache = getCacheForWorkspace<RequestCache>(REQUEST_REGISTRATION, workspaceId);
  if (!cache) return null;
  return cache.getRequests().find((r) => r.uid === uid) ?? null;
}

/**
 * Snapshot every request collection in an explicit workspace via its
 * {@link RequestCollectionCache}. Returns `[]` when no service is
 * materialized for the workspace. Drives the per-workspace variable
 * scope feed (collection-vars) for chain refresh executions targeting
 * a non-Active workspace.
 */
export function getRequestCollectionsForWorkspace(workspaceId: string): Collection[] {
  const cache = getCacheForWorkspace<RequestCollectionCache>(REQUEST_COLLECTION_REGISTRATION, workspaceId);
  return cache ? cache.getRequestCollections() : [];
}

/**
 * Outcome of a request write. The legacy stale-draft branch is retired
 * in Phase B — convergence is per-(field) LWW at the oracle, not a
 * versioned compare-and-set.
 */
export type RequestWriteResult =
  | { ok: true; request: Request }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateRequest(
  uid: string,
  updates: Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<RequestWriteResult> {
  assertLoaded();
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    return { ok: false, reason: 'other', message: 'sync service not initialized' };
  }
  const existing = requests.find((r) => r.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };

  // SW-side oracle exposes `(itemId, item, key)`; adapt to the
  // `LiveSetEntries` shape (`orderKey` rename) so the diff-detect can
  // compute `moveBefore` against fractional keys.
  const payload = buildUpdateBatch(uid, updates, ctx, (requestUid, setPath) =>
    oracle
      .liveOrderedSetItems(REQUEST_ENTITY_TYPE, requestUid, setPath)
      .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
  );
  if (payload.batch.mutations.length === 0) {
    // No-op patch — return the canonical pre-image.
    return { ok: true, request: existing };
  }
  const result = await oracle.apply(payload.batch, payload.sideEffects);
  if (!result.ok) {
    return {
      ok: false,
      reason: 'other',
      message: result.failure?.detail ?? 'oracle rejected request batch',
    };
  }
  // Optimistic merge — broadcast-driven cache projection lands the
  // authoritative shape back into the local mirror momentarily.
  return { ok: true, request: { ...existing, ...updates } as Request };
}

export async function deleteRequest(uid: string): Promise<boolean> {
  assertLoaded();
  if (!requests.some((r) => r.uid === uid)) return false;
  await applyRequestMutationOrThrow((ctx) => buildDeleteBatch(uid, ctx), 'deleteRequest');
  return true;
}

// ── Sync engine plumbing ────────────────────────────────────────────

/**
 * Mint an SW context, build a batch via `factory`, and apply it through
 * the active oracle. Mirrors {@link rule-store}'s helper — throws when
 * the sync service hasn't been initialized so the order violation
 * surfaces immediately rather than silently dropping the write.
 */
async function applyRequestMutationOrThrow(
  factory: (ctx: import('@openheaders/core/sync').MutatorContext) => {
    batch: import('@openheaders/core/sync').MutationBatch;
    sideEffects: import('@openheaders/core/sync').SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RequestStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RequestStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

async function applyRequestCollectionMutationOrThrow(
  factory: (ctx: import('@openheaders/core/sync').MutatorContext) => {
    batch: import('@openheaders/core/sync').MutationBatch;
    sideEffects: import('@openheaders/core/sync').SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RequestStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RequestStore.${op}: oracle rejected request-collection batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

async function applyRequestFolderMutationOrThrow(
  factory: (ctx: import('@openheaders/core/sync').MutatorContext) => {
    batch: import('@openheaders/core/sync').MutationBatch;
    sideEffects: import('@openheaders/core/sync').SideEffectIntent[];
  },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`RequestStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `RequestStore.${op}: oracle rejected request-folder batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

// ── Persistence ─────────────────────────────────────────────────────
//
// All three caches own `chrome.storage.local` writes via broadcast-
// driven re-projection: {@link RequestCache} for requests, the
// request-collection cache for `requestCollections`, the request-folder
// cache for `requestFolders`.

// ── Hydration / workspace switch ────────────────────────────────────

interface WorkspaceSnapshot {
  requests: Request[];
  collections: Collection[];
  folders: LocalFolder[];
}

async function readWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
  const keys = wsKeys(workspaceId);
  const [requests, collections, folders] = await Promise.all([
    extensionStorage.getValidatedArray(keys.requests, RequestSchema, {
      onError: driftRecorder({ subsystem: 'request-executor', storageKey: keys.requests.key, workspaceId }),
    }),
    extensionStorage.getValidatedArray(keys.requestCollections, CollectionSchema, {
      onError: driftRecorder({ subsystem: 'request-executor', storageKey: keys.requestCollections.key, workspaceId }),
    }),
    extensionStorage.getValidatedArray(keys.requestFolders, FolderSchema, {
      onError: driftRecorder({ subsystem: 'request-executor', storageKey: keys.requestFolders.key, workspaceId }),
    }),
  ]);
  return { requests, collections, folders };
}

export async function hydrateFromStorage(): Promise<Request[]> {
  const workspaceId = getActiveWorkspaceId();
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  requests = snapshot.requests;
  collections = snapshot.collections;
  folders = snapshot.folders;
  loadedWorkspaceId = workspaceId;
  logger.info(
    'RequestStore',
    `Hydrated ws=${workspaceId}: ${requests.length} requests, ${collections.length} collections, ${folders.length} folders`,
  );
  return getRequests();
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  const snapshot = await readWorkspaceSnapshot(workspaceId);
  requests = snapshot.requests;
  collections = snapshot.collections;
  folders = snapshot.folders;
  loadedWorkspaceId = workspaceId;
  logger.info(
    'RequestStore',
    `Switched to ws=${workspaceId}: ${requests.length} requests, ${collections.length} collections, ${folders.length} folders`,
  );
  notifyChange();
}

// ── Sync engine bridge ──────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;
let collectionCacheUnsubscribe: (() => void) | null = null;
let folderCacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local `requests` array to the active workspace's
 * {@link RequestCache}: seed the oracle from the hydrated requests,
 * then subscribe to broadcast-driven re-projections so subsequent
 * mutations flow back into the local mirror. Idempotent — the prior
 * cache subscription is dropped first.
 */
export async function bridgeRequestSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestCache>(REQUEST_REGISTRATION);
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = cache.onChange(() => {
    requests = cache.getRequests();
    notifyChange();
  });
  await cache.seedFromPersistedRequests(requests);
  requests = cache.getRequests();
}

/**
 * Wire the local `collections` array to the active workspace's
 * request-collection cache. Same shape as `bridgeRequestSyncEngine`.
 */
export async function bridgeRequestCollectionSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestCollectionCache>(REQUEST_COLLECTION_REGISTRATION);
  if (!cache) return;
  if (collectionCacheUnsubscribe) {
    collectionCacheUnsubscribe();
    collectionCacheUnsubscribe = null;
  }
  collectionCacheUnsubscribe = cache.onChange(() => {
    collections = cache.getRequestCollections();
    notifyChange();
  });
  await cache.seedFromPersistedRequestCollections(collections);
  collections = cache.getRequestCollections();
}

/**
 * Wire the local `folders` array to the active workspace's
 * request-folder cache. Call AFTER `bridgeRequestCollectionSyncEngine()`
 * so the parent collection slots already exist in the oracle when each
 * folder seeds.
 */
export async function bridgeRequestFolderSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<RequestFolderCache>(REQUEST_FOLDER_REGISTRATION);
  if (!cache) return;
  if (folderCacheUnsubscribe) {
    folderCacheUnsubscribe();
    folderCacheUnsubscribe = null;
  }
  folderCacheUnsubscribe = cache.onChange(() => {
    folders = cache.getRequestFolders();
    notifyChange();
  });
  await cache.seedFromPersistedRequestFolders(folders, collections);
  folders = cache.getRequestFolders();
}

// ── Test helpers ────────────────────────────────────────────────────

export function __resetForTests(): void {
  requests = [];
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
