/**
 * Live-variable cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { LiveVariableSchema } from '@openheaders/core/schemas';
import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveVariable } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@openheaders/oracle/storage';
import { projectLiveVariable, seedLiveVariable } from '@openheaders/oracle/sync-builders/live-variable-projection';
import { driftRecorder } from './storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type LiveVariableCacheListener = () => void;

export interface LiveVariableCache {
  readonly workspaceId: string;
  getLiveVariables(): LiveVariable[];
  seedFromPersistedLiveVariables(items: LiveVariable[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: LiveVariableCacheListener): () => void;
  dispose(): void;
}

export function createLiveVariableCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LiveVariableCache {
  const core = createFlatEntityCache<LiveVariable, typeof LIVE_VARIABLE_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: LIVE_VARIABLE_ENTITY_TYPE,
      loggerTag: 'LiveVariableCache',
      storageKey: (ws) => wsKeys(ws).liveVariables,
      project: projectLiveVariable,
      seed: seedLiveVariable,
      loadFromStorage: (ws) =>
        extensionStorage.getValidatedArray(wsKeys(ws).liveVariables, LiveVariableSchema, {
          onError: driftRecorder({
            subsystem: 'live',
            storageKey: wsKeys(ws).liveVariables.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getLiveVariables: core.getEntities,
    seedFromPersistedLiveVariables: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
