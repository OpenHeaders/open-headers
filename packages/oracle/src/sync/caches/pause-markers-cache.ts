/**
 * Pause-markers cache + persistence sink (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Keeps
 * the entity-named API (`getSnapshot`, `seedFromPersistedPauseMarkers`)
 * so call sites (DNR manager, RuleContext) stay unchanged.
 *
 * The persisted record is the uid-keyed `{ markers, entries }`; a
 * version-1 record at rest (path-keyed) seeds version-1 members and
 * the projection migrates them on read, so the next persist writes the
 * current shape.
 *
 * Pause markers are user-visible UX state, not secrets — broadcast +
 * sync transports carry them freely. No sensitivity scrub needed.
 */

import { PAUSE_MARKERS_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  EMPTY_PAUSE_MARKERS,
  type PauseMarkersSeedSource,
  type PauseMarkersSnapshot,
  seedPauseMarkers,
} from '@openheaders/core/sync-builders/projections/pause-markers-projection';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { projectPauseMarkersSingleton } from '../post-state/pause-markers-post-state';
import type { SwMutatorContextFactory } from '../sw-context';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';

export type PauseMarkersCacheListener = () => void;

export interface PauseMarkersCache {
  readonly workspaceId: string;
  getSnapshot(): PauseMarkersSnapshot;
  seedFromPersistedPauseMarkers(record: PauseMarkersSeedSource): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: PauseMarkersCacheListener): () => void;
  dispose(): void;
}

export function createPauseMarkersCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): PauseMarkersCache {
  const core: SingletonEntityCache<PauseMarkersSnapshot, PauseMarkersSeedSource> = createSingletonEntityCache(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: PAUSE_MARKERS_ENTITY_TYPE,
      loggerTag: 'PauseMarkersCache',
      emptySnapshot: EMPTY_PAUSE_MARKERS,
      project: (o) => projectPauseMarkersSingleton(o),
      buildSeedBatch: (input, ctx) => seedPauseMarkers(input, ctx),
      persist: (scope, snap) => hostStorage.set(wsKeys(scope).pauseMarkers, snap),
      loadFromStorage: async (scope) => {
        const raw = await hostStorage.get(wsKeys(scope).pauseMarkers);
        return raw ?? null;
      },
    },
  );

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedPauseMarkers: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
