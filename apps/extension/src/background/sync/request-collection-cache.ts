/**
 * Request-collection cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { REQUEST_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { wsKeys } from '@/shared/storage';
import {
  projectRequestCollection,
  seedRequestCollection,
} from '@/shared/sync/request-collection-projection';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type RequestCollectionCacheListener = () => void;

export interface RequestCollectionCache {
  readonly workspaceId: string;
  getRequestCollections(): V5.Collection[];
  seedFromPersistedRequestCollections(colls: V5.Collection[]): Promise<void>;
  onChange(listener: RequestCollectionCacheListener): () => void;
  dispose(): void;
}

export function createRequestCollectionCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RequestCollectionCache {
  const core = createFlatEntityCache<V5.Collection, typeof REQUEST_COLLECTION_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: REQUEST_COLLECTION_ENTITY_TYPE,
      loggerTag: 'RequestCollectionCache',
      storageKey: (ws) => wsKeys(ws).requestCollections,
      project: projectRequestCollection,
      seed: seedRequestCollection,
    },
  );
  return {
    workspaceId: core.workspaceId,
    getRequestCollections: core.getEntities,
    seedFromPersistedRequestCollections: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

let active: RequestCollectionCache | null = null;

export function setActiveRequestCollectionCache(cache: RequestCollectionCache | null): void {
  active = cache;
}

export function getActiveRequestCollectionCache(): RequestCollectionCache | null {
  return active;
}
