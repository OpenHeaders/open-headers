/**
 * Environment cache + persistence sink (Phase B). Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { EnvironmentSchema } from '@openheaders/core/schemas';
import { ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Environment } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@openheaders/oracle/storage';
import { projectEnvironment, seedEnvironment } from '@openheaders/core/sync-builders/env-projection';
import { driftRecorder } from './storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type EnvironmentCacheListener = () => void;

export interface EnvironmentCache {
  readonly workspaceId: string;
  getEnvironments(): Environment[];
  seedFromPersistedEnvironments(envs: Environment[]): Promise<void>;
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
  const core = createFlatEntityCache<Environment, typeof ENVIRONMENT_ENTITY_TYPE>(
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
