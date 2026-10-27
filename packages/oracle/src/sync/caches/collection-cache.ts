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
 * Boot: the oracle has replayed the workspace's log before
 * `hydrateFromStorage` runs, so the pass re-projects from it; the
 * persisted list is seeded through `seedFromPersistedCollections` only
 * when the log holds no collection row (the one-time migration).
 */

import { CollectionSchema } from '@openheaders/core/schemas';
import { COLLECTION_ENTITY_TYPE, WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH } from '@openheaders/core/sync';
import { projectCollection, seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import type { Collection } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { BroadcastEvent, InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { affectsRoots, arrangeInRootsOrder } from '../post-state/workspace-roots-post-state';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';

export type CollectionCacheListener = () => void;

export interface CollectionCache {
  readonly workspaceId: string;
  /** Snapshot of the cached collections in roots order. */
  getCollections(): Collection[];
  /** Seed the oracle from collection snapshots as real commits — the
   *  one-time migration's and the import path's seeding bridge's
   *  mechanism. */
  seedFromPersistedCollections(colls: Collection[]): Promise<void>;
  /** The boot pass over the replayed oracle (`buildService`'s `hydrated`
   *  promise): re-project and persist, or migrate the persisted
   *  collection list once when the log holds no collection row. */
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
    const next = projectAllCollections(oracle);
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
    const body = event.envelope.body;
    if (body.type !== COLLECTION_ENTITY_TYPE && !affectsRoots(body, WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH)) return;
    refreshFromOracle();
  });

  const seedFromPersistedCollections = async (persisted: Collection[]): Promise<void> => {
    for (const coll of persisted) {
      const batch = seedCollection(coll, contextFactory());
      const result = await oracle.apply(batch, 'inbound');
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
        if (oracle.hasEntityOfType(COLLECTION_ENTITY_TYPE)) {
          refreshFromOracle();
          return;
        }
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

/** Persisted in roots order — the array IS the collection order. */
function projectAllCollections(oracle: EntityOracle): Collection[] {
  const out: Collection[] = [];
  for (const m of oracle.materializeAll()) {
    if (m.type !== COLLECTION_ENTITY_TYPE) continue;
    const coll = projectCollection(m);
    if (coll) out.push(coll);
  }
  return arrangeInRootsOrder(oracle, WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH, out);
}

async function persist(workspaceId: string, collections: Collection[]): Promise<void> {
  try {
    await hostStorage.set(wsKeys(workspaceId).collections, collections);
  } catch (err) {
    logger.info('CollectionCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}
