/**
 * Request-folder cache + persistence sink (Phase B request-folder).
 *
 * Mirrors `folder-cache.ts` for the request-folder entity. Subscribes
 * to the oracle's broadcast bus and re-projects the full folder list
 * whenever an envelope can change either:
 *
 *   1. Folder data — `body.type === REQUEST_FOLDER_ENTITY_TYPE`.
 *   2. Parent linkage — any envelope whose body targets the
 *      `REQUEST_FOLDER_CHILDREN_PATH` set on either a request-collection
 *      or another request-folder.
 *
 * Cache reads cross request-collection + request-folder state, but
 * never reads from the request-collection cache directly — the oracle
 * holds both in one document store, so `materializeOne` /
 * `liveSetItems` against the shared oracle is the only cross-entity
 * read primitive needed (caches don't call each other).
 *
 * Hydration: `seedFromPersistedRequestFolders(folders, collections)`
 * accepts the legacy flat snapshot and emits one
 * `createRequestFolder` batch per folder — that mints both the folder
 * entity and the parent slot in one atomic batch (request-collection
 * root or parent request-folder, resolved via `path` lookup against
 * the supplied collections + folders).
 */

import {
  newBatchId,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { buildCreateRequestFolderBatch } from '@/shared/sync/request-folder-mutations';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { projectAllRequestFolders } from './request-folder-post-state';
import type { SwMutatorContextFactory } from './sw-context';

export type RequestFolderCacheListener = () => void;

export interface RequestFolderCache {
  readonly workspaceId: string;
  /** Snapshot of the cached request folders in stable (uid) order. */
  getRequestFolders(): V5.Folder[];
  /** Replace the cache from the legacy persisted folder + collection
   *  snapshot and seed the oracle. */
  seedFromPersistedRequestFolders(
    folders: PersistedLocalFolder[],
    collections: V5.Collection[],
  ): Promise<void>;
  onChange(listener: RequestFolderCacheListener): () => void;
  dispose(): void;
}

export function createRequestFolderCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RequestFolderCache {
  let folders: V5.Folder[] = [];
  const listeners = new Set<RequestFolderCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAllRequestFolders(oracle);
    folders = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('RequestFolderCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (!affectsFolders(event)) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getRequestFolders: () => folders,

    async seedFromPersistedRequestFolders(
      persistedFolders: PersistedLocalFolder[],
      collections: V5.Collection[],
    ): Promise<void> {
      const ordered = sortByDepth(persistedFolders);
      const parentByPath = buildParentLookup(collections, persistedFolders);

      const batchId = `boot-request-folders-${newBatchId()}`;
      for (const folder of ordered) {
        const parentPath = parentPathOf(folder.path);
        const parent = parentPath ? parentByPath.get(parentPath) : undefined;
        if (!parent) {
          logger.info(
            'RequestFolderCache',
            `seed: skipping folder ${folder.uid} — parent for path ${folder.path} not resolvable`,
          );
          continue;
        }
        const segment = lastSegmentOf(folder.path);
        const ctx = { ...contextFactory(), batchId };
        const intent = buildCreateRequestFolderBatch(
          {
            folderUid: folder.uid,
            parent,
            name: folder.name,
            ...(segment ? { pathSegment: segment } : {}),
          },
          ctx,
        );
        const result = await oracle.apply(intent.batch, intent.sideEffects);
        if (!result.ok) {
          logger.info(
            'RequestFolderCache',
            `seed: folder ${folder.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info(
        'RequestFolderCache',
        `Seeded ${persistedFolders.length} request folders for ws=${workspaceId}`,
      );
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: RequestFolderCache | null = null;

export function setActiveRequestFolderCache(cache: RequestFolderCache | null): void {
  active = cache;
}

export function getActiveRequestFolderCache(): RequestFolderCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function affectsFolders(event: BroadcastEvent): boolean {
  const body = event.envelope.body;
  if (body.type === REQUEST_FOLDER_ENTITY_TYPE) return true;
  if (
    body.type === REQUEST_COLLECTION_ENTITY_TYPE ||
    body.type === REQUEST_FOLDER_ENTITY_TYPE
  ) {
    if ('path' in body && body.path === REQUEST_FOLDER_CHILDREN_PATH) return true;
  }
  return false;
}

async function persist(workspaceId: string, folders: V5.Folder[]): Promise<void> {
  try {
    const persisted: PersistedLocalFolder[] = folders.map((f) => ({
      schemaVersion: f.schemaVersion,
      uid: f.uid,
      path: f.path,
      name: f.name,
    }));
    await extensionStorage.set(wsKeys(workspaceId).requestFolders, persisted);
  } catch (err) {
    logger.info(
      'RequestFolderCache',
      `persist failed (ws=${workspaceId}):`,
      (err as Error).message,
    );
  }
}

function buildParentLookup(
  collections: readonly V5.Collection[],
  folders: readonly PersistedLocalFolder[],
): Map<string, RequestFolderParentRef> {
  const out = new Map<string, RequestFolderParentRef>();
  for (const collection of collections) {
    out.set(collection.path, { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.uid });
  }
  for (const folder of folders) {
    out.set(folder.path, { type: REQUEST_FOLDER_ENTITY_TYPE, uid: folder.uid });
  }
  return out;
}

function sortByDepth(folders: readonly PersistedLocalFolder[]): PersistedLocalFolder[] {
  const depth = (f: PersistedLocalFolder): number => f.path.split('/').length;
  return [...folders].sort((a, b) => depth(a) - depth(b));
}

function parentPathOf(path: string): string | null {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return null;
  return path.slice(0, idx);
}

function lastSegmentOf(path: string): string | null {
  const idx = path.lastIndexOf('/');
  if (idx < 0) return path || null;
  const tail = path.slice(idx + 1);
  return tail.length > 0 ? tail : null;
}
