/**
 * Template-collection cache + persistence sink.
 *
 * Mirrors {@link request-collection-cache.ts}. Subscribes to the
 * oracle's broadcast bus, re-projects on every committed
 * template-collection envelope, and persists the projected
 * `V5.Collection[]` back to `chrome.storage.local` under the
 * workspace's `templateCollections` key.
 */

import { type MaterializedEntity, TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  projectTemplateCollection,
  seedTemplateCollection,
} from '@/shared/sync/template-collection-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type TemplateCollectionCacheListener = () => void;

export interface TemplateCollectionCache {
  readonly workspaceId: string;
  /** Snapshot of the cached template collections in stable (uid) order. */
  getTemplateCollections(): V5.Collection[];
  /** Replace the cache from a list of template-collection snapshots and
   *  seed the oracle. */
  seedFromPersistedTemplateCollections(colls: V5.Collection[]): Promise<void>;
  onChange(listener: TemplateCollectionCacheListener): () => void;
  dispose(): void;
}

export function createTemplateCollectionCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TemplateCollectionCache {
  let collections: V5.Collection[] = [];
  const listeners = new Set<TemplateCollectionCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAll(oracle.materializeAll());
    collections = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('TemplateCollectionCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== TEMPLATE_COLLECTION_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getTemplateCollections: () => collections,

    async seedFromPersistedTemplateCollections(persisted: V5.Collection[]): Promise<void> {
      for (const coll of persisted) {
        const batch = seedTemplateCollection(coll, contextFactory());
        const result = await oracle.apply(batch, []);
        if (!result.ok) {
          logger.info(
            'TemplateCollectionCache',
            `seed: collection ${coll.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info(
        'TemplateCollectionCache',
        `Seeded ${persisted.length} template collections for ws=${workspaceId}`,
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

let active: TemplateCollectionCache | null = null;

export function setActiveTemplateCollectionCache(cache: TemplateCollectionCache | null): void {
  active = cache;
}

export function getActiveTemplateCollectionCache(): TemplateCollectionCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function projectAll(materialized: MaterializedEntity[]): V5.Collection[] {
  const out: V5.Collection[] = [];
  for (const m of materialized) {
    if (m.type !== TEMPLATE_COLLECTION_ENTITY_TYPE) continue;
    const coll = projectTemplateCollection(m);
    if (coll) out.push(coll);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, collections: V5.Collection[]): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).templateCollections, collections);
  } catch (err) {
    logger.info(
      'TemplateCollectionCache',
      `persist failed (ws=${workspaceId}):`,
      (err as Error).message,
    );
  }
}
