/**
 * Layout-state cache + persistence sink (Phase B).
 *
 * Mirrors `pause-markers-cache.ts` for the singleton layout-state
 * entity. Subscribes to the oracle's broadcast bus, re-projects the
 * materialized state on every committed layout-state envelope, and
 * persists the projected layout blob back to `chrome.storage.local`
 * under the workspace's `panelLayout` key so legacy readers (the
 * renderer's `useResponsiveLayout` / `useDockLayoutStorage` hooks via
 * `extensionStorage.subscribe`) keep working without change.
 *
 * Hydration: `seedFromPersistedLayout(layout)` applies one
 * `seedLayoutState` batch through the oracle. Boot-time replay through
 * this same sink is idempotent and byte-stable.
 *
 * Layout is pure UX state, not secrets — broadcast + sync transports
 * carry it freely. No sensitivity scrub needed.
 */

import { LAYOUT_STATE_ENTITY_TYPE } from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import { extensionStorage, type PersistedPanelLayout, wsKeys } from '@/shared/storage';
import { EMPTY_LAYOUT_STATE, type LayoutStateSnapshot, seedLayoutState } from '@/shared/sync/layout-state-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import { projectLayoutStateSingleton } from './layout-state-post-state';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type LayoutStateCacheListener = () => void;

export interface LayoutStateCache {
  readonly workspaceId: string;
  /** Snapshot of the singleton blob. Returns the empty default until
   *  the oracle's first commit lands. */
  getSnapshot(): LayoutStateSnapshot;
  /** Replace the cache from a persisted layout blob and seed the
   *  oracle. Drives boot-time hydration and the workspace-switch path. */
  seedFromPersistedLayout(layout: PersistedPanelLayout | null | undefined): Promise<void>;
  onChange(listener: LayoutStateCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createLayoutStateCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LayoutStateCache {
  let snapshot: LayoutStateSnapshot = EMPTY_LAYOUT_STATE;
  const listeners = new Set<LayoutStateCacheListener>();

  const refreshFromOracle = (): void => {
    const projection = projectLayoutStateSingleton(oracle);
    snapshot = projection ? { layout: projection.layout } : EMPTY_LAYOUT_STATE;
    void persist(workspaceId, snapshot);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('LayoutStateCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== LAYOUT_STATE_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getSnapshot: () => snapshot,

    async seedFromPersistedLayout(layout: PersistedPanelLayout | null | undefined): Promise<void> {
      if (!layout) {
        // Nothing persisted yet — leave the oracle empty; first
        // renderer write will create the singleton.
        return;
      }
      const batch = seedLayoutState(layout, contextFactory());
      const result = await oracle.apply(batch, []);
      if (!result.ok) {
        logger.info(
          'LayoutStateCache',
          `seedFromPersistedLayout failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
      refreshFromOracle();
      logger.info('LayoutStateCache', `Seeded singleton for ws=${workspaceId}`);
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

let active: LayoutStateCache | null = null;

export function setActiveLayoutStateCache(cache: LayoutStateCache | null): void {
  active = cache;
}

export function getActiveLayoutStateCache(): LayoutStateCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

async function persist(workspaceId: string, snapshot: LayoutStateSnapshot): Promise<void> {
  try {
    if (snapshot.layout === null || snapshot.layout === undefined) return;
    await extensionStorage.set(
      wsKeys(workspaceId).panelLayout,
      snapshot.layout as PersistedPanelLayout,
    );
  } catch (err) {
    logger.info(
      'LayoutStateCache',
      `persist failed (ws=${workspaceId}):`,
      (err as Error).message,
    );
  }
}
