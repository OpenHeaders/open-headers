/**
 * Live-variable cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { wsKeys } from '@/shared/storage';
import { projectLiveVariable, seedLiveVariable } from '@/shared/sync/live-variable-projection';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type LiveVariableCacheListener = () => void;

export interface LiveVariableCache {
  readonly workspaceId: string;
  getLiveVariables(): V5.LiveVariable[];
  seedFromPersistedLiveVariables(items: V5.LiveVariable[]): Promise<void>;
  onChange(listener: LiveVariableCacheListener): () => void;
  dispose(): void;
}

export function createLiveVariableCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LiveVariableCache {
  const core = createFlatEntityCache<V5.LiveVariable, typeof LIVE_VARIABLE_ENTITY_TYPE>(
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
    },
  );
  return {
    workspaceId: core.workspaceId,
    getLiveVariables: core.getEntities,
    seedFromPersistedLiveVariables: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
