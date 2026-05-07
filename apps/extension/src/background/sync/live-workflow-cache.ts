/**
 * Live-workflow cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { projectLiveWorkflow, seedLiveWorkflow } from '@/shared/sync/live-workflow-projection';
import { driftRecorder } from '../modules/storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type LiveWorkflowCacheListener = () => void;

export interface LiveWorkflowCache {
  readonly workspaceId: string;
  getLiveWorkflows(): V5.LiveWorkflow[];
  seedFromPersistedLiveWorkflows(items: V5.LiveWorkflow[]): Promise<void>;
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
  const core = createFlatEntityCache<V5.LiveWorkflow, typeof LIVE_WORKFLOW_ENTITY_TYPE>(
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
        extensionStorage.getValidatedArray(wsKeys(ws).liveWorkflows, LiveWorkflowSchema, {
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
