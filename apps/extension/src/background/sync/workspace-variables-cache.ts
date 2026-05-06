/**
 * Workspace-variables cache + persistence sink (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Keeps
 * the entity-named API (`getWorkspaceVariables`,
 * `seedFromPersistedWorkspaceVariables`) so call sites (env-store local
 * mirror, exporter, variables-resolver) stay unchanged.
 */

import { WORKSPACE_VARIABLES_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { seedWorkspaceVariables } from '@/shared/sync/workspace-variables-projection';
import type { InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';
import { projectWorkspaceVariablesSingleton } from './workspace-variables-post-state';

const EMPTY_WORKSPACE_VARIABLES: V5.WorkspaceVariables = {
  schemaVersion: 5,
  variables: [],
};

export type WorkspaceVariablesCacheListener = () => void;

export interface WorkspaceVariablesCache {
  readonly workspaceId: string;
  getWorkspaceVariables(): V5.WorkspaceVariables;
  seedFromPersistedWorkspaceVariables(workspaceVars: V5.WorkspaceVariables): Promise<void>;
  onChange(listener: WorkspaceVariablesCacheListener): () => void;
  dispose(): void;
}

export function createWorkspaceVariablesCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): WorkspaceVariablesCache {
  const core: SingletonEntityCache<V5.WorkspaceVariables, V5.WorkspaceVariables> = createSingletonEntityCache(
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
      persist: (scope, vars) => extensionStorage.set(wsKeys(scope).workspaceVars, vars),
    },
  );

  return {
    workspaceId: core.scope,
    getWorkspaceVariables: core.getSnapshot,
    seedFromPersistedWorkspaceVariables: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
