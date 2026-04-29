/**
 * Workspace-variables cache + persistence sink (Phase B).
 *
 * Mirrors `environment-cache.ts` / `collection-cache.ts` for the
 * singleton workspace-variables entity. Subscribes to the oracle's
 * broadcast bus, re-projects the materialized state on every
 * committed workspace-variables envelope, and persists the projected
 * `V5.WorkspaceVariables` back to `chrome.storage.local` under the
 * workspace's `workspaceVars` key so legacy readers (env-store local
 * mirror, exporter, variables-resolver) keep working without change.
 *
 * Hydration: `seedFromPersistedWorkspaceVariables(workspaceVars)`
 * applies one `seedWorkspaceVariables` batch through the oracle.
 * Boot-time replay through this same sink is idempotent and
 * byte-stable.
 */

import type { MaterializedEntity } from '@openheaders/core/sync';
import {
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  projectWorkspaceVariables,
  seedWorkspaceVariables,
} from '@/shared/sync/workspace-variables-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

const EMPTY_WORKSPACE_VARIABLES: V5.WorkspaceVariables = {
  schemaVersion: 5,
  variables: [],
};

export type WorkspaceVariablesCacheListener = () => void;

export interface WorkspaceVariablesCache {
  readonly workspaceId: string;
  /** Snapshot of the singleton record. Returns the empty default until
   *  the oracle's first commit lands. */
  getWorkspaceVariables(): V5.WorkspaceVariables;
  /** Replace the cache from a persisted singleton snapshot and seed
   *  the oracle. Drives boot-time hydration and the workspace-switch
   *  path. */
  seedFromPersistedWorkspaceVariables(workspaceVars: V5.WorkspaceVariables): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. */
  onChange(listener: WorkspaceVariablesCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createWorkspaceVariablesCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): WorkspaceVariablesCache {
  let snapshot: V5.WorkspaceVariables = EMPTY_WORKSPACE_VARIABLES;
  const listeners = new Set<WorkspaceVariablesCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectSingleton(oracle.materializeAll()) ?? EMPTY_WORKSPACE_VARIABLES;
    snapshot = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('WorkspaceVariablesCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== WORKSPACE_VARIABLES_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getWorkspaceVariables: () => snapshot,

    async seedFromPersistedWorkspaceVariables(persisted: V5.WorkspaceVariables): Promise<void> {
      const batch = seedWorkspaceVariables(persisted, contextFactory());
      const result = await oracle.apply(batch, []);
      if (!result.ok) {
        logger.info(
          'WorkspaceVariablesCache',
          `seedFromPersistedWorkspaceVariables failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
      refreshFromOracle();
      logger.info('WorkspaceVariablesCache', `Seeded singleton for ws=${workspaceId}`);
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

// ── module-level singleton glue ───────────────────────────────────

let active: WorkspaceVariablesCache | null = null;

export function setActiveWorkspaceVariablesCache(cache: WorkspaceVariablesCache | null): void {
  active = cache;
}

export function getActiveWorkspaceVariablesCache(): WorkspaceVariablesCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function projectSingleton(materialized: MaterializedEntity[]): V5.WorkspaceVariables | null {
  for (const m of materialized) {
    if (m.type !== WORKSPACE_VARIABLES_ENTITY_TYPE) continue;
    if (m.id !== WORKSPACE_VARIABLES_ID) continue;
    return projectWorkspaceVariables(m);
  }
  return null;
}

async function persist(workspaceId: string, workspaceVars: V5.WorkspaceVariables): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).workspaceVars, workspaceVars);
  } catch (err) {
    logger.info('WorkspaceVariablesCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}
