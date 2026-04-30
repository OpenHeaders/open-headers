/**
 * Live-workflow cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { wsKeys } from '@/shared/storage';
import {
  projectLiveWorkflow,
  seedLiveWorkflow,
} from '@/shared/sync/live-workflow-projection';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type LiveWorkflowCacheListener = () => void;

export interface LiveWorkflowCache {
  readonly workspaceId: string;
  getLiveWorkflows(): V5.LiveWorkflow[];
  seedFromPersistedLiveWorkflows(items: V5.LiveWorkflow[]): Promise<void>;
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
    },
  );
  return {
    workspaceId: core.workspaceId,
    getLiveWorkflows: core.getEntities,
    seedFromPersistedLiveWorkflows: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

let active: LiveWorkflowCache | null = null;

export function setActiveLiveWorkflowCache(cache: LiveWorkflowCache | null): void {
  active = cache;
}

export function getActiveLiveWorkflowCache(): LiveWorkflowCache | null {
  return active;
}
