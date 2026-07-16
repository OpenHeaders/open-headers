/**
 * Spec cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { SpecSchema } from '@openheaders/core/schemas';
import { SPEC_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectSpec, seedSpec } from '@openheaders/core/sync-builders/projections/spec-projection';
import type { Spec } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { createFlatEntityCache } from './flat-entity-cache';

export type SpecCacheListener = () => void;

export interface SpecCache {
  readonly workspaceId: string;
  getSpecs(): Spec[];
  seedFromPersistedSpecs(items: Spec[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: SpecCacheListener): () => void;
  dispose(): void;
}

export function createSpecCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): SpecCache {
  const core = createFlatEntityCache<Spec, typeof SPEC_ENTITY_TYPE>(workspaceId, oracle, broadcast, contextFactory, {
    entityType: SPEC_ENTITY_TYPE,
    loggerTag: 'SpecCache',
    storageKey: (ws) => wsKeys(ws).specs,
    project: projectSpec,
    seed: seedSpec,
    loadFromStorage: (ws) =>
      hostStorage.getValidatedArray(wsKeys(ws).specs, SpecSchema, {
        onError: driftRecorder({
          subsystem: 'workspace',
          storageKey: wsKeys(ws).specs.key,
          workspaceId: ws,
        }),
      }),
  });
  return {
    workspaceId: core.workspaceId,
    getSpecs: core.getEntities,
    seedFromPersistedSpecs: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
