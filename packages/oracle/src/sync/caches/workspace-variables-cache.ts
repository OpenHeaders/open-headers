/**
 * Workspace-variables cache + persistence sink (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Keeps
 * the entity-named API (`getWorkspaceVariables`,
 * `seedFromPersistedWorkspaceVariables`) so call sites (env-store local
 * mirror, exporter, variables-resolver) stay unchanged.
 */

import { WorkspaceVariablesSchema } from '@openheaders/core/schemas';
import { WORKSPACE_VARIABLES_ENTITY_TYPE } from '@openheaders/core/sync';
import type { WorkspaceVariables } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { seedWorkspaceVariables } from '@openheaders/core/sync-builders/projections/workspace-variables-projection';
import { driftRecorder } from './storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';
import { projectWorkspaceVariablesSingleton } from './workspace-variables-post-state';

const EMPTY_WORKSPACE_VARIABLES: WorkspaceVariables = {
  schemaVersion: 5,
  variables: [],
};

export type WorkspaceVariablesCacheListener = () => void;

export interface WorkspaceVariablesCache {
  readonly workspaceId: string;
  getWorkspaceVariables(): WorkspaceVariables;
  seedFromPersistedWorkspaceVariables(workspaceVars: WorkspaceVariables): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: WorkspaceVariablesCacheListener): () => void;
  dispose(): void;
}

export function createWorkspaceVariablesCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): WorkspaceVariablesCache {
  const core: SingletonEntityCache<WorkspaceVariables, WorkspaceVariables> = createSingletonEntityCache(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: WORKSPACE_VARIABLES_ENTITY_TYPE,
      loggerTag: 'WorkspaceVariablesCache',
      emptySnapshot: EMPTY_WORKSPACE_VARIABLES,
      project: (o) => projectWorkspaceVariablesSingleton(o)?.workspaceVariables ?? null,
      buildSeedBatch: (input, ctx) => seedWorkspaceVariables(input, ctx),
      persist: (scope, vars) => hostStorage.set(wsKeys(scope).workspaceVars, vars),
      loadFromStorage: (scope) =>
        hostStorage.getValidated(wsKeys(scope).workspaceVars, WorkspaceVariablesSchema, {
          onError: driftRecorder({
            subsystem: 'environment',
            storageKey: wsKeys(scope).workspaceVars.key,
            workspaceId: scope,
          }),
        }),
    },
  );

  return {
    workspaceId: core.scope,
    getWorkspaceVariables: core.getSnapshot,
    seedFromPersistedWorkspaceVariables: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
