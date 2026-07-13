/**
 * Import entry point — the locked read → diff → plan → apply sequence,
 * report persistence, and observability (design §5.3).
 *
 * Plan application has two paths. When the target workspace has a
 * resident sync service, the plan emits as ordinary LOCAL mutation
 * batches ({@link emitPlanAsLocalMutations}) — persistence, cache
 * projection, and upstream propagation all follow from the normal
 * apply pipeline. Otherwise the plan lands as a wholesale storage
 * write, followed (for the active workspace) by rehydration + a full
 * sync-engine reseed.
 *
 * Host side-effects (DNR rebuild, observability ring) reach the host
 * through the null-safe {@link getOracleHostHooks} port — hosts without
 * a request-modifying runtime simply leave those hooks unset.
 */

import {
  createWorkspaceExportReport,
  type ImportTargetMode,
  type MissingDep,
  type PerEntityStrategies,
} from '@openheaders/core/import';
import type { Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import {
  applyBackupRestoreToggle,
  buildImportPlan,
  diffWorkspaceExport,
  type ImporterOptions,
  type ImportPlan,
  type PlanEntry,
  walkMissingDeps,
} from '@openheaders/core/workspace-export';
import { entityLockName, withLock } from '@openheaders/oracle/coordination';
import {
  bridgeEnvironmentSyncEngine,
  bridgeVaultSyncEngine,
  bridgeWorkspaceVariablesSyncEngine,
  hydrateEnvironmentsFromStorage,
} from '@openheaders/oracle/entity/environment-store';
import { bridgeFilesSyncEngine } from '@openheaders/oracle/entity/files-store';
import { recordImportReport } from '@openheaders/oracle/entity/import-reports-store';
import { bridgeOAuthSyncEngine } from '@openheaders/oracle/entity/oauth-token-store';
import { bridgePauseMarkersSyncEngine } from '@openheaders/oracle/entity/pause-markers-store';
import {
  markPendingScriptsReview,
  markPendingScriptsReviewForWorkspace,
} from '@openheaders/oracle/entity/request-scripts-review-store';
import {
  bridgeRequestCollectionSyncEngine,
  bridgeRequestFolderSyncEngine,
  bridgeRequestSyncEngine,
  hydrateFromStorage as hydrateRequestsFromStorage,
} from '@openheaders/oracle/entity/request-store';
import {
  bridgeCollectionSyncEngine,
  bridgeFolderSyncEngine,
  bridgeToSyncEngine,
  hydrateFromStorage as hydrateRulesFromStorage,
} from '@openheaders/oracle/entity/rule-store';
import {
  bridgeTemplateCollectionSyncEngine,
  bridgeTemplateFolderSyncEngine,
  bridgeTemplateSyncEngine,
  hydrateTemplatesFromStorage,
} from '@openheaders/oracle/entity/template-store';
import {
  bridgeLiveVariableSyncEngine,
  hydrateFromStorage as hydrateLiveVariablesFromStorage,
} from '@openheaders/oracle/live/live-variable-store';
import {
  bridgeLiveWorkflowSyncEngine,
  hydrateFromStorage as hydrateLiveWorkflowsFromStorage,
} from '@openheaders/oracle/live/live-workflow-store';
import { hostStorage, type PersistedLocalFolder, type StorageKey, wsKeys } from '@openheaders/oracle/storage';
import { getOracleHostHooks } from '@openheaders/oracle/sync';
import { reinitForWorkspace } from '@openheaders/oracle/sync/service';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { bridgeLayoutStateSyncEngine } from '@openheaders/oracle/workspace/layout-store';
import { emitPlanAsLocalMutations } from './emit';
import { applyPlanArray, estimatePlanBytes, isInTree, QUOTA_HEADROOM_BYTES } from './plan-helpers';
import { buildLastImportedSnapshots } from './snapshots';
import { readTargetWorkspaceState, resolveTargetWorkspace } from './target';
import type { ImportWorkspaceArgs, ImportWorkspaceResult } from './types';

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

      // Local-mutation emission through the target's resident sync
      // service: plan entries apply as ordinary LOCAL batches, so they
      // broadcast, persist via the per-family caches, and cross the
      // outbound plane as the user's own edits — a client-host import
      // (web tab, extension joined to a backend) propagates upstream.
      // Mode `new` materializes the just-created workspace's service
      // and emits too (S25 — a consumed-Org new workspace must reach
      // the wire; home-Org content stays local via the tenancy gate).
      // Without a service (non-resident picked target, hosts without
      // the sync runtime) fall back to the wholesale storage write.
      const emitted = await emitPlanAsLocalMutations({
        targetWorkspaceId,
        plan,
        target,
        materializeIfAbsent: targetMode === 'new',
      });

      if (!emitted) {
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
        const nextWorkspaceVars: WorkspaceVariables = {
          schemaVersion: 5,
          variables: plan.workspaceVars.variables,
        };
        const nextVault: Vault | undefined =
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
          await hostStorage.setMany(writes);
        } catch (err) {
          logger.error('WorkspaceImportOrchestrator', 'storage write failed', err);
          throw err;
        }
      }

      // Persist last-imported snapshots for the merge editor's 3-pane
      // ancestor (plan §7). Best-effort: a snapshot-write failure must
      // not roll back the import — the worst case is the next import
      // falls back to 2-pane on the affected uids.
      try {
        const prior = ((await hostStorage.get(k.lastImportedSnapshots)) as Record<string, string> | undefined) ?? {};
        const next = buildLastImportedSnapshots(plan, prior);
        await hostStorage.set(k.lastImportedSnapshots, next);
      } catch (err) {
        logger.warn('WorkspaceImportOrchestrator', 'snapshot persist failed', err);
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
        const r = entry.entity as Request;
        if (
          (r.preRequestScript && r.preRequestScript.length > 0) ||
          (r.postResponseScript && r.postResponseScript.length > 0)
        ) {
          scriptsPendingUids.push(r.uid);
        }
      }

      // If the target is the active workspace and the plan landed via
      // the wholesale storage write, reload in-memory state so the UI
      // sees the newly-imported entities and the host's rule rebuild
      // reads the fresh rule list. The emission path needs none of this
      // — every batch broadcast already drove the caches (and their
      // store mirrors) through the normal projection pipeline.
      const isActive = getActiveWorkspaceId() === targetWorkspaceId;
      if (isActive && !emitted) {
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
      }
      if (isActive) {
        getOracleHostHooks().scheduleRuleEngineUpdate?.('import', { immediate: true });
        if (scriptsPendingUids.length > 0) {
          await markPendingScriptsReview(scriptsPendingUids);
        }
      } else if (scriptsPendingUids.length > 0) {
        await markPendingScriptsReviewForWorkspace(targetWorkspaceId, scriptsPendingUids);
      }
      // Non-active, non-resident target: in-memory snapshots stay
      // untouched. The user's eventual `switchToWorkspace` call hydrates
      // from storage at that point.

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
        const current = ((await hostStorage.get(ringKey)) as unknown[] | undefined) ?? [];
        const next = [...current, report];
        // Cap at the same default the store uses (50). Inline the cap
        // rather than re-export it from the store; the value is part of
        // the storage contract, not the store's API.
        const capped = next.length > 50 ? next.slice(next.length - 50) : next;
        await hostStorage.set(ringKey, capped);
      }

      getOracleHostHooks().recordLog?.({
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
