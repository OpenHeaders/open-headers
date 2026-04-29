/**
 * Request Store — single source of truth for V5 HTTP requests in the
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
import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { buildAddBatch, buildDeleteBatch, buildUpdateBatch } from '@/shared/sync/request-mutations';
import { getActiveRequestCache } from '../sync/request-cache';
import { getOracleForCurrentWorkspace, nextSwMutatorContext } from '../sync/service';
import { driftRecorder } from './storage-drift';
import { getActiveWorkspaceId } from './workspace-store';

/** Re-export from rule-store-style shape. Identical runtime layout. */
export type LocalFolder = PersistedLocalFolder;

// ── In-memory state (scoped to the currently active workspace) ──────

let requests: V5.Request[] = [];
let collections: V5.Collection[] = [];
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

export function getRequests(): V5.Request[] {
  return requests;
}

export function getRequestCollections(): V5.Collection[] {
  return collections;
}

export function getRequestFolders(): LocalFolder[] {
  return folders;
}

/** Build CollectionTree[] from flat collections + folders + requests. */
export function getRequestCollectionTrees(): V5.CollectionTree[] {
  return collections.map((collection) => {
    const tree = buildTreeForPath(collection.path);
    return { ...collection, tree };
  });
}

function buildTreeForPath(parentPath: string): V5.TreeNode[] {
  const nodes: V5.TreeNode[] = [];

  const childFolders = folders.filter((f) => f.path.substring(0, f.path.lastIndexOf('/')) === parentPath);
  for (const folder of childFolders) {
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children: buildTreeForPath(folder.path),
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
//
// Request collections + folders still flow through the legacy direct-
// write path; routing them through the oracle requires the entity-type
// decision documented in the status doc (extend Collection / Folder
// types vs. introduce request-collection / request-folder). Until that
// lands, cascade deletes emit per-request `buildDeleteBatch` envelopes
// so the request entity's pipeline stays consistent.

const DEFAULT_COLLECTION_NAME = 'My Requests';

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('RequestStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

export function ensureDefaultRequestCollection(): V5.Collection {
  const existing = collections.find((c) => c.name === DEFAULT_COLLECTION_NAME);
  if (existing) return existing;

  const uid = generateUid();
  const folderName = toFolderName(DEFAULT_COLLECTION_NAME, uid);
  const collection: V5.Collection = {
    schemaVersion: 5,
    uid,
    path: `requests/${folderName}`,
    name: DEFAULT_COLLECTION_NAME,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  collections = [...collections, collection];
  void persistCollections();
  return collection;
}

export function createRequestCollection(name: string): V5.Collection {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const collection: V5.Collection = {
    schemaVersion: 5,
    uid,
    path: `requests/${folderName}`,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  collections = [...collections, collection];
  void persistCollections();
  return collection;
}

export async function renameRequestCollection(uid: string, name: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'request-collection', uid),
    async () => {
      const index = collections.findIndex((c) => c.uid === uid);
      if (index === -1) return false;
      const existing = collections[index];
      collections = [
        ...collections.slice(0, index),
        { ...existing, name },
        ...collections.slice(index + 1),
      ];
      await persistCollections();
      return true;
    },
    { op: 'request-collection-rename' },
  );
}

export async function deleteRequestCollection(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'request-collection', uid),
    async () => {
      const collection = collections.find((c) => c.uid === uid);
      if (!collection) return false;

      // Cascade per-request deletes through the oracle so the cache +
      // local mirror stay consistent. Folders cascade via the legacy
      // direct-write path until request-folder lands on the pipeline.
      const cascadingRequestUids = requests
        .filter((r) => r.path.startsWith(collection.path))
        .map((r) => r.uid);
      for (const reqUid of cascadingRequestUids) {
        await applyRequestMutationOrThrow(
          (ctx) => buildDeleteBatch(reqUid, ctx),
          'deleteRequestCollection-cascade',
        );
      }

      collections = collections.filter((c) => c.uid !== uid);
      folders = folders.filter((f) => !f.path.startsWith(collection.path));
      await persistCollections();
      await persistFolders();
      return true;
    },
    { op: 'request-collection-delete' },
  );
}

// ── Folders ─────────────────────────────────────────────────────────

export function createRequestFolder(name: string, parentPath: string): LocalFolder {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const folder: LocalFolder = { schemaVersion: 5, uid, path: `${parentPath}/${folderName}`, name };
  folders = [...folders, folder];
  void persistFolders();
  return folder;
}

export async function renameRequestFolder(uid: string, name: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'request-folder', uid),
    async () => {
      const index = folders.findIndex((f) => f.uid === uid);
      if (index === -1) return false;
      const existing = folders[index];
      folders = [...folders.slice(0, index), { ...existing, name }, ...folders.slice(index + 1)];
      await persistFolders();
      return true;
    },
    { op: 'request-folder-rename' },
  );
}

export async function deleteRequestFolder(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'request-folder', uid),
    async () => {
      const folder = folders.find((f) => f.uid === uid);
      if (!folder) return false;

      // Cascade per-request deletes for every request nested under this
      // folder (or any descendant folder) through the oracle.
      const cascadingRequestUids = requests
        .filter((r) => r.path.startsWith(`${folder.path}/`))
        .map((r) => r.uid);
      for (const reqUid of cascadingRequestUids) {
        await applyRequestMutationOrThrow(
          (ctx) => buildDeleteBatch(reqUid, ctx),
          'deleteRequestFolder-cascade',
        );
      }

      folders = folders.filter((f) => f.uid !== uid && !f.path.startsWith(`${folder.path}/`));
      await persistFolders();
      return true;
    },
    { op: 'request-folder-delete' },
  );
}

// ── Requests ────────────────────────────────────────────────────────

/** Seed shape for a fresh request — name + minimal defaults. */
export async function addRequest(
  name: string,
  parentPath: string,
  seed?: Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<V5.Request> {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const created: V5.Request = {
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
  seed?: Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<V5.Request> {
  const collection = collections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `requests/${collectionUid}`;
  return addRequest(name, parentPath, seed);
}

export function getRequest(uid: string): V5.Request | null {
  return requests.find((r) => r.uid === uid) ?? null;
}

/**
 * Outcome of a request write. The legacy stale-draft branch is retired
 * in Phase B — convergence is per-(field) LWW at the oracle, not a
 * versioned compare-and-set.
 */
export type RequestWriteResult =
  | { ok: true; request: V5.Request }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateRequest(
  uid: string,
  updates: Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): Promise<RequestWriteResult> {
  assertLoaded();
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    return { ok: false, reason: 'other', message: 'sync service not initialized' };
  }
  const existing = requests.find((r) => r.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };

  // SW-side `liveSetItems` returns the richer `{itemId, item}` shape;
  // adapt down to the `LiveSetItemIds` string-only contract.
  const payload = buildUpdateBatch(uid, updates, ctx, (requestUid, setPath) =>
    oracle.liveSetItems(REQUEST_ENTITY_TYPE, requestUid, setPath).map((entry) => entry.itemId),
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
  return { ok: true, request: { ...existing, ...updates } as V5.Request };
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

// ── Persistence ─────────────────────────────────────────────────────
//
// Requests persistence is owned by the sync engine's
// {@link RequestCache} — `chrome.storage.local` writes happen on every
// broadcast-driven re-projection. Collections + folders still go
// through the legacy direct path until request-collection /
// request-folder land on the pipeline.

async function persistCollections(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).requestCollections, collections);
  logger.debug('RequestStore', `Persisted ${collections.length} request collections (ws=${workspaceId})`);
  notifyChange();
}

async function persistFolders(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).requestFolders, folders);
  logger.debug('RequestStore', `Persisted ${folders.length} request folders (ws=${workspaceId})`);
  notifyChange();
}

// ── Hydration / workspace switch ────────────────────────────────────

interface WorkspaceSnapshot {
  requests: V5.Request[];
  collections: V5.Collection[];
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

export async function hydrateFromStorage(): Promise<V5.Request[]> {
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

/**
 * Wire the local `requests` array to the active workspace's
 * {@link RequestCache}: seed the oracle from the hydrated requests,
 * then subscribe to broadcast-driven re-projections so subsequent
 * mutations flow back into the local mirror. Same shape as
 * `bridgeToSyncEngine` in `rule-store.ts`. Idempotent — the prior
 * cache subscription is dropped first.
 */
export async function bridgeRequestSyncEngine(): Promise<void> {
  const cache = getActiveRequestCache();
  if (!cache) {
    logger.info('RequestStore', 'bridgeRequestSyncEngine: no active cache; skipping');
    return;
  }
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = cache.onChange(() => {
    requests = cache.getRequests();
    notifyChange();
  });
  await cache.seedFromPersistedRequests(requests);
  // Belt-and-braces: copy the cache view explicitly so a zero-requests
  // workspace (no broadcasts → listener never fires) still ends up with
  // `requests` pointed at the cache's snapshot.
  requests = cache.getRequests();
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
}
