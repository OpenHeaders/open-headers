/**
 * Workspace-export import orchestrator.
 *
 * Drives `chrome.storage` writes for an `ImportPlan` produced by
 * `@openheaders/core/workspace-export`. Sibling to
 * `workspace-orchestrator.ts` (kept separate for SoC — duplicate / switch
 * / delete are workspace-lifecycle concerns; import is data-merge).
 *
 * Contract (design §5.3):
 *   • Top-level `withLock(workspace-import singleton)` per target id —
 *     concurrent imports into different workspaces run in parallel,
 *     same-target imports serialize.
 *   • Read target storage; merge plan entries (create / update / skip);
 *     write back via `setMany`.
 *   • Tree-aware demux for the flattened collection / folder arrays —
 *     the export envelope flattens `rules/*` + `requests/*` +
 *     `templates/*` trees into single arrays; we split by `path`
 *     prefix back into the three storage keys.
 *   • Workspace metadata behavior (§2.4): target=new uses export's
 *     metadata + " (imported)" suffix on collision; target=existing
 *     ignores export's metadata, doesn't copy `defaultEnvironmentId`
 *     (the post-import toast offers it).
 *   • After all writes, fire `scheduleUpdate('import', { immediate:
 *     true })` so the DNR ruleset rebuilds.
 *   • Persist a `WorkspaceExportImportReport` into the per-workspace
 *     `importReports` ring.
 *
 * Out of scope (lands in PR 5):
 *   • OAuth `configs` import (sidecar omit-toggle)
 *   • Strip-scripts toggle
 *   • Capability-gate prompts
 */

import {
  createWorkspaceExportReport,
  type ImportTargetMode,
  type MissingDep,
  type PerEntityStrategies,
  type WorkspaceExportImportReport,
} from '@openheaders/core/import';
import type { V5 } from '@openheaders/core/types';
import {
  applyBackupRestoreToggle,
  buildImportPlan,
  diffWorkspaceExport,
  type ImporterOptions,
  type ImportPlan,
  type PlanEntry,
  type StrategyMap,
  type TargetWorkspaceState,
  type WorkspaceExport,
  walkMissingDeps,
} from '@openheaders/core/workspace-export';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, type PersistedLocalFolder, type StorageKey, wsKeys } from '@/shared/storage';
import {
  bridgeEnvironmentSyncEngine,
  bridgeVaultSyncEngine,
  bridgeWorkspaceVariablesSyncEngine,
  hydrateEnvironmentsFromStorage,
} from './environment-store';
import { recordImportReport } from './import-reports-store';
import {
  bridgeLiveVariableSyncEngine,
  hydrateFromStorage as hydrateLiveVariablesFromStorage,
} from './live-variable-store';
import {
  bridgeLiveWorkflowSyncEngine,
  hydrateFromStorage as hydrateLiveWorkflowsFromStorage,
} from './live-workflow-store';
import { recordLog } from './observability-log';
import { bridgeFilesSyncEngine } from './files-store';
import { bridgeOAuthSyncEngine } from './oauth-token-store';
import { bridgeLayoutStateSyncEngine } from './layout-store';
import { bridgePauseMarkersSyncEngine } from './pause-markers-store';
import { markPendingScriptsReview, markPendingScriptsReviewForWorkspace } from './request-scripts-review-store';
import {
  bridgeRequestCollectionSyncEngine,
  bridgeRequestFolderSyncEngine,
  bridgeRequestSyncEngine,
  hydrateFromStorage as hydrateRequestsFromStorage,
} from './request-store';
import { scheduleUpdate } from './rule-engine';
import { reinitForWorkspace } from '../sync/service';
import {
  bridgeCollectionSyncEngine,
  bridgeFolderSyncEngine,
  bridgeToSyncEngine,
  hydrateFromStorage as hydrateRulesFromStorage,
} from './rule-store';
import {
  bridgeTemplateCollectionSyncEngine,
  bridgeTemplateFolderSyncEngine,
  bridgeTemplateSyncEngine,
  hydrateTemplatesFromStorage,
} from './template-store';
import {
  createWorkspace as createWorkspaceMeta,
  getActiveWorkspaceId,
  getWorkspace,
  listWorkspaces,
} from './workspace-store';

// ── Public API ─────────────────────────────────────────────────────

export type ImportTargetSelector =
  | { mode: 'current' }
  | {
      mode: 'new';
      /** User-overridden workspace name from the import-preview's
       *  editable input on `mode='new'`. Falls back to the export's
       *  `workspace.name` when omitted. Collision suffix is applied on
       *  top of whichever name we end up with. */
      name?: string;
    }
  | { mode: 'picked'; workspaceId: string };

export interface ImportWorkspaceArgs {
  incoming: WorkspaceExport;
  /** User's per-entity strategy choices from the preview modal. */
  strategies: StrategyMap;
  /** Backup-restore toggle (flips collision-uid defaults to `update`). */
  backupRestore?: boolean;
  /** When `true`, preserves source `enabled` flags (Advanced override). */
  trustExport?: boolean;
  /** When `true`, strips `preRequestScript` / `postResponseScript` from
   *  every imported request (Advanced override; default-on for low-trust
   *  sources per design §5.5). */
  stripScripts?: boolean;
  /** When `true`, replaces every imported oauth2 `Request.auth` with
   *  `{ type: 'none' }` so the recipient configures auth from scratch
   *  (Advanced override per design §5.5). */
  omitOAuthConfigs?: boolean;
  /** When `true`, `update` collisions on collections preserve the
   *  target's `order` instead of taking export's (Advanced override
   *  per design §5.5). */
  keepTargetCollectionOrder?: boolean;
  /** When `true` and target=new, refuse to create when an existing
   *  workspace already carries the export's `workspace.uid`. The user
   *  must switch to "Pick existing" to merge into it (Advanced override
   *  per design §5.5). Default behavior silently regenerates the uid. */
  refuseUidCollision?: boolean;
  target: ImportTargetSelector;
  /** SHA-256 of the original raw export bytes (`sha256:<hex>`). */
  sourceHash: string;
}

export interface ImportWorkspaceResult {
  /** The ImportReport persisted into the target workspace's ring. */
  report: WorkspaceExportImportReport;
  /** Final target workspaceId (newly-created on `mode: 'new'`). */
  targetWorkspaceId: string;
}

/**
 * Conservative chrome.storage quota signal (5 MB on `local`; we apply a
 * 10% headroom). Real chrome.storage.local.QUOTA_BYTES is per-area
 * 5_242_880 absent `unlimitedStorage`. Pre-check is best-effort — see
 * design §5.3 step 2 (UX improvement, not a guarantee).
 */
const QUOTA_HEADROOM_BYTES = 5 * 1024 * 1024 - 512 * 1024;

// ── Plan application ──────────────────────────────────────────────

function applyPlanArray<T extends { uid: string }>(target: T[], plan: PlanEntry<T>[]): T[] {
  const byUid = new Map<string, T>(target.map((e) => [e.uid, e] as const));
  for (const entry of plan) {
    if (entry.action === 'skip') continue;
    if (entry.action === 'update' && entry.targetUid) {
      // Replace existing target entry (same uid retained)
      byUid.set(entry.targetUid, entry.entity);
      continue;
    }
    // create
    byUid.set(entry.entity.uid, entry.entity);
  }
  return Array.from(byUid.values());
}

// ── Quota pre-check ──────────────────────────────────────────────

function estimatePlanBytes(plan: ImportPlan): number {
  // Best-effort — JSON-stringify the entities marked create/update.
  const buckets: unknown[] = [
    plan.collections,
    plan.folders,
    plan.rules,
    plan.requests,
    plan.templates,
    plan.environments,
    plan.liveWorkflows,
    plan.liveVariables,
    plan.workspaceVars.variables,
    plan.vault.secrets,
  ];
  let total = 0;
  for (const b of buckets) {
    try {
      total += JSON.stringify(b).length;
    } catch {
      // Cyclic / non-JSON-safe — skip.
    }
  }
  return total;
}

// ── Main entry ────────────────────────────────────────────────────

export async function importWorkspace(args: ImportWorkspaceArgs): Promise<ImportWorkspaceResult> {
  const targetWorkspaceId = await resolveTargetWorkspace(args);
  const targetMode: ImportTargetMode = args.target.mode === 'current' ? 'current' : args.target.mode;

  const sourceWorkspaceLabel = args.incoming.source.workspaceLabel ?? args.incoming.workspace.name;
  const sourceAppVersion = args.incoming.source.appVersion;
  const exportId = args.incoming.exportId;

  return await withLock(
    entityLockName(targetWorkspaceId, 'workspace-import', 'singleton'),
    async () => {
      const k = wsKeys(targetWorkspaceId);
      const { target, targetState } = await readTargetWorkspaceState(targetWorkspaceId);

      // ── Build plan from a fresh diff under the lock ──────────────
      // Re-running the diff on submit (rather than trusting an upstream
      // snapshot) handles the concurrent-edit-during-preview case
      // (design §9 — "data changed since you opened this preview").
      let diff = diffWorkspaceExport(args.incoming, targetState);
      if (args.backupRestore) diff = applyBackupRestoreToggle(diff);

      const importerOpts: ImporterOptions = {
        trustExport: args.trustExport ?? false,
        stripScripts: args.stripScripts ?? false,
        omitOAuthConfigs: args.omitOAuthConfigs ?? false,
        keepTargetCollectionOrder: args.keepTargetCollectionOrder ?? false,
      };
      const plan = buildImportPlan(args.incoming, diff, targetState, args.strategies, importerOpts);

      const missingDeps: MissingDep[] = walkMissingDeps(args.incoming, targetState);
      const perEntityStrategies = capturePerEntityStrategies(plan);

      const report = createWorkspaceExportReport({
        exportId,
        targetMode,
        sourceWorkspaceLabel,
        sourceAppVersion,
        perEntityStrategies,
        missingDeps,
      });
      report.sourceHash = args.sourceHash;

      // Quota pre-check (best-effort).
      const estBytes = estimatePlanBytes(plan);
      if (estBytes > QUOTA_HEADROOM_BYTES) {
        logger.warn(
          'WorkspaceImportOrchestrator',
          `Import estimated at ${estBytes} bytes — exceeds best-effort quota headroom`,
        );
        // Still attempt; per-entity QUOTA_BYTES errors land in the
        // report. Pre-check is a UX improvement, not a guarantee.
      }

      // Demux flattened collection / folder arrays back into the three
      // per-tree storage keys via the path prefix.
      const collectionsRulesPlan = plan.collections.filter((e) => isInTree(e.entity.path, 'rules'));
      const collectionsRequestsPlan = plan.collections.filter((e) => isInTree(e.entity.path, 'requests'));
      const collectionsTemplatesPlan = plan.collections.filter((e) => isInTree(e.entity.path, 'templates'));
      const foldersRulesPlan = plan.folders.filter((e) => isInTree(e.entity.path, 'rules'));
      const foldersRequestsPlan = plan.folders.filter((e) => isInTree(e.entity.path, 'requests'));
      const foldersTemplatesPlan = plan.folders.filter((e) => isInTree(e.entity.path, 'templates'));

      // Reconcile arrays: merge target + plan create/update/skip.
      const nextRules = applyPlanArray(target.rules ?? [], plan.rules);
      const nextRequests = applyPlanArray(target.requests ?? [], plan.requests);
      const nextTemplates = applyPlanArray(target.templates ?? [], plan.templates);
      const nextEnvironments = applyPlanArray(target.environments ?? [], plan.environments);
      const nextLiveWorkflows = applyPlanArray(target.liveWorkflows ?? [], plan.liveWorkflows);
      const nextLiveVariables = applyPlanArray(target.liveVariables ?? [], plan.liveVariables);

      const nextRuleCollections = applyPlanArray(target.collections ?? [], collectionsRulesPlan);
      const nextRequestCollections = applyPlanArray(target.requestCollections ?? [], collectionsRequestsPlan);
      const nextTemplateCollections = applyPlanArray(target.templateCollections ?? [], collectionsTemplatesPlan);
      const nextRuleFolders = applyPlanArray<PersistedLocalFolder>(
        target.folders ?? [],
        foldersRulesPlan as PlanEntry<PersistedLocalFolder>[],
      );
      const nextRequestFolders = applyPlanArray<PersistedLocalFolder>(
        target.requestFolders ?? [],
        foldersRequestsPlan as PlanEntry<PersistedLocalFolder>[],
      );
      const nextTemplateFolders = applyPlanArray<PersistedLocalFolder>(
        target.templateFolders ?? [],
        foldersTemplatesPlan as PlanEntry<PersistedLocalFolder>[],
      );

      // Singletons.
      const nextWorkspaceVars: V5.WorkspaceVariables = {
        schemaVersion: 5,
        variables: plan.workspaceVars.variables,
      };
      const nextVault: V5.Vault | undefined =
        plan.vault.action === 'skip' && (target.vault?.secrets ?? []).length === 0
          ? undefined
          : {
              schemaVersion: 5,
              secrets: plan.vault.secrets,
            };

      // Atomic-per-area write.
      const writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]> = [
        [k.rules, nextRules],
        [k.collections, nextRuleCollections],
        [k.folders, nextRuleFolders],
        [k.requests, nextRequests],
        [k.requestCollections, nextRequestCollections],
        [k.requestFolders, nextRequestFolders],
        [k.templates, nextTemplates],
        [k.templateCollections, nextTemplateCollections],
        [k.templateFolders, nextTemplateFolders],
        [k.environments, nextEnvironments],
        [k.workspaceVars, nextWorkspaceVars],
        [k.liveWorkflows, nextLiveWorkflows],
        [k.liveVariables, nextLiveVariables],
        ...(nextVault ? [[k.vault, nextVault] as const] : []),
      ];

      try {
        await extensionStorage.setMany(writes);
      } catch (err) {
        logger.error('WorkspaceImportOrchestrator', 'storage write failed', err);
        throw err;
      }

      // Bump summary counts on the report from the executed plan.
      const importedCount =
        plan.rules.filter((e) => e.action !== 'skip').length +
        plan.requests.filter((e) => e.action !== 'skip').length +
        plan.templates.filter((e) => e.action !== 'skip').length +
        plan.environments.filter((e) => e.action !== 'skip').length +
        plan.liveWorkflows.filter((e) => e.action !== 'skip').length +
        plan.liveVariables.filter((e) => e.action !== 'skip').length +
        plan.collections.filter((e) => e.action !== 'skip').length +
        plan.folders.filter((e) => e.action !== 'skip').length;
      report.summary = { ...report.summary, imported: importedCount };

      // Collect imported requests carrying scripts so the sidebar can
      // surface a "scripts" badge until the recipient opens each one in
      // the inspector. Skipped entries are excluded; if `stripScripts`
      // was on, the `stamp` already removed the script fields, so the
      // post-strip check naturally yields an empty set.
      const scriptsPendingUids: string[] = [];
      for (const entry of plan.requests) {
        if (entry.action === 'skip') continue;
        const r = entry.entity as V5.Request;
        if (
          (r.preRequestScript && r.preRequestScript.length > 0) ||
          (r.postResponseScript && r.postResponseScript.length > 0)
        ) {
          scriptsPendingUids.push(r.uid);
        }
      }

      // If the target is the active workspace, reload in-memory state so
      // the UI sees the newly-imported entities and DNR rebuild reads
      // the fresh rule list.
      const isActive = getActiveWorkspaceId() === targetWorkspaceId;
      if (isActive) {
        await Promise.all([
          hydrateRulesFromStorage(),
          hydrateRequestsFromStorage(),
          hydrateTemplatesFromStorage(),
          hydrateEnvironmentsFromStorage(),
          hydrateLiveWorkflowsFromStorage(),
          hydrateLiveVariablesFromStorage(),
        ]);
        // Flush the active oracle's in-memory state before reseeding so
        // the per-rule seedRule batches emitted by bridgeToSyncEngine
        // populate a clean entity store. Without the reinit, addToSet
        // bodies for set-modeled paths (conditions, headerMods) would
        // append to the pre-import items rather than replace them, and
        // duplicate set members would survive every active-workspace
        // import.
        reinitForWorkspace(targetWorkspaceId);
        await bridgeToSyncEngine();
        await bridgeEnvironmentSyncEngine();
        await bridgeCollectionSyncEngine();
        await bridgeFolderSyncEngine();
        await bridgeWorkspaceVariablesSyncEngine();
        await bridgeVaultSyncEngine();
        await bridgeRequestSyncEngine();
        await bridgeRequestCollectionSyncEngine();
        await bridgeRequestFolderSyncEngine();
        await bridgeTemplateCollectionSyncEngine();
        await bridgeTemplateFolderSyncEngine();
        await bridgeTemplateSyncEngine();
        await bridgeLiveWorkflowSyncEngine();
        await bridgeLiveVariableSyncEngine();
        await bridgeOAuthSyncEngine();
        await bridgePauseMarkersSyncEngine();
        await bridgeLayoutStateSyncEngine();
        await bridgeFilesSyncEngine();
        scheduleUpdate('import', { immediate: true });
        if (scriptsPendingUids.length > 0) {
          await markPendingScriptsReview(scriptsPendingUids);
        }
      } else if (scriptsPendingUids.length > 0) {
        await markPendingScriptsReviewForWorkspace(targetWorkspaceId, scriptsPendingUids);
      }
      // Non-active target: in-memory snapshots stay untouched. The
      // user's eventual `switchToWorkspace` call hydrates from
      // chrome.storage at that point.

      // Persist the report into the target's ring. The store keys off
      // the active workspace by design — when target != active, write
      // directly to the target ring without bouncing through the active
      // ring.
      if (isActive) {
        await recordImportReport(report);
      } else {
        // Direct ring write for non-active target — mirrors what
        // `recordImportReport` does, scoped to the target's key.
        const ringKey = wsKeys(targetWorkspaceId).importReports;
        const current = ((await extensionStorage.get(ringKey)) as unknown[] | undefined) ?? [];
        const next = [...current, report];
        // Cap at the same default the store uses (50). Inline the cap
        // rather than re-export it from the store; the value is part of
        // the storage contract, not the store's API.
        const capped = next.length > 50 ? next.slice(next.length - 50) : next;
        await extensionStorage.set(ringKey, capped);
      }

      recordLog({
        subsystem: 'workspace',
        op: 'import',
        level: 'info',
        message: `Imported workspace-export ${exportId} from "${sourceWorkspaceLabel}" into ${targetWorkspaceId} (${importedCount} entities)`,
        context: { workspaceId: targetWorkspaceId },
      });

      return { report, targetWorkspaceId };
    },
    { op: 'workspace-import' },
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function capturePerEntityStrategies(plan: ImportPlan): PerEntityStrategies {
  const out: PerEntityStrategies = {};
  const rec = (type: string, entries: PlanEntry<{ uid: string }>[]) => {
    for (const e of entries) {
      if (e.action === 'skip') out[`${type}:${e.entity.uid}`] = 'skip';
      else if (e.action === 'update') out[`${type}:${e.entity.uid}`] = 'update';
      else out[`${type}:${e.entity.uid}`] = 'new-uid';
    }
  };
  rec('collections', plan.collections);
  rec('folders', plan.folders);
  rec('rules', plan.rules);
  rec('requests', plan.requests);
  rec('templates', plan.templates);
  rec('environments', plan.environments);
  rec('liveWorkflows', plan.liveWorkflows);
  rec('liveVariables', plan.liveVariables);
  return out;
}

function isInTree(path: string, tree: 'rules' | 'requests' | 'templates'): boolean {
  if (tree === 'requests') return path.startsWith('requests/');
  if (tree === 'templates') return path.startsWith('templates/');
  // rules tree is the catch-all (legacy paths without prefix also count).
  return !path.startsWith('requests/') && !path.startsWith('templates/');
}

async function resolveTargetWorkspace(args: ImportWorkspaceArgs): Promise<string> {
  if (args.target.mode === 'current') return getActiveWorkspaceId();
  if (args.target.mode === 'picked') {
    const ws = getWorkspace(args.target.workspaceId);
    if (!ws) throw new Error(`Picked workspace ${args.target.workspaceId} not found`);
    return ws.id;
  }
  // mode: 'new' — create a fresh workspace using export's metadata.
  // Append " (imported)" suffix on name collision (design §2.4).
  // Advanced override (design §5.5): refuseUidCollision blocks the
  // create when an existing workspace carries the export's
  // `workspace.uid`. The default behavior is silent uid regen via
  // `createWorkspace` (the new workspace gets a fresh uid regardless).
  if (args.refuseUidCollision) {
    const incomingUid = args.incoming.workspace.uid;
    const collision = listWorkspaces().find((w) => w.id === incomingUid);
    if (collision) {
      throw new Error(
        `A workspace with uid ${incomingUid} already exists ("${collision.name}"). Switch the import target to "Pick existing" to merge into it, or turn off "Refuse on workspace.uid collision" in Advanced.`,
      );
    }
  }
  // User-overridden name from the modal (mode='new') wins; otherwise
  // fall back to the export's own workspace name.
  const baseName =
    args.target.mode === 'new' && args.target.name && args.target.name.trim().length > 0
      ? args.target.name.trim()
      : args.incoming.workspace.name;
  const desiredName = collidingName(baseName);
  const meta = await createWorkspaceMeta({
    name: desiredName,
    description: args.incoming.workspace.description,
    color: args.incoming.workspace.color,
    icon: args.incoming.workspace.icon,
    kind: 'personal', // forced (design §5.5)
  });
  return meta.id;
}

function collidingName(desired: string): string {
  const existing = new Set(listWorkspaces().map((w) => w.name));
  if (!existing.has(desired)) return desired;
  return `${desired} (imported)`;
}

// ── Read target storage → TargetWorkspaceState ─────────────────────

/**
 * Per-storage-key buckets returned alongside the flattened
 * `TargetWorkspaceState`. The orchestrator needs both — the flat
 * `targetState` drives the diff; the per-bucket `target` rebuilds
 * the three trees on write.
 */
interface ReadTargetResult {
  target: {
    rules?: V5.Rule[];
    collections?: V5.Collection[];
    folders?: PersistedLocalFolder[];
    requests?: V5.Request[];
    requestCollections?: V5.Collection[];
    requestFolders?: PersistedLocalFolder[];
    templates?: V5.Template[];
    templateCollections?: V5.Collection[];
    templateFolders?: PersistedLocalFolder[];
    environments?: V5.Environment[];
    workspaceVars?: V5.WorkspaceVariables;
    vault?: V5.Vault;
    liveWorkflows?: V5.LiveWorkflow[];
    liveVariables?: V5.LiveVariable[];
  };
  targetState: TargetWorkspaceState;
}

/** Read target workspace storage and flatten it into a `TargetWorkspaceState`.
 *  Lock-free — callers acquire the workspace-import lock when they need
 *  read-modify-write consistency. */
export async function readTargetWorkspaceState(workspaceId: string): Promise<ReadTargetResult> {
  const k = wsKeys(workspaceId);
  const target = await extensionStorage.getMany({
    rules: k.rules,
    collections: k.collections,
    folders: k.folders,
    requests: k.requests,
    requestCollections: k.requestCollections,
    requestFolders: k.requestFolders,
    templates: k.templates,
    templateCollections: k.templateCollections,
    templateFolders: k.templateFolders,
    environments: k.environments,
    workspaceVars: k.workspaceVars,
    vault: k.vault,
    liveWorkflows: k.liveWorkflows,
    liveVariables: k.liveVariables,
  });
  const targetState: TargetWorkspaceState = {
    collections: [
      ...((target.collections ?? []) as V5.Collection[]),
      ...((target.requestCollections ?? []) as V5.Collection[]),
      ...((target.templateCollections ?? []) as V5.Collection[]),
    ],
    folders: [
      ...((target.folders ?? []) as V5.Folder[]),
      ...((target.requestFolders ?? []) as V5.Folder[]),
      ...((target.templateFolders ?? []) as V5.Folder[]),
    ],
    rules: target.rules ?? [],
    requests: target.requests ?? [],
    templates: target.templates ?? [],
    environments: target.environments ?? [],
    liveWorkflows: target.liveWorkflows ?? [],
    liveVariables: target.liveVariables ?? [],
    ...(target.workspaceVars ? { workspaceVars: target.workspaceVars } : {}),
    ...(target.vault ? { vault: target.vault } : {}),
  };
  return { target, targetState };
}

// ── Preview RPC ───────────────────────────────────────────────────

export interface PreviewWorkspaceImportArgs {
  incoming: WorkspaceExport;
  /** target=new returns an empty target — every entity is "new". */
  target: ImportTargetSelector;
  /** Backup-restore toggle preview state. */
  backupRestore?: boolean;
}

export interface PreviewWorkspaceImportResult {
  diff: ReturnType<typeof diffWorkspaceExport>;
  missingDeps: MissingDep[];
  /** Stable hash of the diff structure — renderer compares preview-time
   *  vs submit-time diffs to detect concurrent edits during preview. */
  snapshotHash: string;
  /** Resolved target descriptor (for target=new this is null — modal
   *  uses incoming.workspace metadata directly). */
  targetWorkspaceId: string | null;
}

/**
 * Preview-time analog of `importWorkspace`. Reads (no writes) the chosen
 * target workspace and runs `diffWorkspaceExport` + `walkMissingDeps` so
 * the preview modal can render collision badges, the missing-deps
 * section, and a fresh snapshot hash for concurrent-edit detection.
 *
 * No lock — preview is an estimate. The submit path runs a fresh diff
 * inside the workspace-import lock and is the authoritative state.
 */
export async function previewWorkspaceImport(args: PreviewWorkspaceImportArgs): Promise<PreviewWorkspaceImportResult> {
  let targetState: TargetWorkspaceState;
  let targetWorkspaceId: string | null;
  if (args.target.mode === 'new') {
    targetWorkspaceId = null;
    targetState = emptyTargetState();
  } else {
    const wsId = args.target.mode === 'current' ? getActiveWorkspaceId() : args.target.workspaceId;
    if (args.target.mode === 'picked' && !getWorkspace(args.target.workspaceId)) {
      throw new Error(`Picked workspace ${args.target.workspaceId} not found`);
    }
    targetWorkspaceId = wsId;
    const read = await readTargetWorkspaceState(wsId);
    targetState = read.targetState;
  }

  let diff = diffWorkspaceExport(args.incoming, targetState);
  if (args.backupRestore) diff = applyBackupRestoreToggle(diff);
  const missingDeps = walkMissingDeps(args.incoming, targetState);
  const snapshotHash = await hashDiffSnapshot(diff);
  return { diff, missingDeps, snapshotHash, targetWorkspaceId };
}

function emptyTargetState(): TargetWorkspaceState {
  return {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    liveWorkflows: [],
    liveVariables: [],
  };
}

/**
 * Stable hash of the diff's identity-bearing fields (uids + collision
 * states). Used by the renderer to detect that the target workspace's
 * state changed between preview and submit. Not a security primitive —
 * just a change-detection signal.
 */
async function hashDiffSnapshot(diff: ReturnType<typeof diffWorkspaceExport>): Promise<string> {
  const stable = {
    collections: diff.collections.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    folders: diff.folders.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    rules: diff.rules.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    requests: diff.requests.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    templates: diff.templates.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    environments: diff.environments.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    liveWorkflows: diff.liveWorkflows.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    liveVariables: diff.liveVariables.map((e) => [e.entity.uid, e.state, e.matchedTarget?.uid ?? null]),
    workspaceVars: [diff.workspaceVars.state, diff.workspaceVars.targetHasContent],
    vault: [diff.vault.state, diff.vault.targetHasContent],
  };
  const bytes = new TextEncoder().encode(JSON.stringify(stable));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
