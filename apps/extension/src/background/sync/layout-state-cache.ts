/**
 * Layout-state cache + persistence sink (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Keeps
 * the entity-named API (`getSnapshot`, `seedFromPersistedLayout`) so
 * call sites (`useResponsiveLayout` / `useDockLayoutStorage` hooks via
 * `extensionStorage.subscribe`) stay unchanged.
 *
 * Layout is pure UX state, not secrets — broadcast + sync transports
 * carry it freely. No sensitivity scrub needed.
 */

import { LAYOUT_STATE_ENTITY_TYPE } from '@openheaders/core/sync';
import { extensionStorage, type PersistedPanelLayout, wsKeys } from '@/shared/storage';
import {
  EMPTY_LAYOUT_STATE,
  type LayoutStateSnapshot,
  seedLayoutState,
} from '@/shared/sync/layout-state-projection';
import type { InMemoryBroadcast } from './broadcast';
import { projectLayoutStateSingleton } from './layout-state-post-state';
import type { EntityOracle } from './oracle';
import {
  createSingletonEntityCache,
  type SingletonEntityCache,
} from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';

export type LayoutStateCacheListener = () => void;

export interface LayoutStateCache {
  readonly workspaceId: string;
  getSnapshot(): LayoutStateSnapshot;
  seedFromPersistedLayout(layout: PersistedPanelLayout | null | undefined): Promise<void>;
  onChange(listener: LayoutStateCacheListener): () => void;
  dispose(): void;
}

export function createLayoutStateCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LayoutStateCache {
  const core: SingletonEntityCache<
    LayoutStateSnapshot,
    PersistedPanelLayout | null | undefined
  > = createSingletonEntityCache(workspaceId, oracle, broadcast, contextFactory, {
    entityType: LAYOUT_STATE_ENTITY_TYPE,
    loggerTag: 'LayoutStateCache',
    emptySnapshot: EMPTY_LAYOUT_STATE,
    project: (o) => {
      const projection = projectLayoutStateSingleton(o);
      return projection ? { layout: projection.layout } : null;
    },
    // Nothing persisted yet → leave the oracle empty; first renderer
    // write will create the singleton.
    buildSeedBatch: (input, ctx) => (input ? seedLayoutState(input, ctx) : null),
    persist: async (scope, snap) => {
      if (snap.layout === null || snap.layout === undefined) return;
      await extensionStorage.set(wsKeys(scope).panelLayout, snap.layout as PersistedPanelLayout);
    },
  });

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedLayout: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
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
