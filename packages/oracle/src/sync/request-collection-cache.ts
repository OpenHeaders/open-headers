/**
 * Request-collection cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { CollectionSchema } from '@openheaders/core/schemas';
import { REQUEST_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@openheaders/oracle/storage';
import { projectRequestCollection, seedRequestCollection } from '@openheaders/core/sync-builders/request-collection-projection';
import { driftRecorder } from './storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type RequestCollectionCacheListener = () => void;

export interface RequestCollectionCache {
  readonly workspaceId: string;
  getRequestCollections(): Collection[];
  seedFromPersistedRequestCollections(colls: Collection[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: RequestCollectionCacheListener): () => void;
  dispose(): void;
}

export function createRequestCollectionCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RequestCollectionCache {
  const core = createFlatEntityCache<Collection, typeof REQUEST_COLLECTION_ENTITY_TYPE>(
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
      loadFromStorage: (ws) =>
        extensionStorage.getValidatedArray(wsKeys(ws).requestCollections, CollectionSchema, {
          onError: driftRecorder({
            subsystem: 'request-executor',
            storageKey: wsKeys(ws).requestCollections.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getRequestCollections: core.getEntities,
    seedFromPersistedRequestCollections: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
