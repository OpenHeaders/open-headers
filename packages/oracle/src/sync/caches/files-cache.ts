/**
 * Files cache (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Unlike
 * the other singletons, no `chrome.storage.local` write sink — the
 * durable record for the catalog already lives in the platform
 * `BlobStore` IndexedDB store (each blob row carries its own `FileRef`
 * shell), so the cache's only job is to expose a synchronous in-memory
 * view of post-broadcast state for SW consumers (request-executor's
 * `FileRegistry` rebuild, message-handler's legacy `listFiles` dispatch).
 * The renderer mirror reads the same data via the broadcast channel.
 *
 * Boot: the catalog replays from the workspace's log; a catalog the log
 * never held is migrated once from `BlobStore.listBlobs(workspaceId)`
 * by the boot pass. `seedFromPersistedFiles(refs)` applies one
 * `seedFiles` batch for that migration and for the import path's
 * seeding bridge in `files-store.ts`.
 *
 * Files are user-visible UX state (filenames, sizes), not secrets —
 * broadcast carries them freely.
 */

import type { FileRef } from '@openheaders/core/files';
import { FILES_ENTITY_TYPE } from '@openheaders/core/sync';
import { seedFiles } from '@openheaders/core/sync-builders/projections/files-projection';
import * as BlobStore from '@openheaders/oracle/files';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { projectFilesSingleton } from '../post-state/files-post-state';
import type { SwMutatorContextFactory } from '../sw-context';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';

export interface FilesSnapshot {
  /** All currently-known FileRefs, in fileId order. */
  refs: FileRef[];
}

export const EMPTY_FILES: FilesSnapshot = { refs: [] };

export type FilesCacheListener = () => void;

export interface FilesCache {
  readonly workspaceId: string;
  getSnapshot(): FilesSnapshot;
  seedFromPersistedFiles(refs: readonly FileRef[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: FilesCacheListener): () => void;
  dispose(): void;
}

export function createFilesCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): FilesCache {
  const core: SingletonEntityCache<FilesSnapshot, readonly FileRef[]> = createSingletonEntityCache(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: FILES_ENTITY_TYPE,
      loggerTag: 'FilesCache',
      emptySnapshot: EMPTY_FILES,
      project: (o) => {
        const projection = projectFilesSingleton(o);
        return projection ? { refs: projection.refs } : null;
      },
      buildSeedBatch: (input, ctx) => seedFiles(input, ctx),
      // Files have no chrome.storage projection — the durable record
      // for the catalog lives in BlobStore IDB. Reading from BlobStore
      // here is the symmetric source for `hydrateFromStorage`.
      loadFromStorage: async (scope) => {
        const refs = await BlobStore.listBlobs(scope);
        return refs.length > 0 ? refs : null;
      },
    },
  );

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedFiles: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
