/**
 * Environment cache + persistence sink (Phase B). Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { wsKeys } from '@/shared/storage';
import { projectEnvironment, seedEnvironment } from '@/shared/sync/env-projection';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type EnvironmentCacheListener = () => void;

export interface EnvironmentCache {
  readonly workspaceId: string;
  getEnvironments(): V5.Environment[];
  seedFromPersistedEnvironments(envs: V5.Environment[]): Promise<void>;
  onChange(listener: EnvironmentCacheListener): () => void;
  dispose(): void;
}

export function createEnvironmentCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): EnvironmentCache {
  const core = createFlatEntityCache<V5.Environment, typeof ENVIRONMENT_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: ENVIRONMENT_ENTITY_TYPE,
      loggerTag: 'EnvironmentCache',
      storageKey: (ws) => wsKeys(ws).environments,
      project: projectEnvironment,
      seed: seedEnvironment,
    },
  );
  return {
    workspaceId: core.workspaceId,
    getEnvironments: core.getEntities,
    seedFromPersistedEnvironments: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

let active: EnvironmentCache | null = null;

export function setActiveEnvironmentCache(cache: EnvironmentCache | null): void {
  active = cache;
}

export function getActiveEnvironmentCache(): EnvironmentCache | null {
  return active;
}
