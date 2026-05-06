/**
 * Shared cache + persistence sink for folder-tree entities.
 *
 * Three caches (`folder-cache`, `request-folder-cache`,
 * `template-folder-cache`) share the same broadcast → re-project →
 * persist → notify pipeline plus a depth-first hydration that mints
 * one `createX` batch per persisted folder. They differ only in:
 *
 *  - the collection / folder entity-type pair + children-path slot,
 *  - the `buildCreateXBatch` factory + parent ref shape,
 *  - the `projectAllX` adapter (already shared in
 *    `folder-tree-post-state.ts`),
 *  - the storage key and logger tag.
 *
 * This module hosts the pipeline once; per-entity files become thin
 * adapters.
 */

import { type MutationBatch, type MutatorContext, newBatchId, type SideEffectIntent } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, type PersistedLocalFolder, type StorageKey } from '@/shared/storage';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

/**
 * Input shape for `buildCreateBatch`. Per-entity factories accept the
 * same field set with their typed `parent` discriminator.
 */
export interface FolderTreeCreateInput<P> {
  folderUid: string;
  parent: P;
  name: string;
  pathSegment?: string;
}

export interface FolderTreeCacheConfig<P> {
  collectionType: string;
  folderType: string;
  childrenPath: string;
  loggerTag: string;
  /** Resolves the chrome.storage key the projection persists to. */
  storageKey: (workspaceId: string) => StorageKey<PersistedLocalFolder[]>;
  /** Prefix for the boot-time hydration batch id (e.g. "boot-folders"). */
  hydrationBatchPrefix: string;
  /** Project every folder under this tree off the oracle. */
  projectAllFolders: (oracle: EntityOracle) => V5.Folder[];
  /** Build a `createFolder` batch + side effects for hydration. */
  buildCreateBatch: (
    input: FolderTreeCreateInput<P>,
    ctx: MutatorContext,
  ) => { batch: MutationBatch; sideEffects: SideEffectIntent[] };
  /** Lift a `(type, uid)` pair into the entity's typed parent ref. */
  parentFor: (type: string, uid: string) => P;
}

export interface FolderTreeCacheCore {
  readonly workspaceId: string;
  getFolders(): V5.Folder[];
  seedFromPersisted(folders: PersistedLocalFolder[], collections: V5.Collection[]): Promise<void>;
  onChange(listener: () => void): () => void;
  dispose(): void;
}

export function createFolderTreeCache<P>(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
  config: FolderTreeCacheConfig<P>,
): FolderTreeCacheCore {
  let folders: V5.Folder[] = [];
  const listeners = new Set<() => void>();

  const refreshFromOracle = (): void => {
    folders = config.projectAllFolders(oracle);
    void persist(workspaceId, folders, config);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info(config.loggerTag, 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (!affectsFolders(event, config)) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getFolders: () => folders,

    async seedFromPersisted(persistedFolders: PersistedLocalFolder[], collections: V5.Collection[]): Promise<void> {
      // Sort folders so a parent always seeds before any of its
      // descendants. Depth derived from `/` separators is total-ordered
      // with parents-before-children — cheaper than a full topo sort.
      const ordered = sortByDepth(persistedFolders);
      const parentByPath = buildParentLookup(collections, persistedFolders, config);
      const batchId = `${config.hydrationBatchPrefix}-${newBatchId()}`;

      for (const folder of ordered) {
        const parentPath = parentPathOf(folder.path);
        const parent = parentPath ? parentByPath.get(parentPath) : undefined;
        if (!parent) {
          logger.info(
            config.loggerTag,
            `seed: skipping folder ${folder.uid} — parent for path ${folder.path} not resolvable`,
          );
          continue;
        }
        const segment = lastSegmentOf(folder.path);
        const ctx = { ...contextFactory(), batchId };
        const intent = config.buildCreateBatch(
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
            config.loggerTag,
            `seed: folder ${folder.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info(config.loggerTag, `Seeded ${persistedFolders.length} folders for ws=${workspaceId}`);
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

function affectsFolders<P>(event: BroadcastEvent, config: FolderTreeCacheConfig<P>): boolean {
  const body = event.envelope.body;
  if (body.type === config.folderType) return true;
  if (body.type === config.collectionType || body.type === config.folderType) {
    if ('path' in body && body.path === config.childrenPath) return true;
  }
  return false;
}

async function persist<P>(workspaceId: string, folders: V5.Folder[], config: FolderTreeCacheConfig<P>): Promise<void> {
  try {
    const persisted: PersistedLocalFolder[] = folders.map((f) => ({
      schemaVersion: f.schemaVersion,
      uid: f.uid,
      path: f.path,
      name: f.name,
    }));
    await extensionStorage.set(config.storageKey(workspaceId), persisted);
  } catch (err) {
    logger.info(config.loggerTag, `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}

function buildParentLookup<P>(
  collections: readonly V5.Collection[],
  folders: readonly PersistedLocalFolder[],
  config: FolderTreeCacheConfig<P>,
): Map<string, P> {
  const out = new Map<string, P>();
  for (const collection of collections) {
    out.set(collection.path, config.parentFor(config.collectionType, collection.uid));
  }
  for (const folder of folders) {
    out.set(folder.path, config.parentFor(config.folderType, folder.uid));
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
