/**
 * Request-collection cache + persistence sink (Phase B
 * request-collection).
 *
 * Mirrors `collection-cache.ts` for the request-collection entity.
 * Subscribes to the oracle's broadcast bus, re-projects the
 * materialized state on every committed request-collection envelope,
 * and persists the projected `V5.Collection[]` back to
 * `chrome.storage.local` under the workspace's `requestCollections`
 * key so legacy readers (request-store local mirror, exporter, sidebar
 * UI) keep working without change.
 *
 * Hydration: `seedFromPersistedRequestCollections(colls)` walks each
 * persisted collection, builds a `seedRequestCollection` batch, and
 * applies it through the oracle. Boot-time replay through this same
 * sink is idempotent and byte-stable.
 */

import { type MaterializedEntity, REQUEST_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  projectRequestCollection,
  seedRequestCollection,
} from '@/shared/sync/request-collection-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type RequestCollectionCacheListener = () => void;

export interface RequestCollectionCache {
  readonly workspaceId: string;
  /** Snapshot of the cached request collections in stable (uid) order. */
  getRequestCollections(): V5.Collection[];
  /** Replace the cache from a list of request-collection snapshots and
   *  seed the oracle. Drives boot-time hydration and the
   *  workspace-switch path. */
  seedFromPersistedRequestCollections(colls: V5.Collection[]): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. */
  onChange(listener: RequestCollectionCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createRequestCollectionCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RequestCollectionCache {
  let collections: V5.Collection[] = [];
  const listeners = new Set<RequestCollectionCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAll(oracle.materializeAll());
    collections = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('RequestCollectionCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== REQUEST_COLLECTION_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getRequestCollections: () => collections,

    async seedFromPersistedRequestCollections(persisted: V5.Collection[]): Promise<void> {
      for (const coll of persisted) {
        const batch = seedRequestCollection(coll, contextFactory());
        const result = await oracle.apply(batch, []);
        if (!result.ok) {
          logger.info(
            'RequestCollectionCache',
            `seed: collection ${coll.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info(
        'RequestCollectionCache',
        `Seeded ${persisted.length} request collections for ws=${workspaceId}`,
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

let active: RequestCollectionCache | null = null;

export function setActiveRequestCollectionCache(cache: RequestCollectionCache | null): void {
  active = cache;
}

export function getActiveRequestCollectionCache(): RequestCollectionCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function projectAll(materialized: MaterializedEntity[]): V5.Collection[] {
  const out: V5.Collection[] = [];
  for (const m of materialized) {
    if (m.type !== REQUEST_COLLECTION_ENTITY_TYPE) continue;
    const coll = projectRequestCollection(m);
    if (coll) out.push(coll);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, collections: V5.Collection[]): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).requestCollections, collections);
  } catch (err) {
    logger.info(
      'RequestCollectionCache',
      `persist failed (ws=${workspaceId}):`,
      (err as Error).message,
    );
  }
}
