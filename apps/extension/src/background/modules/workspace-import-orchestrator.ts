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
import { hydrateEnvironmentsFromStorage } from './environment-store';
import { recordImportReport } from './import-reports-store';
import { hydrateFromStorage as hydrateLiveVariablesFromStorage } from './live-variable-store';
import { hydrateFromStorage as hydrateLiveWorkflowsFromStorage } from './live-workflow-store';
import { recordLog } from './observability-log';
import { hydrateFromStorage as hydrateRequestsFromStorage } from './request-store';
import { scheduleUpdate } from './rule-engine';
import { hydrateFromStorage as hydrateRulesFromStorage } from './rule-store';
import { hydrateTemplatesFromStorage } from './template-store';
import {
  createWorkspace as createWorkspaceMeta,
  getActiveWorkspaceId,
  getWorkspace,
  listWorkspaces,
} from './workspace-store';

// ── Public API ─────────────────────────────────────────────────────

export type ImportTargetSelector = { mode: 'current' } | { mode: 'new' } | { mode: 'picked'; workspaceId: string };

export interface ImportWorkspaceArgs {
  incoming: WorkspaceExport;
  /** User's per-entity strategy choices from the preview modal. */
  strategies: StrategyMap;
  /** Backup-restore toggle (flips collision-uid defaults to `update`). */
  backupRestore?: boolean;
  /** When `true`, preserves source `enabled` flags (Advanced override). */
  trustExport?: boolean;
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

      // ── Build plan from a fresh diff under the lock ──────────────
      // Re-running the diff on submit (rather than trusting an upstream
      // snapshot) handles the concurrent-edit-during-preview case
      // (design §9 — "data changed since you opened this preview").
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

      let diff = diffWorkspaceExport(args.incoming, targetState);
      if (args.backupRestore) diff = applyBackupRestoreToggle(diff);

      const importerOpts: ImporterOptions = { trustExport: args.trustExport ?? false };
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
        version: target.workspaceVars?.version ?? 1,
        variables: plan.workspaceVars.variables,
      };
      const nextVault: V5.Vault | undefined =
        plan.vault.action === 'skip' && (target.vault?.secrets ?? []).length === 0
          ? undefined
          : {
              schemaVersion: 5,
              version: target.vault?.version ?? 1,
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
        scheduleUpdate('import', { immediate: true });
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
  const desiredName = collidingName(args.incoming.workspace.name);
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
