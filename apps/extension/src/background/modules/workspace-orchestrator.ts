/**
 * Workspace Orchestrator — cross-module composition layer.
 *
 * The workspace-store holds only workspace metadata (list + active id).
 * The per-workspace data stores (rules, templates, environments, pause
 * markers, test runs) each own their own CRUD + persistence. This file
 * sequences them together for operations that cut across concerns:
 *
 *   - `switchActiveWorkspace(id)` — flush outgoing, hydrate incoming,
 *     reseed cache-invalidation observer, rebuild DNR, broadcast.
 *   - `duplicateWorkspace(id, name)` — deep-copy all per-workspace data
 *     into a fresh workspace, regenerating uids and rewriting paths.
 *   - `deleteWorkspace(id)` — remove all per-workspace data keys for
 *     the deleted workspace (storage hygiene) after dropping it from
 *     the workspace list. If the deleted workspace was active, switch
 *     to the neighbour chosen by workspace-store first.
 *
 * Lives in modules/ so message-handler can import it without tripping
 * the dependency edge that would arise if the orchestration were
 * inlined in background.ts (modules/* → background/background.ts would
 * be circular).
 */

import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { deepCopyHierarchy } from '@openheaders/core/workspace-export';
import { logger } from '@utils/logger';
import { extensionStorage, type StorageKey, wsKeys } from '@/shared/storage';
import { getRulesPaused } from '../dnr-manager';
import {
  hydrateEnvironmentsFromStorage,
  purgeWorkspaceEnvironmentData,
  switchToWorkspace as switchEnvToWorkspace,
} from './environment-store';
import { purgeFilesForWorkspace } from './files-store';
import { purgeLiveCacheForWorkspace } from './live-cache-store';
import {
  hydrateFromStorage as hydrateLiveVariablesFromStorage,
  purgeLiveVariablesForWorkspace,
  switchToWorkspace as switchLiveVariablesToWorkspace,
} from './live-variable-store';
import {
  hydrateFromStorage as hydrateLiveWorkflowsFromStorage,
  purgeLiveWorkflowsForWorkspace,
  switchToWorkspace as switchLiveWorkflowsToWorkspace,
} from './live-workflow-store';
import { purgeOAuthForWorkspace } from './oauth-token-store';
import { recordLog } from './observability-log';
import {
  getPauseMarkers,
  hydratePauseMarkersFromStorage,
  switchToWorkspace as switchPauseMarkersToWorkspace,
} from './pause-markers-store';
import {
  hydrateFromStorage as hydrateRequestsFromStorage,
  switchToWorkspace as switchRequestsToWorkspace,
} from './request-store';
import { scheduleUpdate } from './rule-engine';
import { seedFromWorkspaceSwitch } from './rule-state-observer';
import {
  getRules,
  hydrateFromStorage as hydrateRulesFromStorage,
  type LocalFolder,
  switchToWorkspace as switchRulesToWorkspace,
} from './rule-store';
import {
  ensureDefaultTemplateCollection,
  hydrateTemplatesFromStorage,
  switchToWorkspace as switchTemplatesToWorkspace,
} from './template-store';
import { purgeWorkspaceTestRuns } from './test-run-store';
import { purgeWorkspaceCooldowns } from './totp-cooldown-store';
import {
  createWorkspace as createWorkspaceMeta,
  deleteWorkspace as deleteWorkspaceMeta,
  getActiveWorkspaceId,
  getWorkspace,
  setActiveWorkspaceId,
} from './workspace-store';

// ── Storage key helpers ─────────────────────────────────────────────

/**
 * Per-workspace keys the orchestrator clears on delete. Environments /
 * vault / testRuns / files / oauth / live-* each have their own purge
 * paths (called explicitly below in `deleteWorkspaceWithData`) so they
 * stay encapsulated and we don't list them here.
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
    k.settingsWorkspace,
    k.settingsCollection,
    k.importReports,
  ];
}

// ── Initial hydration ───────────────────────────────────────────────

/**
 * Hydrate every per-workspace store from the active workspace's keys.
 * Called once at SW bootstrap after `workspace-store.bootstrap()`.
 */
export async function hydrateActiveWorkspaceStores(): Promise<void> {
  await Promise.all([
    hydratePauseMarkersFromStorage(),
    hydrateEnvironmentsFromStorage(),
    hydrateTemplatesFromStorage(),
    hydrateRulesFromStorage(),
    hydrateRequestsFromStorage(),
    hydrateLiveWorkflowsFromStorage(),
    hydrateLiveVariablesFromStorage(),
  ]);
  // Seed a default "User Templates" collection so the Templates
  // section has a ready destination for user-authored templates on
  // a fresh workspace. Rules and requests stay unseeded — the user
  // creates those collections explicitly. `ensureDefaultTemplateCollection`
  // is idempotent; on an already-seeded workspace this is a no-op.
  ensureDefaultTemplateCollection();
}

// ── Switch ──────────────────────────────────────────────────────────

/**
 * Atomically switch the active workspace. Callers (message-handler,
 * UI RPC) get a single promise that resolves once every store has
 * swapped and the DNR rebuild has fired.
 *
 * Ordering matters — we swap per-workspace stores FIRST, then flip the
 * active pointer in workspace-store last. That guarantees the final
 * `workspaceChanged` broadcast (fired by workspace-store's notifyChange
 * via the listener in background.ts) sees stores that already return
 * the new workspace's data, so downstream refetches are coherent.
 */
export async function switchActiveWorkspace(targetId: string): Promise<boolean> {
  const current = getActiveWorkspaceId();
  if (current === targetId) return true;
  const target = getWorkspace(targetId);
  if (!target) return false;

  await Promise.all([
    switchRulesToWorkspace(targetId),
    switchTemplatesToWorkspace(targetId),
    switchPauseMarkersToWorkspace(targetId),
    switchEnvToWorkspace(targetId),
    switchRequestsToWorkspace(targetId),
    switchLiveWorkflowsToWorkspace(targetId),
    switchLiveVariablesToWorkspace(targetId),
  ]);

  // One broad cache-invalidation baseline reset — the union of
  // outgoing + incoming effective origins. Cheaper than per-rule diffs
  // when workspace swaps can change dozens of rules at once.
  seedFromWorkspaceSwitch(getRules(), getPauseMarkers(), getRulesPaused());

  scheduleUpdate('workspace', { immediate: true });

  // Flip the active pointer last. workspace-store's listener in
  // background.ts broadcasts `workspaceChanged` automatically; the
  // typed `onActiveWorkspaceChange` event also fires here so reactive
  // subscribers (live-refresh scheduler's switch-warm pass) reschedule
  // without the orchestrator having to know about them.
  await setActiveWorkspaceId(targetId);
  logger.info('WorkspaceOrchestrator', `Switched to workspace ${targetId}`);
  recordLog({
    subsystem: 'workspace',
    op: 'switch',
    level: 'info',
    message: `Switched to workspace ${target.name}`,
    context: { workspaceId: targetId },
  });
  return true;
}

// ── Duplicate ───────────────────────────────────────────────────────

interface DuplicateOptions {
  name?: string;
}

/**
 * Deep-copy a workspace. Rules, collections, folders, templates,
 * environments, workspace variables, and the vault are duplicated with
 * fresh uids; paths are rewritten to point at the new collection /
 * folder folder-names. Test runs, open editor tabs, and panel layout
 * are NOT copied — runs belong to the original, and the new workspace
 * should open with a clean view.
 */
export async function duplicateWorkspace(
  sourceId: string,
  options: DuplicateOptions = {},
): Promise<V5.ExtensionWorkspace | null> {
  const source = getWorkspace(sourceId);
  if (!source) return null;

  const newMeta = await createWorkspaceMeta({
    name: options.name ?? `${source.name} (copy)`,
    description: source.description,
    color: source.color,
    kind: source.kind,
  });

  const srcK = wsKeys(sourceId);
  const src = await extensionStorage.getMany({
    rules: srcK.rules,
    collections: srcK.collections,
    folders: srcK.folders,
    requests: srcK.requests,
    requestCollections: srcK.requestCollections,
    requestFolders: srcK.requestFolders,
    templates: srcK.templates,
    templateCollections: srcK.templateCollections,
    templateFolders: srcK.templateFolders,
    pauseMarkers: srcK.pauseMarkers,
    environments: srcK.environments,
    workspaceVars: srcK.workspaceVars,
    vault: srcK.vault,
    liveWorkflows: srcK.liveWorkflows,
    liveVariables: srcK.liveVariables,
  });

  // ── Rules side: rebuild uid + path mapping ───────────────────────
  const { remappedRules, remappedCollections, remappedFolders, containerPathRemap } = deepCopyRuleHierarchy(
    src.rules ?? [],
    src.collections ?? [],
    src.folders ?? [],
  );

  // ── Requests side: parallel structure under `requests/`. Uses the
  // same deep-copy logic as rules, just a different on-disk prefix.
  // Exposes `requestUidRemap` so the live-entities copy below can
  // rebind workflow-step `requestUid`s to the cloned tree.
  const { remappedRequests, remappedRequestCollections, remappedRequestFolders, requestUidRemap } =
    deepCopyRequestHierarchy(src.requests ?? [], src.requestCollections ?? [], src.requestFolders ?? []);

  // ── Template side: same treatment with the `templates/` prefix ───
  const { remappedTemplates, remappedTemplateCollections, remappedTemplateFolders } = deepCopyTemplateHierarchy(
    src.templates ?? [],
    src.templateCollections ?? [],
    src.templateFolders ?? [],
  );

  // ── Live Workflows + Live Variables: fresh uids + paths; step
  // `requestUid`s rebind through the request remap; LV `workflowUid`
  // rebinds through the workflow remap built inside the helper. Cache
  // is not copied — it's a per-install projection of past runs and
  // rehydrates cleanly on the new workspace's first refresh tick.
  const { remappedLiveWorkflows, remappedLiveVariables } = deepCopyLiveEntities(
    src.liveWorkflows ?? [],
    src.liveVariables ?? [],
    requestUidRemap,
  );

  // ── Environments + workspace vars + vault: fresh uids, same content
  const newEnvironments = (src.environments ?? []).map((e) => ({ ...e, uid: generateUid() }));

  // ── Pause markers: keyed by collection/folder path; reuse the
  // remap built by deepCopyRuleHierarchy. Markers on paths that no
  // longer resolve (defensive) are dropped.
  const remappedPauseMarkers: Record<string, string> = {};
  for (const [path, marker] of Object.entries(src.pauseMarkers ?? {})) {
    const newPath = containerPathRemap.get(path);
    if (newPath) remappedPauseMarkers[newPath] = marker;
  }

  // ── Write the new workspace's keys atomically ────────────────────
  const newK = wsKeys(newMeta.id);
  const writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]> = [
    [newK.rules, remappedRules],
    [newK.collections, remappedCollections],
    [newK.folders, remappedFolders],
    [newK.requests, remappedRequests],
    [newK.requestCollections, remappedRequestCollections],
    [newK.requestFolders, remappedRequestFolders],
    [newK.templates, remappedTemplates],
    [newK.templateCollections, remappedTemplateCollections],
    [newK.templateFolders, remappedTemplateFolders],
    [newK.pauseMarkers, remappedPauseMarkers],
    [newK.environments, newEnvironments],
    [newK.activeEnvironmentId, null],
    [newK.liveWorkflows, remappedLiveWorkflows],
    [newK.liveVariables, remappedLiveVariables],
    ...(src.workspaceVars ? [[newK.workspaceVars, src.workspaceVars] as const] : []),
    ...(src.vault ? [[newK.vault, src.vault] as const] : []),
  ];
  await extensionStorage.setMany(writes);
  const newId = newMeta.id;

  logger.info(
    'WorkspaceOrchestrator',
    `Duplicated ${sourceId} → ${newId}: ${remappedRules.length} rules, ${remappedRequests.length} requests, ${remappedTemplates.length} templates, ${newEnvironments.length} envs, ${remappedLiveWorkflows.length} live workflows, ${remappedLiveVariables.length} live variables`,
  );
  return newMeta;
}

// ── Delete ──────────────────────────────────────────────────────────

/**
 * Delete a workspace and all its per-workspace data keys. Also handles
 * active-pointer reassignment (the workspace-store picks a neighbour).
 * Returns the new active workspace id after deletion, or `null` if the
 * delete was rejected (min-1 invariant).
 */
export async function deleteWorkspaceWithData(id: string): Promise<string | null> {
  const wasActive = getActiveWorkspaceId() === id;
  const newActive = await deleteWorkspaceMeta(id);
  if (newActive === null) return null;

  // Remove every per-workspace storage key for the deleted workspace.
  // Env / vault / testRuns each own their delete path (encapsulation),
  // so we call those explicitly rather than listing the keys here.
  await extensionStorage.remove(perWorkspaceDataKeys(id));
  await purgeWorkspaceEnvironmentData(id);
  await purgeWorkspaceTestRuns(id);
  await purgeFilesForWorkspace(id);
  await purgeOAuthForWorkspace(id);
  await purgeLiveWorkflowsForWorkspace(id);
  await purgeLiveVariablesForWorkspace(id);
  await purgeLiveCacheForWorkspace(id);
  purgeWorkspaceCooldowns(id);

  // If we deleted the active workspace, swap the per-workspace stores
  // to the new active now — workspace-store already flipped the pointer
  // inside deleteWorkspace. The onWorkspaceStoreChange listener in
  // background.ts fires the `workspaceChanged` broadcast for us.
  if (wasActive && newActive) {
    await Promise.all([
      switchRulesToWorkspace(newActive),
      switchTemplatesToWorkspace(newActive),
      switchPauseMarkersToWorkspace(newActive),
      switchEnvToWorkspace(newActive),
      switchRequestsToWorkspace(newActive),
      switchLiveWorkflowsToWorkspace(newActive),
      switchLiveVariablesToWorkspace(newActive),
    ]);
    seedFromWorkspaceSwitch(getRules(), getPauseMarkers(), getRulesPaused());
    scheduleUpdate('workspace', { immediate: true });
  }

  logger.info('WorkspaceOrchestrator', `Deleted workspace ${id}, new active = ${newActive}`);
  return newActive;
}

// ── Deep-copy helpers ───────────────────────────────────────────────

interface RuleHierarchyCopy {
  remappedRules: V5.Rule[];
  remappedCollections: V5.Collection[];
  remappedFolders: LocalFolder[];
  /** Old path → new path for every collection + folder (NOT rules).
   *  Used by the outer caller to remap pause markers, which are keyed
   *  only by container paths. */
  containerPathRemap: Map<string, string>;
}

function deepCopyRuleHierarchy(
  rules: V5.Rule[],
  collections: V5.Collection[],
  folders: LocalFolder[],
): RuleHierarchyCopy {
  const result = deepCopyHierarchy<V5.Rule>({
    entities: rules,
    collections,
    folders,
    treePrefix: 'rules',
    finalizeEntity: (rule, ctx) => {
      const ruleWithIds = rule as V5.Rule & { collectionId?: string; folderId?: string };
      const remapContainerId = (oldId: string | undefined): string | undefined => {
        if (!oldId) return oldId;
        return ctx.collectionUidRemap.get(oldId) ?? ctx.folderUidRemap.get(oldId) ?? oldId;
      };
      return {
        ...rule,
        ...(ruleWithIds.collectionId && { collectionId: remapContainerId(ruleWithIds.collectionId) }),
        ...(ruleWithIds.folderId && { folderId: remapContainerId(ruleWithIds.folderId) }),
      } as V5.Rule;
    },
  });
  return {
    remappedRules: result.entities,
    remappedCollections: result.collections,
    remappedFolders: result.folders,
    containerPathRemap: result.pathRemap,
  };
}

interface TemplateHierarchyCopy {
  remappedTemplates: V5.Template[];
  remappedTemplateCollections: V5.Collection[];
  remappedTemplateFolders: LocalFolder[];
}

function deepCopyTemplateHierarchy(
  templates: V5.Template[],
  collections: V5.Collection[],
  folders: LocalFolder[],
): TemplateHierarchyCopy {
  const result = deepCopyHierarchy<V5.Template>({
    entities: templates,
    collections,
    folders,
    treePrefix: 'templates',
  });
  return {
    remappedTemplates: result.entities,
    remappedTemplateCollections: result.collections,
    remappedTemplateFolders: result.folders,
  };
}

interface RequestHierarchyCopy {
  remappedRequests: V5.Request[];
  remappedRequestCollections: V5.Collection[];
  remappedRequestFolders: LocalFolder[];
  /**
   * `sourceRequestUid → newRequestUid` mapping. Consumed by
   * downstream copies that carry Request pointers — Live Workflow
   * steps' `requestUid`, future devtools-capture links, etc. —
   * so those pointers rebind to the cloned requests instead of
   * dangling back at the source workspace.
   */
  requestUidRemap: Map<string, string>;
}

function deepCopyRequestHierarchy(
  requests: V5.Request[],
  collections: V5.Collection[],
  folders: LocalFolder[],
): RequestHierarchyCopy {
  const result = deepCopyHierarchy<V5.Request>({
    entities: requests,
    collections,
    folders,
    treePrefix: 'requests',
  });
  return {
    remappedRequests: result.entities,
    remappedRequestCollections: result.collections,
    remappedRequestFolders: result.folders,
    requestUidRemap: result.entityUidRemap,
  };
}

interface LiveEntitiesCopy {
  remappedLiveWorkflows: V5.LiveWorkflow[];
  remappedLiveVariables: V5.LiveVariable[];
}

/**
 * Clone live workflows + live-variable bindings with fresh uids and
 * paths. Rebinds each step's `requestUid` to the cloned request tree
 * via `requestUidRemap` so the new workspace's workflows don't point
 * back at the source workspace's requests. LV bindings follow the
 * workflow uid remap; step ids + capture names stay local to each
 * workflow and round-trip unchanged.
 *
 * Cache (`liveCache`) is deliberately NOT copied — it's an
 * ephemeral per-install projection of refresh runs that would be
 * wrong for the duplicated workspace's identity (different
 * workflow uids, different env ids, different extraction moment).
 * The duplicated workspace starts with a clean cache and warms up
 * on its first alarm fire.
 */
function deepCopyLiveEntities(
  workflows: V5.LiveWorkflow[],
  variables: V5.LiveVariable[],
  requestUidRemap: Map<string, string>,
): LiveEntitiesCopy {
  const workflowUidRemap = new Map<string, string>();

  const remappedLiveWorkflows: V5.LiveWorkflow[] = workflows.map((w) => {
    const uid = generateUid();
    workflowUidRemap.set(w.uid, uid);
    const path = `live-workflows/${toFolderName(w.name, uid)}`;
    const steps = w.steps.map((s) => ({
      ...s,
      // Rebind step requests to the cloned tree. A step whose
      // source request isn't in the remap (defensive — should not
      // happen in well-formed data) keeps its original pointer;
      // the resulting dangling reference surfaces as the usual
      // `step-request-missing` structural issue in the editor.
      requestUid: requestUidRemap.get(s.requestUid) ?? s.requestUid,
    }));
    return { ...w, uid, path, steps };
  });

  const remappedLiveVariables: V5.LiveVariable[] = variables.map((lv) => {
    const uid = generateUid();
    const path = `live-variables/${toFolderName(lv.name, uid)}`;
    return {
      ...lv,
      uid,
      path,
      // Rebind to the cloned workflow. A variable whose source
      // workflow isn't in the remap keeps its original pointer
      // (becomes an orphan the user must rebind) — identical to
      // how a git-pull-deleted workflow surfaces today.
      workflowUid: workflowUidRemap.get(lv.workflowUid) ?? lv.workflowUid,
    };
  });

  return { remappedLiveWorkflows, remappedLiveVariables };
}
