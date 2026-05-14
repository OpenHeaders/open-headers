/**
 * Layout-state cache + persistence sink (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Keeps
 * the entity-named API (`getSnapshot`, `seedFromPersistedLayout`) so
 * call sites (`useResponsiveLayout` / `useDockLayoutStorage` hooks via
 * `hostStorage.subscribe`) stay unchanged.
 *
 * Layout is pure UX state, not secrets — broadcast + sync transports
 * carry it freely. No sensitivity scrub needed.
 */

import { LAYOUT_STATE_ENTITY_TYPE } from '@openheaders/core/sync';
import { hostStorage, type PersistedPanelLayout, wsKeys } from '@openheaders/oracle/storage';
import { EMPTY_LAYOUT_STATE, type LayoutStateSnapshot, seedLayoutState } from '@openheaders/core/sync-builders/layout-state-projection';
import type { InMemoryBroadcast } from './broadcast';
import { projectLayoutStateSingleton } from './layout-state-post-state';
import type { EntityOracle } from './oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';

export type LayoutStateCacheListener = () => void;

export interface LayoutStateCache {
  readonly workspaceId: string;
  getSnapshot(): LayoutStateSnapshot;
  seedFromPersistedLayout(layout: PersistedPanelLayout | null | undefined): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: LayoutStateCacheListener): () => void;
  dispose(): void;
}

export function createLayoutStateCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): LayoutStateCache {
  const core: SingletonEntityCache<LayoutStateSnapshot, PersistedPanelLayout | null | undefined> =
    createSingletonEntityCache(workspaceId, oracle, broadcast, contextFactory, {
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
        await hostStorage.set(wsKeys(scope).panelLayout, snap.layout as PersistedPanelLayout);
      },
      loadFromStorage: async (scope) => {
        const raw = await hostStorage.get(wsKeys(scope).panelLayout);
        return raw ?? null;
      },
    });

  return {
    workspaceId: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedLayout: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
