/**
 * Workspace Orchestrator — cross-module composition layer.
 *
 * The workspace-store holds only workspace metadata (list + active id).
 * The per-workspace data stores (rules, templates, environments, pause
 * markers, test runs) each own their own CRUD + persistence. This file
 * sequences them together for operations that cut across concerns:
 *
 *   - `hydrateActiveWorkspaceStores()` — initial-boot fan-out hydrate.
 *   - `swapPerWorkspaceStores(targetId)` — wired into the workspace-
 *     store's `ActiveSwitchCoordinator`; runs the per-workspace store
 *     swaps + DNR rebuild whenever the cache observes an active flip.
 *   - `purgeWorkspaceData(ids)` — wired into the workspace-store's
 *     `WorkspaceRemovedCoordinator`; clears every per-workspace
 *     storage key + encapsulated stores for each removed id.
 *   - `duplicateWorkspace(id, options)` — snapshot the source workspace,
 *     mint a fresh workspace under `options.targetOrgId`, and replay
 *     the snapshot through `applyWorkspaceSnapshot`. Stays bridge-
 *     exposed because the renderer can't touch SW-owned per-workspace
 *     services.
 *
 * The renderer-direct workspace write path (`extension-workspace-write-
 * client.ts`) drives create / update / rename / delete / setActive /
 * reorder through the global oracle directly. The cache subscription in
 * `workspace-store.installCacheSink` invokes the coordinators above so
 * cross-store work (per-workspace store swaps, per-workspace data
 * purge) follows every renderer-direct mutation that needs it.
 */

import type { ExtensionWorkspace } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import {
  hydrateEnvironmentsFromStorage,
  purgeWorkspaceEnvironmentData,
  switchToWorkspace as switchEnvToWorkspace,
} from '../entity/environment-store';
import { purgeFilesForWorkspace } from '../entity/files-store';
import { purgeOAuthForWorkspace } from '../entity/oauth-token-store';
import { getPauseMarkers } from '../entity/pause-markers-store';
import {
  hydrateRequestScriptsReviewFromStorage,
  switchToWorkspace as switchRequestScriptsReviewToWorkspace,
} from '../entity/request-scripts-review-store';
import {
  hydrateFromStorage as hydrateRequestsFromStorage,
  switchToWorkspace as switchRequestsToWorkspace,
} from '../entity/request-store';
import {
  getRules,
  hydrateFromStorage as hydrateRulesFromStorage,
  switchToWorkspace as switchRulesToWorkspace,
} from '../entity/rule-store';
import { hydrateTemplatesFromStorage, switchToWorkspace as switchTemplatesToWorkspace } from '../entity/template-store';
import { purgeWorkspaceCooldowns } from '../entity/totp-cooldown-store';
import { purgeLiveCacheForWorkspace } from '../live/live-cache-store';
import {
  hydrateFromStorage as hydrateLiveVariablesFromStorage,
  purgeLiveVariablesForWorkspace,
  switchToWorkspace as switchLiveVariablesToWorkspace,
} from '../live/live-variable-store';
import {
  hydrateFromStorage as hydrateLiveWorkflowsFromStorage,
  purgeLiveWorkflowsForWorkspace,
  switchToWorkspace as switchLiveWorkflowsToWorkspace,
} from '../live/live-workflow-store';
import { hostStorage, type StorageKey, wsKeys } from '../storage';
import { getOracleHostHooks } from '../sync';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '../sync/service';
import { applyWorkspaceSnapshot } from '../sync/snapshot-applier';
import { buildSnapshotForWorkspace } from '../sync/snapshot-builder';
import { createWorkspace as createWorkspaceMeta, getWorkspace } from './extension-workspace-store';

// ── Storage key helpers ─────────────────────────────────────────────

/**
 * Per-workspace keys the orchestrator clears on delete. Environments /
 * vault / files / oauth / live-* each have their own purge
 * paths (called explicitly below in `purgeWorkspaceData`) so they stay
 * encapsulated and we don't list them here.
 */
function perWorkspaceDataKeys(workspaceId: string): StorageKey<unknown>[] {
  const k = wsKeys(workspaceId);
  return [
    k.rules,
    k.collections,
    k.folders,
    k.requests,
    k.requestCollections,
    k.requestFolders,
    k.templates,
    k.templateCollections,
    k.templateFolders,
    k.pauseMarkers,
    k.tabSession,
    k.panelLayout,
    k.settingsWorkspaceTaste,
    k.settingsWorkspaceBehavioral,
    k.importReports,
    k.requestScriptsReviewPending,
    k.scriptPackages,
    k.responseExamples,
    k.specs,
  ];
}

// ── Initial hydration ───────────────────────────────────────────────

/**
 * Hydrate every per-workspace store from the active workspace's keys.
 * Called once at SW bootstrap after `workspace-store.bootstrap()`.
 */
export async function hydrateActiveWorkspaceStores(): Promise<void> {
  await Promise.all([
    hydrateEnvironmentsFromStorage(),
    hydrateTemplatesFromStorage(),
    hydrateRulesFromStorage(),
    hydrateRequestsFromStorage(),
    hydrateLiveWorkflowsFromStorage(),
    hydrateLiveVariablesFromStorage(),
    hydrateRequestScriptsReviewFromStorage(),
  ]);
  // Default "User Templates" collection is seeded lazily on first
  // template create (message-handler `createTemplate` dispatch). Eager
  // seed at hydration time is impossible now that the helper routes
  // through the sync oracle — the oracle isn't initialized yet.
}

// ── Active-flip coordinator ─────────────────────────────────────────

/**
 * Wired into `workspace-store.setActiveSwitchCoordinator` at boot.
 * Runs whenever the cache observes the active workspace pointer flip
 * (renderer-direct setActive, or a delete-of-active that bundled the
 * neighbour-pointing setActive in the same batch).
 *
 * Ordering invariant: this coordinator MUST complete before the
 * generic `notifyChange` fires (the workspace-store enforces this by
 * deferring `notifyChange` until the awaited coordinator chain
 * resolves) — otherwise `bridgeXSyncEngine` re-seeds in the
 * `onWorkspaceStoreChange` listener would observe the previous
 * workspace's data still in `getRules()` etc.
 */
export async function swapPerWorkspaceStores(targetId: string): Promise<void> {
  const target = getWorkspace(targetId);
  if (!target) {
    logger.warn('WorkspaceOrchestrator', `swapPerWorkspaceStores: unknown id ${targetId}`);
    return;
  }
  await Promise.all([
    switchRulesToWorkspace(targetId),
    switchTemplatesToWorkspace(targetId),
    switchEnvToWorkspace(targetId),
    switchRequestsToWorkspace(targetId),
    switchLiveWorkflowsToWorkspace(targetId),
    switchLiveVariablesToWorkspace(targetId),
    switchRequestScriptsReviewToWorkspace(targetId),
  ]);

  // One broad cache-invalidation baseline reset — the union of
  // outgoing + incoming effective origins. Cheaper than per-rule diffs
  // when workspace swaps can change dozens of rules at once. Host wires
  // the rule-state-observer + cache-invalidator; non-browser hosts no-op.
  const hooks = getOracleHostHooks();
  hooks.onWorkspaceSwitched?.(getRules(), getPauseMarkers());

  hooks.scheduleRuleEngineUpdate?.('workspace', { immediate: true });

  logger.info('WorkspaceOrchestrator', `Switched to workspace ${targetId}`);
  hooks.recordLog?.({
    subsystem: 'workspace',
    op: 'switch',
    level: 'info',
    message: `Switched to workspace ${target.name}`,
    context: { workspaceId: targetId },
  });
}

// ── Removed-workspace coordinator ───────────────────────────────────

/**
 * Wired into `workspace-store.setWorkspaceRemovedCoordinator` at boot.
 * Clears every per-workspace storage key + encapsulated store data
 * for each removed workspace id. Independent of the active-flip
 * coordinator — both run in sequence (remove first, then swap) when a
 * delete-of-active batch lands.
 */
export async function purgeWorkspaceData(ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    await hostStorage.remove(perWorkspaceDataKeys(id));
    await purgeWorkspaceEnvironmentData(id);
    await purgeFilesForWorkspace(id);
    await purgeOAuthForWorkspace(id);
    await purgeLiveWorkflowsForWorkspace(id);
    await purgeLiveVariablesForWorkspace(id);
    await purgeLiveCacheForWorkspace(id);
    purgeWorkspaceCooldowns(id);
    logger.info('WorkspaceOrchestrator', `Purged data for removed workspace ${id}`);
  }
}

// ── Duplicate ───────────────────────────────────────────────────────

interface DuplicateOptions {
  name?: string;
  /** Org for the new workspace. Defaults to the source's Org. */
  targetOrgId?: string;
  /** When false, the copy lands with an empty vault and no OAuth
   *  bundles — the user re-enters secrets in the duplicate. */
  includeSecrets?: boolean;
}

/**
 * Duplicate a workspace via the snapshot pipeline.
 *
 * Builds a {@link WorkspaceSnapshot} of the source workspace's current
 * materialized state, mints a fresh workspace under `targetOrgId`
 * (defaults to the source's Org), retargets the snapshot at the new
 * workspace id, and replays it through {@link applyWorkspaceSnapshot}.
 * The seed envelopes carry the new workspace's HLC + nodeId so the
 * duplicate is a fresh authorship event under the target Org — no FK
 * rewrite of historical envelopes, no attribution forging.
 *
 * Entity uids are namespaced per-workspace (each workspace owns its
 * own oracle + mutation log), so the snapshot's uids transfer verbatim
 * with no risk of collision against the source.
 *
 * Secrets-strip: `vault` + `oauthBundles` post-states are cleared from
 * the snapshot when `!includeSecrets`. OAuth tokens are bound to a
 * specific consent grant; copying them across workspace identities
 * would let two duplicates race on refresh-rotation. `liveValues` are
 * always cleared (ephemeral cache keyed by regenerated workflow uids).
 *
 * Test runs, open editor tabs, and panel layout are NOT carried — runs
 * belong to the original, and the new workspace should open with a
 * clean view. The snapshot pipeline already excludes those.
 */
export async function duplicateWorkspace(
  sourceId: string,
  options: DuplicateOptions = {},
): Promise<ExtensionWorkspace | null> {
  const source = getWorkspace(sourceId);
  if (!source) return null;

  const includeSecrets = options.includeSecrets ?? false;

  const snapshot = await buildSnapshotForWorkspace(sourceId);
  if (!snapshot) {
    logger.warn('WorkspaceOrchestrator', `duplicateWorkspace: source ${sourceId} produced no snapshot`);
    return null;
  }

  const newMeta = await createWorkspaceMeta({
    name: options.name ?? `${source.name} (copy)`,
    description: source.description,
    color: source.color,
    kind: source.kind,
    orgId: options.targetOrgId ?? source.orgId,
  });

  const retargeted = {
    ...snapshot,
    workspaceId: newMeta.id,
    ...(includeSecrets ? {} : { vault: [], oauthBundles: [] }),
    // Live values are ephemeral cache keyed by run-key; the duplicate
    // regenerates workflow uids, so carrying them verbatim would key a
    // value to a workflow that no longer exists. Always dropped — the
    // copy warms its own cache on first refresh (matches `liveCache`).
    liveValues: [],
  };

  const svc = getOrCreateWorkspaceService(newMeta.id);
  let entitiesApplied = 0;
  try {
    await svc.hydrated;
    const result = await applyWorkspaceSnapshot(retargeted, { makeContext: () => svc.context.next() });
    entitiesApplied = result.entitiesApplied;
  } finally {
    releaseWorkspaceService(newMeta.id);
  }

  logger.info(
    'WorkspaceOrchestrator',
    `Duplicated ${sourceId} → ${newMeta.id} (${entitiesApplied} entities, secrets=${includeSecrets ? 'on' : 'off'}, orgId=${newMeta.orgId})`,
  );
  return newMeta;
}
