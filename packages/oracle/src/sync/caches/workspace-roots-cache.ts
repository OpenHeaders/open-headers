/**
 * Workspace-roots cache + persistence sink.
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core, the
 * trusted-roots shape. Persists the three trees' collection order to
 * `wsKeys(scope).workspaceRoots`; hydration re-seeds the singleton
 * from it with ascending keys in array order, so collection order
 * survives a restart. An absent record seeds nothing: the roots are
 * observable without a create, so the first collection slot is what
 * makes the projection appear.
 */

import { WorkspaceRootsSchema } from '@openheaders/core/schemas';
import { WORKSPACE_ROOTS_ENTITY_TYPE } from '@openheaders/core/sync';
import { seedWorkspaceRoots } from '@openheaders/core/sync-builders/projections/workspace-roots-projection';
import { EMPTY_WORKSPACE_ROOTS, type WorkspaceRoots } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { projectWorkspaceRootsSingleton } from '../post-state/workspace-roots-post-state';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';

export type WorkspaceRootsCacheListener = () => void;

export interface WorkspaceRootsCache {
  readonly workspaceId: string;
  getWorkspaceRoots(): WorkspaceRoots;
  seedFromPersistedWorkspaceRoots(roots: WorkspaceRoots): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: WorkspaceRootsCacheListener): () => void;
  dispose(): void;
}

export function createWorkspaceRootsCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): WorkspaceRootsCache {
  const core: SingletonEntityCache<WorkspaceRoots, WorkspaceRoots> = createSingletonEntityCache(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: WORKSPACE_ROOTS_ENTITY_TYPE,
      loggerTag: 'WorkspaceRootsCache',
      emptySnapshot: EMPTY_WORKSPACE_ROOTS,
      project: (o) => projectWorkspaceRootsSingleton(o)?.workspaceRoots ?? null,
      buildSeedBatch: (roots, ctx) => seedWorkspaceRoots(roots, ctx),
      persist: (scope, roots) => hostStorage.set(wsKeys(scope).workspaceRoots, roots),
      loadFromStorage: (scope) =>
        hostStorage.getValidated(wsKeys(scope).workspaceRoots, WorkspaceRootsSchema, {
          onError: driftRecorder({
            subsystem: 'workspace',
            storageKey: wsKeys(scope).workspaceRoots.key,
            workspaceId: scope,
          }),
        }),
    },
  );

  return {
    workspaceId: core.scope,
    getWorkspaceRoots: core.getSnapshot,
    seedFromPersistedWorkspaceRoots: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
