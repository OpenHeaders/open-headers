/**
 * Boot the host-neutral sync-engine plane:
 *
 *   1. `initGlobalSyncService` — global-scope oracle for `extensionWorkspace`.
 *   2. `bridgeExtensionWorkspaceSyncEngine` — seed the global oracle.
 *   3. `setRuntimeActive` — make the persisted-active workspace current.
 *   4. `reseedAllPerWorkspaceBridges` — re-point every per-workspace bridge.
 *   5. `ensureDefaultTemplateCollection` — seed the User Templates default.
 *   6. `attachGlobalWorkspaceCoordRunner` — drain SWAP / PURGE intents.
 *   7. `setupAwarenessLifelinePorts` — surface-connection refcounting.
 *
 * Pre-conditions (caller's responsibility):
 *   - `OracleHostHooks` already installed via `setOracleHostHooks`.
 *   - `bootstrapWorkspaces()` already resolved. A null active pointer
 *     (a host that declared `seedOnEmpty: false` booting an empty
 *     store) is a supported state: steps 1–2 and 6–7 still run — the
 *     daemon's workspace LIST arrives as global-scope rows, so the
 *     global oracle must be live — while the per-workspace steps 3–5
 *     are skipped. The first `setActiveExtensionWorkspace` flip routes
 *     through the coord runner below, which performs exactly the
 *     hydration boot skipped (swap + setRuntimeActive + reseed +
 *     template ensure).
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
import { setupAwarenessLifelinePorts } from '../sync/awareness/awareness-lifeline';
import { attachGlobalWorkspaceCoordRunner, initGlobalSyncService } from '../sync/global-service';
import {
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  removeAwarenessByInstanceId,
  setRuntimeActive,
} from '../sync/service';
import { bridgeExtensionWorkspaceSyncEngine, peekActiveWorkspaceId } from '../workspace/extension-workspace-store';
import { purgeWorkspaceData, swapPerWorkspaceStores } from '../workspace/workspace-coordinator';
import { reseedAllPerWorkspaceBridges } from './reseed-bridges';

export interface BootSyncEngineResult {
  /**
   * The active workspace at the moment the boot sequence finished.
   * Null on an empty boot (a `seedOnEmpty: false` host with an empty
   * store) — the per-workspace steps were skipped and the first
   * adoption hydrates them through the coord runner.
   */
  activeWorkspaceId: string | null;
  /** Whether `setRuntimeActive` succeeded; logged-not-thrown on failure. True when skipped on a null active. */
  setActiveOk: boolean;
}

export async function bootSyncEngine(): Promise<BootSyncEngineResult> {
  // 1. Global-scope sync service. Owns the `extensionWorkspace` entity
  //    (cross-workspace metadata: list + active pointer). Boots once
  //    per process lifetime and never tears down.
  initGlobalSyncService();

  // 2. Seed the global oracle from the in-memory workspace-store
  //    populated by `bootstrapWorkspaces()`. On an empty boot this
  //    still creates the (empty) workspace catalog, so inbound
  //    global-scope rows have an oracle to apply against.
  await bridgeExtensionWorkspaceSyncEngine();

  // 3. Make the persisted-active workspace current. On a non-empty
  //    store bootstrap walked Active → first valid, so the pointer
  //    always names a real workspace; on an empty boot it is null and
  //    steps 3–5 are skipped — the first adoption's coord-runner pass
  //    performs them.
  const activeId = peekActiveWorkspaceId();
  let bootSetActiveOk = true;
  if (activeId !== null) {
    const bootSetActive = await setRuntimeActive(activeId);
    bootSetActiveOk = bootSetActive.ok;
    if (!bootSetActive.ok) {
      // Recoverable: the next extensionWorkspace mutation routes through
      // the workspace-coord runner which will re-attempt setRuntimeActive.
      // Bridge handlers tolerate a brief null-Active via the snapshot
      // fallback in `service.ts`.
      logger.warn('HostRuntime', `boot setRuntimeActive failed: ${bootSetActive.reason}`);
    }

    // 4. Re-point every per-workspace bridge at the active workspace.
    //    Entity caches were already seeded by the service's `hydrated`
    //    gate inside `setRuntimeActive`; this pass wires the store
    //    mirrors (and seeds the cheap singletons). After this call,
    //    per-workspace entity writes route through the oracle; reads
    //    stay synchronous off the local mirror.
    await reseedAllPerWorkspaceBridges();

    // 5. Seed the default "User Templates" collection so the Templates
    //    section is non-empty on first run. Idempotent; a consumed
    //    workspace is skipped — its backend owns the default.
    await ensureDefaultTemplateCollection('initialization').catch((err: unknown) => {
      logger.warn('HostRuntime', 'ensureDefaultTemplateCollection at boot failed', err);
    });
  } else {
    logger.info('HostRuntime', 'boot with no active workspace — per-workspace steps deferred to first adoption');
  }

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
      await ensureDefaultTemplateCollection('initialization').catch((err: unknown) => {
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

  return { activeWorkspaceId: activeId, setActiveOk: bootSetActiveOk };
}
