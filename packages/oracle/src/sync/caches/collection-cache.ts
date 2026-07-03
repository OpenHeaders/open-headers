/**
 * Collection cache + persistence sink (Phase B).
 *
 * Mirrors `environment-cache.ts`. Subscribes to the oracle's broadcast
 * bus, re-projects the materialized state on every committed
 * Collection envelope, and persists the projected `Collection[]`
 * back to `chrome.storage.local` under the workspace's `collections`
 * key so legacy readers (rule-store local mirror, exporter, sidebar
 * UI, request collections that walk by path) keep working without
 * change.
 *
 * Hydration: `seedFromPersistedCollections(colls)` walks each
 * persisted collection, builds a `seedCollection` batch, and applies
 * it through the oracle. Boot-time replay through this same sink is
 * idempotent and byte-stable.
 */

import { CollectionSchema } from '@openheaders/core/schemas';
import type { MaterializedEntity } from '@openheaders/core/sync';
import { COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { projectCollection, seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { driftRecorder } from './storage-drift';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type CollectionCacheListener = () => void;

export interface CollectionCache {
  readonly workspaceId: string;
  /** Snapshot of the cached collections in stable (uid) order. */
  getCollections(): Collection[];
  /** Replace the cache from a list of collection snapshots and seed
   *  the oracle. Drives boot-time hydration and the workspace-switch
   *  path. */
  seedFromPersistedCollections(colls: Collection[]): Promise<void>;
  /** Read the persisted collection list for this workspace and seed the
   *  oracle. No-op when nothing is persisted. Called by `buildService`'s
   *  `hydrated` promise so a freshly materialized non-Active workspace
   *  service starts populated. */
  hydrateFromStorage(): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. */
  onChange(listener: CollectionCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createCollectionCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): CollectionCache {
  let collections: Collection[] = [];
  const listeners = new Set<CollectionCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAllCollections(oracle.materializeAll());
    collections = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('CollectionCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== COLLECTION_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  const seedFromPersistedCollections = async (persisted: Collection[]): Promise<void> => {
    for (const coll of persisted) {
      const batch = seedCollection(coll, contextFactory());
      const result = await oracle.apply(batch, [], 'inbound');
      if (!result.ok) {
        logger.info(
          'CollectionCache',
          `seedFromPersistedCollections: collection ${coll.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
    }
    refreshFromOracle();
    logger.info('CollectionCache', `Seeded ${persisted.length} collections for ws=${workspaceId}`);
  };

  return {
    workspaceId,
    getCollections: () => collections,

    seedFromPersistedCollections,

    async hydrateFromStorage(): Promise<void> {
      try {
        const persisted = await hostStorage.getValidatedArray(wsKeys(workspaceId).collections, CollectionSchema, {
          onError: driftRecorder({
            subsystem: 'rule-engine',
            storageKey: wsKeys(workspaceId).collections.key,
            workspaceId,
          }),
        });
        if (persisted.length === 0) {
          refreshFromOracle();
          return;
        }
        await seedFromPersistedCollections(persisted);
      } catch (err) {
        logger.info('CollectionCache', `hydrateFromStorage failed (ws=${workspaceId}):`, (err as Error).message);
      }
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

// ── helpers ───────────────────────────────────────────────────────

function projectAllCollections(materialized: MaterializedEntity[]): Collection[] {
  const out: Collection[] = [];
  for (const m of materialized) {
    if (m.type !== COLLECTION_ENTITY_TYPE) continue;
    const coll = projectCollection(m);
    if (coll) out.push(coll);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, collections: Collection[]): Promise<void> {
  try {
    await hostStorage.set(wsKeys(workspaceId).collections, collections);
  } catch (err) {
    logger.info('CollectionCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}
