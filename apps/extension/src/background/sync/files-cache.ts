/**
 * Files cache (Phase B).
 *
 * Mirrors `pause-markers-cache.ts` for the singleton files entity, with
 * one structural difference: there is NO `chrome.storage.local` write
 * sink. The durable record for the catalog already lives in the
 * platform `BlobStore` IndexedDB store (each blob row carries its own
 * `FileRef` shell), so the cache's only job is to expose a synchronous
 * in-memory view of post-broadcast state for SW consumers (request-
 * executor's `FileRegistry` rebuild, message-handler's legacy
 * `listFiles` dispatch). The renderer mirror reads the same data via
 * the broadcast channel.
 *
 * Hydration: `seedFromPersistedFiles(refs)` applies one `seedFiles`
 * batch through the oracle. The caller (the bridge wiring in
 * `files-store.ts`) is responsible for sourcing the refs from
 * `BlobStore.listBlobs(workspaceId)`. Boot-time replay through this
 * sink is idempotent and byte-stable.
 *
 * Files are user-visible UX state (filenames, sizes), not secrets —
 * broadcast carries them freely.
 */

import type { FileRef } from '@openheaders/core/files';
import { FILES_ENTITY_TYPE } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import { seedFiles } from '@/shared/sync/files-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import { projectFilesSingleton } from './files-post-state';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export interface FilesSnapshot {
  /** All currently-known FileRefs, in fileId order. */
  refs: FileRef[];
}

export const EMPTY_FILES: FilesSnapshot = { refs: [] };

export type FilesCacheListener = () => void;

export interface FilesCache {
  readonly workspaceId: string;
  /** Snapshot of the singleton record. Returns the empty default until
   *  the oracle's first commit lands. */
  getSnapshot(): FilesSnapshot;
  /** Replace the cache from a list of `FileRef` (sourced by the caller
   *  from `BlobStore.listBlobs`) and seed the oracle. Drives boot-time
   *  hydration and the workspace-switch path. */
  seedFromPersistedFiles(refs: readonly FileRef[]): Promise<void>;
  onChange(listener: FilesCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createFilesCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): FilesCache {
  let snapshot: FilesSnapshot = EMPTY_FILES;
  const listeners = new Set<FilesCacheListener>();

  const refreshFromOracle = (): void => {
    const projection = projectFilesSingleton(oracle);
    snapshot = projection ? { refs: projection.refs } : EMPTY_FILES;
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('FilesCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== FILES_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getSnapshot: () => snapshot,

    async seedFromPersistedFiles(refs: readonly FileRef[]): Promise<void> {
      const batch = seedFiles(refs, contextFactory());
      const result = await oracle.apply(batch, []);
      if (!result.ok) {
        logger.info(
          'FilesCache',
          `seedFromPersistedFiles failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
      refreshFromOracle();
      logger.info('FilesCache', `Seeded singleton for ws=${workspaceId} (${refs.length} refs)`);
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

let active: FilesCache | null = null;

export function setActiveFilesCache(cache: FilesCache | null): void {
  active = cache;
}

export function getActiveFilesCache(): FilesCache | null {
  return active;
}
