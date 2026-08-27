/**
 * Trusted-roots cache + persistence sink.
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core, the
 * vault-cache shape minus the lock (trust material is never locked or
 * sensitive). Persists to `wsKeys(scope).trustedRoots`.
 */

import { TrustedRootsSchema } from '@openheaders/core/schemas';
import { TRUSTED_ROOTS_ENTITY_TYPE } from '@openheaders/core/sync';
import { seedTrustedRoots } from '@openheaders/core/sync-builders/projections/trusted-roots-projection';
import { EMPTY_TRUSTED_ROOTS, type TrustedRoots } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { projectTrustedRootsSingleton } from '../post-state/trusted-roots-post-state';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';

export type TrustedRootsCacheListener = () => void;

export interface TrustedRootsCache {
  readonly workspaceId: string;
  getTrustedRoots(): TrustedRoots;
  seedFromPersistedTrustedRoots(trustedRoots: TrustedRoots): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: TrustedRootsCacheListener): () => void;
  dispose(): void;
}

export function createTrustedRootsCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TrustedRootsCache {
  const core: SingletonEntityCache<TrustedRoots, TrustedRoots> = createSingletonEntityCache(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: TRUSTED_ROOTS_ENTITY_TYPE,
      loggerTag: 'TrustedRootsCache',
      emptySnapshot: EMPTY_TRUSTED_ROOTS,
      project: (o) => projectTrustedRootsSingleton(o)?.trustedRoots ?? null,
      isEmptySnapshot: (roots) => roots.roots.length === 0,
      buildSeedBatch: (roots, ctx) => seedTrustedRoots(roots, ctx),
      persist: (scope, roots) => hostStorage.set(wsKeys(scope).trustedRoots, roots),
      loadFromStorage: (scope) =>
        hostStorage.getValidated(wsKeys(scope).trustedRoots, TrustedRootsSchema, {
          onError: driftRecorder({
            subsystem: 'workspace',
            storageKey: wsKeys(scope).trustedRoots.key,
            workspaceId: scope,
          }),
        }),
    },
  );

  return {
    workspaceId: core.scope,
    getTrustedRoots: core.getSnapshot,
    seedFromPersistedTrustedRoots: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
