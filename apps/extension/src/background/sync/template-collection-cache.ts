/**
 * Template-collection cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { wsKeys } from '@/shared/storage';
import {
  projectTemplateCollection,
  seedTemplateCollection,
} from '@/shared/sync/template-collection-projection';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type TemplateCollectionCacheListener = () => void;

export interface TemplateCollectionCache {
  readonly workspaceId: string;
  getTemplateCollections(): V5.Collection[];
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
  const core = createFlatEntityCache<V5.Collection, typeof TEMPLATE_COLLECTION_ENTITY_TYPE>(
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
    },
  );
  return {
    workspaceId: core.workspaceId,
    getTemplateCollections: core.getEntities,
    seedFromPersistedTemplateCollections: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

let active: TemplateCollectionCache | null = null;

export function setActiveTemplateCollectionCache(cache: TemplateCollectionCache | null): void {
  active = cache;
}

export function getActiveTemplateCollectionCache(): TemplateCollectionCache | null {
  return active;
}
