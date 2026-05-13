/**
 * Template-collection cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { CollectionSchema } from '@openheaders/core/schemas';
import { TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { projectTemplateCollection, seedTemplateCollection } from '@/shared/sync/template-collection-projection';
import { driftRecorder } from '../modules/storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type TemplateCollectionCacheListener = () => void;

export interface TemplateCollectionCache {
  readonly workspaceId: string;
  getTemplateCollections(): Collection[];
  seedFromPersistedTemplateCollections(colls: Collection[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: TemplateCollectionCacheListener): () => void;
  dispose(): void;
}

export function createTemplateCollectionCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TemplateCollectionCache {
  const core = createFlatEntityCache<Collection, typeof TEMPLATE_COLLECTION_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
      loggerTag: 'TemplateCollectionCache',
      storageKey: (ws) => wsKeys(ws).templateCollections,
      project: projectTemplateCollection,
      seed: seedTemplateCollection,
      loadFromStorage: (ws) =>
        extensionStorage.getValidatedArray(wsKeys(ws).templateCollections, CollectionSchema, {
          onError: driftRecorder({
            subsystem: 'rule-engine',
            storageKey: wsKeys(ws).templateCollections.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getTemplateCollections: core.getEntities,
    seedFromPersistedTemplateCollections: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
