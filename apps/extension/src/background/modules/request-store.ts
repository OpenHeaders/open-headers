/**
 * Request Store — single source of truth for V5 HTTP requests in the
 * active workspace.
 *
 * Mirrors `rule-store.ts`: flat in-memory lists with path-encoded
 * hierarchy, tree derived on read. Workspace switch reloads from the
 * target workspace's keys; listeners fire on every mutation so the
 * orchestrator and UI bridges can broadcast `requestsUpdated`.
 *
 * Storage (every key scoped under the active workspace id):
 *   - requests            → `oh.ws.<id>.requests`
 *   - requestCollections  → `oh.ws.<id>.requestCollections`
 *   - requestFolders      → `oh.ws.<id>.requestFolders`
 *
 * Paths live under `requests/` (vs. `rules/` for rule-store) so the
 * two entity trees never collide in on-disk format used by team
 * workspaces in v2.
 */

import { CollectionSchema, FolderSchema, RequestSchema } from '@openheaders/core/schemas';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
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
    version: 1,
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
    version: 1,
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
      const nextVersion = existing.version + 1;
      collections = [
        ...collections.slice(0, index),
        { ...existing, name, version: nextVersion },
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
      collections = collections.filter((c) => c.uid !== uid);
      requests = requests.filter((r) => !r.path.startsWith(collection.path));
      folders = folders.filter((f) => !f.path.startsWith(collection.path));
      await persistCollections();
      await persistRequests();
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
  const folder: LocalFolder = { schemaVersion: 5, version: 1, uid, path: `${parentPath}/${folderName}`, name };
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
      const nextVersion = existing.version + 1;
      folders = [...folders.slice(0, index), { ...existing, name, version: nextVersion }, ...folders.slice(index + 1)];
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
      folders = folders.filter((f) => f.uid !== uid && !f.path.startsWith(`${folder.path}/`));
      requests = requests.filter((r) => !r.path.startsWith(`${folder.path}/`));
      await persistFolders();
      await persistRequests();
      return true;
    },
    { op: 'request-folder-delete' },
  );
}

// ── Requests ────────────────────────────────────────────────────────

/** Seed shape for a fresh request — name + minimal defaults. Callers
 *  hand us the new request's display name; everything else is a sane
 *  empty default the editor can populate. */
export function addRequest(
  name: string,
  parentPath: string,
  seed?: Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): V5.Request {
  const uid = generateUid();
  const folderName = toFolderName(name, uid);
  const created: V5.Request = {
    schemaVersion: 5,
    // Phase 10 write counter — starts at 1 on creation. See
    // `RuleBase.version` for the stale-draft contract.
    version: 1,
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
  requests = [...requests, created];
  void persistRequests();
  return created;
}

export function addRequestToCollection(
  name: string,
  collectionUid: string,
  seed?: Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
): V5.Request {
  const collection = collections.find((c) => c.uid === collectionUid);
  const parentPath = collection?.path ?? `requests/${collectionUid}`;
  return addRequest(name, parentPath, seed);
}

export function getRequest(uid: string): V5.Request | null {
  return requests.find((r) => r.uid === uid) ?? null;
}

/**
 * Outcome of a versioned request write (Phase 10 stale-draft contract
 * — parallel to `RuleWriteResult` / `EnvironmentWriteResult`).
 */
export type RequestWriteResult =
  | { ok: true; version: number; request: V5.Request }
  | { ok: false; reason: 'stale-draft'; serverVersion: number; serverRequest: V5.Request }
  | { ok: false; reason: 'not-found' };

export interface UpdateRequestOptions {
  /** Version the client loaded. Omit to opt out of stale-draft detection. */
  expectedVersion?: number;
}

function requestVersionOf(r: V5.Request): number {
  return r.version;
}

export async function updateRequest(
  uid: string,
  updates: Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
  options: UpdateRequestOptions = {},
): Promise<RequestWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'request', uid),
    async () => {
      const index = requests.findIndex((r) => r.uid === uid);
      if (index === -1) return { ok: false, reason: 'not-found' } as RequestWriteResult;
      const existing = requests[index];
      const current = requestVersionOf(existing);
      if (options.expectedVersion !== undefined && options.expectedVersion !== current) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: current,
          serverRequest: existing,
        } as RequestWriteResult;
      }
      const nextVersion = current + 1;
      const updated = { ...existing, ...updates, version: nextVersion } as V5.Request;
      requests = [...requests.slice(0, index), updated, ...requests.slice(index + 1)];
      await persistRequests();
      return { ok: true, version: nextVersion, request: updated } as RequestWriteResult;
    },
    { op: 'request-update' },
  );
}

export async function deleteRequest(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'request', uid),
    async () => {
      const before = requests.length;
      requests = requests.filter((r) => r.uid !== uid);
      if (requests.length === before) return false;
      await persistRequests();
      return true;
    },
    { op: 'request-delete' },
  );
}

// ── Persistence ─────────────────────────────────────────────────────

async function persistRequests(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).requests, requests);
  logger.debug('RequestStore', `Persisted ${requests.length} requests (ws=${workspaceId})`);
  notifyChange();
}

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

// ── Test helpers ────────────────────────────────────────────────────

export function __resetForTests(): void {
  requests = [];
  collections = [];
  folders = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
}
