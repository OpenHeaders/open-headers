/**
 * Environment cache + persistence sink (Phase B). Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { EnvironmentSchema } from '@openheaders/core/schemas';
import { ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { projectEnvironment, seedEnvironment } from '@/shared/sync/env-projection';
import { driftRecorder } from '../modules/storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type EnvironmentCacheListener = () => void;

export interface EnvironmentCache {
  readonly workspaceId: string;
  getEnvironments(): V5.Environment[];
  seedFromPersistedEnvironments(envs: V5.Environment[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
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
      loadFromStorage: (ws) =>
        extensionStorage.getValidatedArray(wsKeys(ws).environments, EnvironmentSchema, {
          onError: driftRecorder({
            subsystem: 'environment',
            storageKey: wsKeys(ws).environments.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getEnvironments: core.getEntities,
    seedFromPersistedEnvironments: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
