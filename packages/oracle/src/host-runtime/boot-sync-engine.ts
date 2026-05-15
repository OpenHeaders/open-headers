/**
 * Boot the host-neutral sync-engine plane:
 *
 *   1. `initGlobalSyncService` — global-scope oracle for `extensionWorkspace`.
 *   2. `bridgeExtensionWorkspaceSyncEngine` — seed the global oracle.
 *   3. `setRuntimeActive` — make the persisted-active workspace current.
 *   4. `reseedAllPerWorkspaceBridges` — seed every per-workspace bridge.
 *   5. `ensureDefaultTemplateCollection` — seed the User Templates default.
 *   6. `attachGlobalWorkspaceCoordRunner` — drain SWAP / PURGE intents.
 *   7. `setupAwarenessLifelinePorts` — surface-connection refcounting.
 *
 * Pre-conditions (caller's responsibility):
 *   - `OracleHostHooks` already installed via `setOracleHostHooks`.
 *   - `bootstrapWorkspaces()` already resolved (the active id must be
 *     readable via `getActiveWorkspaceId()`).
 *   - `hydrateActiveWorkspaceStores()` already resolved (the per-workspace
 *     stores must be populated for the active workspace).
 *   - For browser hosts: any chrome adapters that the sync engine relies
 *     on (`hostStorage`, `LifelineServer`, lock runtime, persistence
 *     provider) must already be installed.
 *
 * Used identically by the extension SW and the Electron main process —
 * the latter installs Node-backed seams for the four oracle dependencies
 * (lock, mutation log, pending intents, lifeline) before calling this.
 */

import { logger } from '@openheaders/core/utils';
import { ensureDefaultTemplateCollection } from '../entity/template-store';
import { setupAwarenessLifelinePorts } from '../sync/awareness-lifeline';
import {
  attachGlobalWorkspaceCoordRunner,
  initGlobalSyncService,
} from '../sync/global-service';
import {
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  removeAwarenessByInstanceId,
  setRuntimeActive,
} from '../sync/service';
import {
  bridgeExtensionWorkspaceSyncEngine,
  getActiveWorkspaceId,
  peekActiveWorkspaceId,
} from '../workspace/extension-workspace-store';
import {
  purgeWorkspaceData,
  swapPerWorkspaceStores,
} from '../workspace/workspace-coordinator';
import { reseedAllPerWorkspaceBridges } from './reseed-bridges';

export interface BootSyncEngineResult {
  /** The active workspace at the moment the boot sequence finished. */
  activeWorkspaceId: string;
  /** Whether `setRuntimeActive` succeeded; logged-not-thrown on failure. */
  setActiveOk: boolean;
}

export async function bootSyncEngine(): Promise<BootSyncEngineResult> {
  // 1. Global-scope sync service. Owns the `extensionWorkspace` entity
  //    (cross-workspace metadata: list + active pointer). Boots once
  //    per process lifetime and never tears down.
  initGlobalSyncService();

  // 2. Seed the global oracle from the in-memory workspace-store
  //    populated by `bootstrapWorkspaces()`.
  await bridgeExtensionWorkspaceSyncEngine();

  // 3. Make the persisted-active workspace current. `workspace-store`
  //    bootstrap walked Active → Default → first valid, so the read
  //    here always resolves to a real workspace id.
  const activeId = getActiveWorkspaceId();
  const bootSetActive = await setRuntimeActive(activeId);
  if (!bootSetActive.ok) {
    // Recoverable: the next extensionWorkspace mutation routes through
    // the workspace-coord runner which will re-attempt setRuntimeActive.
    // Bridge handlers tolerate a brief null-Active via the snapshot
    // fallback in `service.ts`.
    logger.warn('HostRuntime', `boot setRuntimeActive failed: ${bootSetActive.reason}`);
  }

  // 4. Seed every per-workspace bridge for the active workspace. After
  //    this call, per-workspace entity writes route through the oracle;
  //    reads stay synchronous off the local mirror.
  await reseedAllPerWorkspaceBridges();

  // 5. Seed the default "User Templates" collection so the Templates
  //    section is non-empty on first run. Idempotent.
  await ensureDefaultTemplateCollection().catch((err: unknown) => {
    logger.warn('HostRuntime', 'ensureDefaultTemplateCollection at boot failed', err);
  });

  // 6. Workspace coordination runner — drains SWAP_PER_WORKSPACE_STORES
  //    + PURGE_WORKSPACE_DATA intents on every `extensionWorkspace`
  //    broadcast. Attached AFTER the initial per-workspace bridges so
  //    the runner doesn't fire its own (redundant) re-seed pass on the
  //    boot-time seed broadcast.
  attachGlobalWorkspaceCoordRunner({
    getActiveWorkspaceId: peekActiveWorkspaceId,
    swap: async (newId) => {
      await swapPerWorkspaceStores(newId);
      const result = await setRuntimeActive(newId);
      if (!result.ok) {
        logger.warn('HostRuntime', `workspace-coord setRuntimeActive(${newId}) failed: ${result.reason}`);
      }
      await reseedAllPerWorkspaceBridges();
      await ensureDefaultTemplateCollection().catch((err: unknown) => {
        logger.warn('HostRuntime', 'ensureDefaultTemplateCollection on workspace switch failed', err);
      });
    },
    purge: async (workspaceId) => {
      await purgeWorkspaceData([workspaceId]);
    },
  });

  // 7. Awareness lifeline ports — surface-connection refcounting drives
  //    workspace residency. The lifeline-server adapter is host-supplied
  //    (chrome.runtime.onConnect for the extension; MessagePort/IPC for
  //    desktop main). Default no-op falls through to "no presence" when
  //    no host has wired one.
  setupAwarenessLifelinePorts({
    removeByInstanceId: removeAwarenessByInstanceId,
    acquireWorkspace: (workspaceId) => {
      // Lifelines are refcount handles. The acquire bumps the workspace
      // service's refcount; the matching release fires from the port's
      // `onDisconnect` (or on a rebind). The return value is intentionally
      // unused — we keep no per-port service handle beyond the refcount.
      getOrCreateWorkspaceService(workspaceId);
    },
    releaseWorkspace: (workspaceId) => {
      releaseWorkspaceService(workspaceId);
    },
  });

  return { activeWorkspaceId: activeId, setActiveOk: bootSetActive.ok };
}
