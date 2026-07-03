/**
 * Live-workflow cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveWorkflow } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { projectLiveWorkflow, seedLiveWorkflow } from '@openheaders/core/sync-builders/projections/live-workflow-projection';
import { driftRecorder } from './storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type LiveWorkflowCacheListener = () => void;

export interface LiveWorkflowCache {
  readonly workspaceId: string;
  getLiveWorkflows(): LiveWorkflow[];
  seedFromPersistedLiveWorkflows(items: LiveWorkflow[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: LiveWorkflowCacheListener): () => void;
  dispose(): void;
}

export function createLiveWorkflowCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LiveWorkflowCache {
  const core = createFlatEntityCache<LiveWorkflow, typeof LIVE_WORKFLOW_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: LIVE_WORKFLOW_ENTITY_TYPE,
      loggerTag: 'LiveWorkflowCache',
      storageKey: (ws) => wsKeys(ws).liveWorkflows,
      project: projectLiveWorkflow,
      seed: seedLiveWorkflow,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).liveWorkflows, LiveWorkflowSchema, {
          onError: driftRecorder({
            subsystem: 'live',
            storageKey: wsKeys(ws).liveWorkflows.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getLiveWorkflows: core.getEntities,
    seedFromPersistedLiveWorkflows: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
