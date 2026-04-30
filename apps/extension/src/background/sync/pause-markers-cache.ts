/**
 * Pause-markers cache + persistence sink (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Keeps
 * the entity-named API (`getSnapshot`, `seedFromPersistedPauseMarkers`)
 * so call sites (DNR manager, RuleContext) stay unchanged.
 *
 * Pause markers are user-visible UX state, not secrets — broadcast +
 * sync transports carry them freely. No sensitivity scrub needed.
 */

import { PAUSE_MARKERS_ENTITY_TYPE } from '@openheaders/core/sync';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  EMPTY_PAUSE_MARKERS,
  type PauseMarkersSnapshot,
  seedPauseMarkers,
} from '@/shared/sync/pause-markers-projection';
import type { InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { projectPauseMarkersSingleton } from './pause-markers-post-state';
import {
  createSingletonEntityCache,
  type SingletonEntityCache,
} from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';

export type PauseMarkersCacheListener = () => void;

export interface PauseMarkersCache {
  readonly workspaceId: string;
  getSnapshot(): PauseMarkersSnapshot;
  seedFromPersistedPauseMarkers(
    record: Readonly<Record<string, 'paused' | 'unpaused'>>,
  ): Promise<void>;
  onChange(listener: PauseMarkersCacheListener): () => void;
  dispose(): void;
}

export function createPauseMarkersCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): PauseMarkersCache {
  const core: SingletonEntityCache<
    PauseMarkersSnapshot,
    Readonly<Record<string, 'paused' | 'unpaused'>>
  > = createSingletonEntityCache(workspaceId, oracle, broadcast, contextFactory, {
    entityType: PAUSE_MARKERS_ENTITY_TYPE,
    loggerTag: 'PauseMarkersCache',
    emptySnapshot: EMPTY_PAUSE_MARKERS,
    project: (o) => {
      const projection = projectPauseMarkersSingleton(o);
      return projection ? { markers: projection.markers } : null;
    },
    buildSeedBatch: (input, ctx) => seedPauseMarkers(input, ctx),
    persist: (scope, snap) => extensionStorage.set(wsKeys(scope).pauseMarkers, snap.markers),
  });

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedPauseMarkers: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: PauseMarkersCache | null = null;

export function setActivePauseMarkersCache(cache: PauseMarkersCache | null): void {
  active = cache;
}

export function getActivePauseMarkersCache(): PauseMarkersCache | null {
  return active;
}
