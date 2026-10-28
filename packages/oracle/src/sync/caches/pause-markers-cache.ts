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
 * The boot pass runs the catalog's version-1 member migration after the
 * core's: over the replayed oracle, every live path-keyed member is
 * retired or re-keyed by uid as `planLegacyPauseMarkerMigration` decides
 * (a version-2 add or tombstone at a later HLC supersedes it; otherwise
 * it is the container's latest word and converts), committed once as a
 * migration — logged, inbound origin like the stored-projection seeds
 * and the slot reconciler's heals, so a client never forwards it upward
 * and every host repairs its own log. A boot that finds no live
 * version-1 member mints nothing.
 *
 * Pause markers are user-visible UX state, not secrets — broadcast +
 * sync transports carry them freely. No sensitivity scrub needed.
 */

import {
  migrateLegacyPauseMarkers,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
} from '@openheaders/core/sync';
import {
  EMPTY_PAUSE_MARKERS,
  type PauseMarkersSeedSource,
  type PauseMarkersSnapshot,
  planLegacyPauseMarkerMigration,
  seedPauseMarkers,
} from '@openheaders/core/sync-builders/projections/pause-markers-projection';
import { logger } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { legacyPauseMarkerResolver, projectPauseMarkersSingleton } from '../post-state/pause-markers-post-state';
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

  const migrateLegacyMembers = async (): Promise<void> => {
    try {
      const plan = planLegacyPauseMarkerMigration(
        oracle.liveOrderedSetItems(PAUSE_MARKERS_ENTITY_TYPE, PAUSE_MARKERS_ID, PAUSE_MARKERS_PATH),
        legacyPauseMarkerResolver(oracle),
        (uid) => oracle.latestSetWriteHlc(PAUSE_MARKERS_ENTITY_TYPE, PAUSE_MARKERS_ID, PAUSE_MARKERS_PATH, uid),
      );
      if (plan.retire.length === 0 && plan.convert.length === 0) return;
      const { batch } = migrateLegacyPauseMarkers(contextFactory(), plan);
      const result = await oracle.apply(batch, 'inbound');
      if (!result.ok) {
        logger.info(
          'PauseMarkersCache',
          `version-1 member migration failed (ws=${workspaceId}): ${result.failure?.status} — ${result.failure?.detail ?? 'no detail'}`,
        );
        return;
      }
      logger.info(
        'PauseMarkersCache',
        `retired ${plan.retire.length} and re-keyed ${plan.convert.length} version-1 member(s) for ws=${workspaceId}`,
      );
    } catch (err) {
      logger.info(
        'PauseMarkersCache',
        `version-1 member migration failed (ws=${workspaceId}): ${(err as Error).message}`,
      );
    }
  };

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedPauseMarkers: core.seedFromPersisted,
    async hydrateFromStorage(): Promise<void> {
      await core.hydrateFromStorage();
      await migrateLegacyMembers();
    },
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
