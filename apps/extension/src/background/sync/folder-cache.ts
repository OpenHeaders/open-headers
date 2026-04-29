/**
 * Folder cache + persistence sink (Phase B Folder).
 *
 * Mirrors `collection-cache.ts` for the Folder entity. Subscribes to
 * the oracle's broadcast bus and re-projects the full folder list
 * whenever an envelope can change either:
 *
 *   1. Folder data — `body.type === FOLDER_ENTITY_TYPE`. A rename
 *      changes both the folder's name and every descendant's path
 *      (paths embed parent slugs), so the projection covers the whole
 *      list.
 *   2. Parent linkage — any envelope whose body targets the
 *      `FOLDER_CHILDREN_PATH` set on either a collection or another
 *      folder. Adds, removes, and reorders all reshape the projected
 *      tree.
 *
 * Cache reads cross collection + folder state, but never reads from
 * the collection cache directly — the oracle holds both in one
 * document store, so `materializeOne` / `liveSetItems` against the
 * shared oracle is the only cross-entity read primitive needed
 * (caches don't call each other).
 *
 * Hydration: `seedFromPersistedFolders(folders, collections)` accepts
 * the legacy flat `(folders, collections)` snapshot and emits one
 * `createFolder` batch per folder — that mints both the folder entity
 * and the parent slot in one atomic batch (collection root or parent
 * folder, resolved via `path` lookup against the supplied
 * collections + folders).
 */

import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  type FolderParentRef,
  newBatchId,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { buildCreateFolderBatch } from '@/shared/sync/folder-mutations';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import { projectAllFolders } from './folder-post-state';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type FolderCacheListener = () => void;

export interface FolderCache {
  readonly workspaceId: string;
  /** Snapshot of the cached folders in stable (uid) order. */
  getFolders(): V5.Folder[];
  /** Replace the cache from the legacy persisted folder + collection
   *  snapshot and seed the oracle. Drives boot-time hydration and the
   *  workspace-switch path. */
  seedFromPersistedFolders(folders: PersistedLocalFolder[], collections: V5.Collection[]): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. */
  onChange(listener: FolderCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createFolderCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): FolderCache {
  let folders: V5.Folder[] = [];
  const listeners = new Set<FolderCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAllFolders(oracle);
    folders = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('FolderCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (!affectsFolders(event)) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getFolders: () => folders,

    async seedFromPersistedFolders(
      persistedFolders: PersistedLocalFolder[],
      collections: V5.Collection[],
    ): Promise<void> {
      // Resolve each folder's parent via the legacy `path` strings.
      // Sort topologically so a nested folder seeds after its parent
      // — `createFolder` adds the slot atomically, so the parent must
      // exist on the oracle by the time we mint the child's batch.
      const ordered = sortByDepth(persistedFolders);
      const parentByPath = buildParentLookup(collections, persistedFolders);

      const batchId = `boot-folders-${newBatchId()}`;
      for (const folder of ordered) {
        const parentPath = parentPathOf(folder.path);
        const parent = parentPath ? parentByPath.get(parentPath) : undefined;
        if (!parent) {
          logger.info(
            'FolderCache',
            `seed: skipping folder ${folder.uid} — parent for path ${folder.path} not resolvable`,
          );
          continue;
        }
        const segment = lastSegmentOf(folder.path);
        const ctx = { ...contextFactory(), batchId };
        const intent = buildCreateFolderBatch(
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
            'FolderCache',
            `seedFromPersistedFolders: folder ${folder.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info(
        'FolderCache',
        `Seeded ${persistedFolders.length} folders for ws=${workspaceId}`,
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

let active: FolderCache | null = null;

export function setActiveFolderCache(cache: FolderCache | null): void {
  active = cache;
}

export function getActiveFolderCache(): FolderCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function affectsFolders(event: BroadcastEvent): boolean {
  const body = event.envelope.body;
  // Folder data change (rename, create, delete on the entity itself).
  if (body.type === FOLDER_ENTITY_TYPE) return true;
  // Parent slot change — addToSet/removeFromSet/moveBefore on the
  // FOLDER_CHILDREN_PATH set on either a collection or a folder. Other
  // mutation kinds on those types (e.g. setField on collection name)
  // don't reshape the folder tree, but they're cheap to refresh on so
  // we don't bother filtering by kind beyond the path.
  if (body.type === COLLECTION_ENTITY_TYPE || body.type === FOLDER_ENTITY_TYPE) {
    if ('path' in body && body.path === FOLDER_CHILDREN_PATH) return true;
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
    await extensionStorage.set(wsKeys(workspaceId).folders, persisted);
  } catch (err) {
    logger.info('FolderCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}

/**
 * Build a `path → FolderParentRef` lookup so child folders can resolve
 * their parent in O(1) during seed. Collections own absolute paths
 * (`rules/<slug>-<uid>`); folders own `<parentPath>/<slug>-<uid>`.
 */
function buildParentLookup(
  collections: readonly V5.Collection[],
  folders: readonly PersistedLocalFolder[],
): Map<string, FolderParentRef> {
  const out = new Map<string, FolderParentRef>();
  for (const collection of collections) {
    out.set(collection.path, { type: COLLECTION_ENTITY_TYPE, uid: collection.uid });
  }
  for (const folder of folders) {
    out.set(folder.path, { type: FOLDER_ENTITY_TYPE, uid: folder.uid });
  }
  return out;
}

/**
 * Sort folders so a parent always seeds before any of its descendants.
 * Cheaper than a full topological sort: depth derived from `/`
 * separators is total-ordered with parents-before-children.
 */
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
