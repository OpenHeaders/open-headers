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
 * Hydration: `seedFromPersistedFiles(refs)` applies one `seedFiles`
 * batch; the caller (the bridge wiring in `files-store.ts`) sources the
 * refs from `BlobStore.listBlobs(workspaceId)`.
 *
 * Files are user-visible UX state (filenames, sizes), not secrets —
 * broadcast carries them freely.
 */

import type { FileRef } from '@openheaders/core/files';
import { FILES_ENTITY_TYPE } from '@openheaders/core/sync';
import { seedFiles } from '@/shared/sync/files-projection';
import type { InMemoryBroadcast } from './broadcast';
import { projectFilesSingleton } from './files-post-state';
import type { EntityOracle } from './oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';

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
    },
  );

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedFiles: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
