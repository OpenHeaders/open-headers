/**
 * Live-workflow cache + persistence sink.
 *
 * Subscribes to the oracle's broadcast bus, re-projects every LW the
 * oracle holds on every committed envelope, and persists the projected
 * `V5.LiveWorkflow[]` back to `chrome.storage.local` under
 * `wsKeys(ws).liveWorkflows`.
 */

import type { MaterializedEntity } from '@openheaders/core/sync';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  projectLiveWorkflow,
  seedLiveWorkflow,
} from '@/shared/sync/live-workflow-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
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
  let liveWorkflows: V5.LiveWorkflow[] = [];
  const listeners = new Set<LiveWorkflowCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAll(oracle.materializeAll());
    liveWorkflows = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('LiveWorkflowCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== LIVE_WORKFLOW_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getLiveWorkflows: () => liveWorkflows,

    async seedFromPersistedLiveWorkflows(persisted: V5.LiveWorkflow[]): Promise<void> {
      for (const wf of persisted) {
        const batch = seedLiveWorkflow(wf, contextFactory());
        const result = await oracle.apply(batch, []);
        if (!result.ok) {
          logger.info(
            'LiveWorkflowCache',
            `seed: workflow ${wf.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info('LiveWorkflowCache', `Seeded ${persisted.length} live workflows for ws=${workspaceId}`);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}

let active: LiveWorkflowCache | null = null;

export function setActiveLiveWorkflowCache(cache: LiveWorkflowCache | null): void {
  active = cache;
}

export function getActiveLiveWorkflowCache(): LiveWorkflowCache | null {
  return active;
}

function projectAll(materialized: MaterializedEntity[]): V5.LiveWorkflow[] {
  const out: V5.LiveWorkflow[] = [];
  for (const m of materialized) {
    if (m.type !== LIVE_WORKFLOW_ENTITY_TYPE) continue;
    const wf = projectLiveWorkflow(m);
    if (wf) out.push(wf);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, items: V5.LiveWorkflow[]): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).liveWorkflows, items);
  } catch (err) {
    logger.info('LiveWorkflowCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}
