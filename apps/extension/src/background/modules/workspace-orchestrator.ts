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
import { logger } from '@utils/logger';
import { extensionStorage, type StorageKey, wsKeys } from '@/shared/storage';
import { getRulesPaused } from '../dnr-manager';
import {
  hydrateEnvironmentsFromStorage,
  purgeWorkspaceEnvironmentData,
  switchToWorkspace as switchEnvToWorkspace,
} from './environment-store';
import { purgeFilesForWorkspace } from './files-store';
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
 * vault / testRuns have their own purge paths (environment-store,
 * test-run-store) so they stay encapsulated and we don't list them here.
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
  ]);

  // One broad cache-invalidation baseline reset — the union of
  // outgoing + incoming effective origins. Cheaper than per-rule diffs
  // when workspace swaps can change dozens of rules at once.
  seedFromWorkspaceSwitch(getRules(), getPauseMarkers(), getRulesPaused());

  scheduleUpdate('workspace', { immediate: true });

  // Flip the active pointer last. workspace-store's listener in
  // background.ts broadcasts `workspaceChanged` automatically.
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
  });

  // ── Rules side: rebuild uid + path mapping ───────────────────────
  const { remappedRules, remappedCollections, remappedFolders, containerPathRemap } = deepCopyRuleHierarchy(
    src.rules ?? [],
    src.collections ?? [],
    src.folders ?? [],
  );

  // ── Requests side: parallel structure under `requests/`. Uses the
  // same deep-copy logic as rules, just a different on-disk prefix.
  const { remappedRequests, remappedRequestCollections, remappedRequestFolders } = deepCopyRequestHierarchy(
    src.requests ?? [],
    src.requestCollections ?? [],
    src.requestFolders ?? [],
  );

  // ── Template side: same treatment with the `templates/` prefix ───
  const { remappedTemplates, remappedTemplateCollections, remappedTemplateFolders } = deepCopyTemplateHierarchy(
    src.templates ?? [],
    src.templateCollections ?? [],
    src.templateFolders ?? [],
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
    ...(src.workspaceVars ? [[newK.workspaceVars, src.workspaceVars] as const] : []),
    ...(src.vault ? [[newK.vault, src.vault] as const] : []),
  ];
  await extensionStorage.setMany(writes);
  const newId = newMeta.id;

  logger.info(
    'WorkspaceOrchestrator',
    `Duplicated ${sourceId} → ${newId}: ${remappedRules.length} rules, ${remappedRequests.length} requests, ${remappedTemplates.length} templates, ${newEnvironments.length} envs`,
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
  const pathRemap = new Map<string, string>();

  const remappedCollections: V5.Collection[] = collections.map((c) => {
    const uid = generateUid();
    const path = `rules/${toFolderName(c.name, uid)}`;
    pathRemap.set(c.path, path);
    return { ...c, uid, path };
  });

  // Folders may nest — walk by path-depth so parents remap first. We
  // also need to return folders in the SAME order as the input so the
  // caller's persisted array has a stable layout.
  const folderByOldPath = new Map<string, LocalFolder>();
  const sortedFolders = [...folders].sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  for (const f of sortedFolders) {
    const uid = generateUid();
    const parentOldPath = f.path.substring(0, f.path.lastIndexOf('/'));
    const parentNewPath = pathRemap.get(parentOldPath) ?? parentOldPath;
    const path = `${parentNewPath}/${toFolderName(f.name, uid)}`;
    pathRemap.set(f.path, path);
    folderByOldPath.set(f.path, { ...f, uid, path });
  }
  const remappedFolders: LocalFolder[] = folders.map((f) => folderByOldPath.get(f.path) ?? f);

  const remappedRules: V5.Rule[] = rules.map((r) => {
    const uid = generateUid();
    const parentOldPath = r.path.substring(0, r.path.lastIndexOf('/'));
    const parentNewPath = pathRemap.get(parentOldPath) ?? parentOldPath;
    const path = `${parentNewPath}/${toFolderName(r.name, uid)}`;
    // Update collectionId / folderId references to the new uids.
    const remapContainerId = (oldId: string | undefined): string | undefined => {
      if (!oldId) return oldId;
      const coll = collections.find((c) => c.uid === oldId);
      if (coll) {
        const newColl = remappedCollections.find((rc) => rc.path === pathRemap.get(coll.path));
        return newColl?.uid ?? oldId;
      }
      const fold = folders.find((f) => f.uid === oldId);
      if (fold) {
        const newFold = remappedFolders.find((rf) => rf.path === pathRemap.get(fold.path));
        return newFold?.uid ?? oldId;
      }
      return oldId;
    };
    const ruleWithIds = r as V5.Rule & { collectionId?: string; folderId?: string };
    return {
      ...r,
      uid,
      path,
      ...(ruleWithIds.collectionId && { collectionId: remapContainerId(ruleWithIds.collectionId) }),
      ...(ruleWithIds.folderId && { folderId: remapContainerId(ruleWithIds.folderId) }),
    } as V5.Rule;
  });

  return { remappedRules, remappedCollections, remappedFolders, containerPathRemap: pathRemap };
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
  const pathRemap = new Map<string, string>();
  const folderByOldPath = new Map<string, LocalFolder>();

  const remappedTemplateCollections: V5.Collection[] = collections.map((c) => {
    const uid = generateUid();
    const path = `templates/${toFolderName(c.name, uid)}`;
    pathRemap.set(c.path, path);
    return { ...c, uid, path };
  });

  const sortedFolders = [...folders].sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  for (const f of sortedFolders) {
    const uid = generateUid();
    const parentOldPath = f.path.substring(0, f.path.lastIndexOf('/'));
    const parentNewPath = pathRemap.get(parentOldPath) ?? parentOldPath;
    const path = `${parentNewPath}/${toFolderName(f.name, uid)}`;
    pathRemap.set(f.path, path);
    folderByOldPath.set(f.path, { ...f, uid, path });
  }
  const remappedTemplateFolders: LocalFolder[] = folders.map((f) => folderByOldPath.get(f.path) ?? f);

  const remappedTemplates: V5.Template[] = templates.map((t) => {
    const uid = generateUid();
    const parentOldPath = t.path.substring(0, t.path.lastIndexOf('/'));
    const parentNewPath = pathRemap.get(parentOldPath) ?? parentOldPath;
    const path = `${parentNewPath}/${toFolderName(t.name, uid)}`;
    return { ...t, uid, path };
  });

  return { remappedTemplates, remappedTemplateCollections, remappedTemplateFolders };
}

interface RequestHierarchyCopy {
  remappedRequests: V5.Request[];
  remappedRequestCollections: V5.Collection[];
  remappedRequestFolders: LocalFolder[];
}

function deepCopyRequestHierarchy(
  requests: V5.Request[],
  collections: V5.Collection[],
  folders: LocalFolder[],
): RequestHierarchyCopy {
  const pathRemap = new Map<string, string>();
  const folderByOldPath = new Map<string, LocalFolder>();

  const remappedRequestCollections: V5.Collection[] = collections.map((c) => {
    const uid = generateUid();
    const path = `requests/${toFolderName(c.name, uid)}`;
    pathRemap.set(c.path, path);
    return { ...c, uid, path };
  });

  const sortedFolders = [...folders].sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  for (const f of sortedFolders) {
    const uid = generateUid();
    const parentOldPath = f.path.substring(0, f.path.lastIndexOf('/'));
    const parentNewPath = pathRemap.get(parentOldPath) ?? parentOldPath;
    const path = `${parentNewPath}/${toFolderName(f.name, uid)}`;
    pathRemap.set(f.path, path);
    folderByOldPath.set(f.path, { ...f, uid, path });
  }
  const remappedRequestFolders: LocalFolder[] = folders.map((f) => folderByOldPath.get(f.path) ?? f);

  const remappedRequests: V5.Request[] = requests.map((r) => {
    const uid = generateUid();
    const parentOldPath = r.path.substring(0, r.path.lastIndexOf('/'));
    const parentNewPath = pathRemap.get(parentOldPath) ?? parentOldPath;
    const path = `${parentNewPath}/${toFolderName(r.name, uid)}`;
    return { ...r, uid, path };
  });

  return { remappedRequests, remappedRequestCollections, remappedRequestFolders };
}
