/**
 * ExtensionWorkspace cache (Phase B).
 *
 * Mirrors `files-cache.ts` for the singleton extensionWorkspace entity,
 * with two structural differences:
 *
 *   1. **Global scope.** The cache lives ABOVE per-workspace state (the
 *      catalog at id `EXTENSION_WORKSPACE_ID` carries the LIST of
 *      workspaces). The `workspaceId` exposed here is the sentinel
 *      `EXTENSION_WORKSPACE_GLOBAL_SCOPE` ('__global__') used by the
 *      global oracle's IDB stripe; it survives workspace-switch
 *      dispose+init cycles.
 *   2. **Persistence sink installation is delayed.** Until commit 3
 *      flips the legacy `workspace-store.ts` writers, the durable
 *      record at the `oh.workspaces` + `oh.activeWorkspaceId` chrome
 *      storage keys is owned by the legacy direct-write path. The
 *      cache mirrors the post-broadcast projection in memory only;
 *      its `getSnapshot()` is consumed by SW-internal projector +
 *      snapshot-RPC paths, not by hydration today. Commit 3 will add
 *      the persistence sink in the same diff that deletes
 *      `persistWorkspaces` / `persistActiveId`.
 *
 * Hydration: `seedFromPersistedState({ workspaces, activeWorkspaceId })`
 * applies one `seedExtensionWorkspaces` batch through the global oracle.
 * The caller (the bridge wiring at boot) sources the data from the
 * legacy `listWorkspaces()` + `getActiveWorkspaceId()` reads. Boot-time
 * replay through this sink is idempotent and byte-stable.
 *
 * Workspace-meta is user-visible (names + colors), not secrets — the
 * broadcast carries records freely.
 */

import {
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  type MutationBatch,
} from '@openheaders/core/sync';
import type { SyncExtensionWorkspacePostState } from '@openheaders/core/protocol';
import { logger } from '@utils/logger';
import { seedExtensionWorkspaces } from '@/shared/sync/extension-workspace-projection';
import type { V5 } from '@openheaders/core/types';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import { projectExtensionWorkspaceSingleton } from './extension-workspace-post-state';
import type { EntityOracle } from './oracle';
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
  /** Snapshot of the singleton record. Returns the empty default until
   *  the oracle's first commit lands. */
  getSnapshot(): ExtensionWorkspaceSnapshot;
  /** Replace the cache from a list of workspaces + activeId (sourced
   *  by the caller from `listWorkspaces()` + `getActiveWorkspaceId()`)
   *  and seed the global oracle. Drives boot-time hydration. */
  seedFromPersistedState(input: ExtensionWorkspaceSnapshot): Promise<void>;
  onChange(listener: ExtensionWorkspaceCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createExtensionWorkspaceCache(
  scope: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): ExtensionWorkspaceCache {
  let snapshot: ExtensionWorkspaceSnapshot = EMPTY_EXTENSION_WORKSPACE;
  const listeners = new Set<ExtensionWorkspaceCacheListener>();

  const refreshFromOracle = (): void => {
    const projection: SyncExtensionWorkspacePostState | null =
      projectExtensionWorkspaceSingleton(oracle);
    snapshot = projection
      ? { workspaces: projection.workspaces, activeWorkspaceId: projection.activeWorkspaceId }
      : EMPTY_EXTENSION_WORKSPACE;
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('ExtensionWorkspaceCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== EXTENSION_WORKSPACE_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    scope,
    getSnapshot: () => snapshot,

    async seedFromPersistedState(input: ExtensionWorkspaceSnapshot): Promise<void> {
      const batch: MutationBatch = seedExtensionWorkspaces(
        input.workspaces,
        input.activeWorkspaceId,
        contextFactory(),
      );
      const result = await oracle.apply(batch, []);
      if (!result.ok) {
        logger.info(
          'ExtensionWorkspaceCache',
          `seedFromPersistedState failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
      refreshFromOracle();
      logger.info(
        'ExtensionWorkspaceCache',
        `Seeded singleton (${input.workspaces.length} workspaces, active=${input.activeWorkspaceId ?? '<none>'})`,
      );
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

let active: ExtensionWorkspaceCache | null = null;

export function setActiveExtensionWorkspaceCache(cache: ExtensionWorkspaceCache | null): void {
  active = cache;
}

export function getActiveExtensionWorkspaceCache(): ExtensionWorkspaceCache | null {
  return active;
}
