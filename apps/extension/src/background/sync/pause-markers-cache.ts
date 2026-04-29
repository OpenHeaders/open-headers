/**
 * Pause-markers cache + persistence sink (Phase B).
 *
 * Mirrors `vault-cache.ts` for the singleton pause-markers entity.
 * Subscribes to the oracle's broadcast bus, re-projects the
 * materialized state on every committed pause-markers envelope, and
 * persists the projected `Record<path, marker>` back to
 * `chrome.storage.local` under the workspace's `pauseMarkers` key so
 * legacy readers (DNR manager via `getPauseMarkers()` in
 * `pause-markers-store`, the renderer via `extensionStorage.subscribe`
 * in `RuleContext`) keep working without change.
 *
 * Hydration: `seedFromPersistedPauseMarkers(record)` applies one
 * `seedPauseMarkers` batch through the oracle. Boot-time replay
 * through this same sink is idempotent and byte-stable.
 *
 * Pause markers are user-visible UX state, not secrets — broadcast
 * + sync transports carry them freely. No sensitivity scrub needed.
 */

import { PAUSE_MARKERS_ENTITY_TYPE } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  EMPTY_PAUSE_MARKERS,
  type PauseMarkersSnapshot,
  seedPauseMarkers,
} from '@/shared/sync/pause-markers-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { projectPauseMarkersSingleton } from './pause-markers-post-state';
import type { SwMutatorContextFactory } from './sw-context';

export type PauseMarkersCacheListener = () => void;

export interface PauseMarkersCache {
  readonly workspaceId: string;
  /** Snapshot of the singleton record. Returns the empty default
   *  until the oracle's first commit lands. */
  getSnapshot(): PauseMarkersSnapshot;
  /** Replace the cache from a persisted singleton record and seed
   *  the oracle. Drives boot-time hydration and the workspace-switch
   *  path. */
  seedFromPersistedPauseMarkers(
    record: Readonly<Record<string, 'paused' | 'unpaused'>>,
  ): Promise<void>;
  onChange(listener: PauseMarkersCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createPauseMarkersCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): PauseMarkersCache {
  let snapshot: PauseMarkersSnapshot = EMPTY_PAUSE_MARKERS;
  const listeners = new Set<PauseMarkersCacheListener>();

  const refreshFromOracle = (): void => {
    const projection = projectPauseMarkersSingleton(oracle);
    snapshot = projection ? { markers: projection.markers } : EMPTY_PAUSE_MARKERS;
    void persist(workspaceId, snapshot);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('PauseMarkersCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== PAUSE_MARKERS_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getSnapshot: () => snapshot,

    async seedFromPersistedPauseMarkers(
      persisted: Readonly<Record<string, 'paused' | 'unpaused'>>,
    ): Promise<void> {
      const batch = seedPauseMarkers(persisted, contextFactory());
      const result = await oracle.apply(batch, []);
      if (!result.ok) {
        logger.info(
          'PauseMarkersCache',
          `seedFromPersistedPauseMarkers failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
      refreshFromOracle();
      logger.info('PauseMarkersCache', `Seeded singleton for ws=${workspaceId}`);
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

let active: PauseMarkersCache | null = null;

export function setActivePauseMarkersCache(cache: PauseMarkersCache | null): void {
  active = cache;
}

export function getActivePauseMarkersCache(): PauseMarkersCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

async function persist(workspaceId: string, snapshot: PauseMarkersSnapshot): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).pauseMarkers, snapshot.markers);
  } catch (err) {
    logger.info(
      'PauseMarkersCache',
      `persist failed (ws=${workspaceId}):`,
      (err as Error).message,
    );
  }
}
