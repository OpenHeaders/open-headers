/**
 * ExtensionWorkspace cache (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core, with
 * two structural differences from the per-workspace singletons:
 *
 *   1. **Global scope.** The cache lives ABOVE per-workspace state (the
 *      catalog at id `EXTENSION_WORKSPACE_ID` carries the LIST of
 *      workspaces). The `scope` exposed here is the sentinel
 *      `EXTENSION_WORKSPACE_GLOBAL_SCOPE` ('__global__') used by the
 *      global oracle's IDB stripe; it survives workspace-switch
 *      dispose+init cycles.
 *   2. **No persistence sink yet.** Until commit 3 flips the legacy
 *      `workspace-store.ts` writers, the durable record at the
 *      `oh.workspaces` + `oh.activeWorkspaceId` chrome storage keys is
 *      owned by the legacy direct-write path. The cache mirrors the
 *      post-broadcast projection in memory only.
 *
 * Workspace-meta is user-visible (names + colors), not secrets — the
 * broadcast carries records freely.
 */

import { EXTENSION_WORKSPACE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { seedExtensionWorkspaces } from '@/shared/sync/extension-workspace-projection';
import type { InMemoryBroadcast } from './broadcast';
import { projectExtensionWorkspaceSingleton } from './extension-workspace-post-state';
import type { EntityOracle } from './oracle';
import {
  createSingletonEntityCache,
  type SingletonEntityCache,
} from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';

export interface ExtensionWorkspaceSnapshot {
  workspaces: V5.ExtensionWorkspace[];
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
  onChange(listener: ExtensionWorkspaceCacheListener): () => void;
  dispose(): void;
}

export function createExtensionWorkspaceCache(
  scope: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): ExtensionWorkspaceCache {
  const core: SingletonEntityCache<ExtensionWorkspaceSnapshot, ExtensionWorkspaceSnapshot> =
    createSingletonEntityCache(scope, oracle, broadcast, contextFactory, {
      entityType: EXTENSION_WORKSPACE_ENTITY_TYPE,
      loggerTag: 'ExtensionWorkspaceCache',
      emptySnapshot: EMPTY_EXTENSION_WORKSPACE,
      project: (o) => {
        const projection = projectExtensionWorkspaceSingleton(o);
        return projection
          ? { workspaces: projection.workspaces, activeWorkspaceId: projection.activeWorkspaceId }
          : null;
      },
      buildSeedBatch: (input, ctx) =>
        seedExtensionWorkspaces(input.workspaces, input.activeWorkspaceId, ctx),
    });

  return {
    scope: core.scope,
    getSnapshot: core.getSnapshot,
    seedFromPersistedState: core.seedFromPersisted,
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
