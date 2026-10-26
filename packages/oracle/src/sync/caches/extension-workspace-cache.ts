/**
 * ExtensionWorkspace cache (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core, with
 * two structural differences from the per-workspace singletons:
 *
 *   1. **Global scope, two singletons.** The cache lives ABOVE
 *      per-workspace state: the catalog at id `EXTENSION_WORKSPACE_ID`
 *      carries the LIST of workspaces, the host-local `active-workspace`
 *      singleton beside it carries this host's pointer, and the cache
 *      re-projects the composed `(workspaces, activeWorkspaceId)` on a
 *      commit of either. The `scope` exposed here is the sentinel
 *      `EXTENSION_WORKSPACE_GLOBAL_SCOPE` ('__global__') used by the
 *      global oracle's IDB stripe; it survives workspace-switch
 *      dispose+init cycles.
 *   2. **No built-in persistence sink.** The cache mirrors the
 *      post-broadcast projection in memory only. Durable writes to
 *      `oh.workspaces` + `oh.runtimeActive.active` are owned by
 *      `installCacheSink` in `extension-workspace-store.ts`, which
 *      registers a `cache.onChange` listener that calls
 *      `persistFromCache(snap)` on every commit.
 *
 * Workspace-meta is user-visible (names + colors), not secrets — the
 * broadcast carries records freely.
 */

import { ACTIVE_WORKSPACE_ENTITY_TYPE, EXTENSION_WORKSPACE_ENTITY_TYPE } from '@openheaders/core/sync';
import { seedExtensionWorkspaces } from '@openheaders/core/sync-builders/projections/extension-workspace-projection';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { projectExtensionWorkspaceSingleton } from '../post-state/extension-workspace-post-state';
import type { SwMutatorContextFactory } from '../sw-context';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';

export interface ExtensionWorkspaceSnapshot {
  workspaces: ExtensionWorkspace[];
  activeWorkspaceId: string | null;
}

export const EMPTY_EXTENSION_WORKSPACE: ExtensionWorkspaceSnapshot = {
  workspaces: [],
  activeWorkspaceId: null,
};

export type ExtensionWorkspaceCacheListener = () => void;

export interface ExtensionWorkspaceCache {
  /** Sentinel scope id used by the global oracle. Stable across workspace switches. */
  readonly scope: string;
  getSnapshot(): ExtensionWorkspaceSnapshot;
  seedFromPersistedState(input: ExtensionWorkspaceSnapshot): Promise<void>;
  /**
   * A no-op: the global oracle hydrates from its log at init and the
   * workspace store's bridge migrates the stored projection once. Kept
   * on the surface so the cache satisfies the {@link EntityCacheLike}
   * contract uniformly.
   */
  hydrateFromStorage(): Promise<void>;
  /**
   * Re-project from the oracle outside the broadcast pipeline —
   * required after the log replay at boot and after a workspace
   * eviction's store surgery, neither of which mints an envelope for
   * the broadcast subscription to react to.
   */
  refresh(): void;
  onChange(listener: ExtensionWorkspaceCacheListener): () => void;
  dispose(): void;
}

export function createExtensionWorkspaceCache(
  scope: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): ExtensionWorkspaceCache {
  const core: SingletonEntityCache<ExtensionWorkspaceSnapshot, ExtensionWorkspaceSnapshot> = createSingletonEntityCache(
    scope,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: EXTENSION_WORKSPACE_ENTITY_TYPE,
      companionEntityTypes: [ACTIVE_WORKSPACE_ENTITY_TYPE],
      loggerTag: 'ExtensionWorkspaceCache',
      emptySnapshot: EMPTY_EXTENSION_WORKSPACE,
      project: (o) => {
        const projection = projectExtensionWorkspaceSingleton(o);
        return projection
          ? { workspaces: projection.workspaces, activeWorkspaceId: projection.activeWorkspaceId }
          : null;
      },
      buildSeedBatch: (input, ctx) => seedExtensionWorkspaces(input.workspaces, input.activeWorkspaceId, ctx),
    },
  );

  return {
    scope: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedState: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    refresh: core.refresh,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: ExtensionWorkspaceCache | null = null;

export function setActiveExtensionWorkspaceCache(cache: ExtensionWorkspaceCache | null): void {
  active = cache;
}

export function getActiveExtensionWorkspaceCache(): ExtensionWorkspaceCache | null {
  return active;
}
