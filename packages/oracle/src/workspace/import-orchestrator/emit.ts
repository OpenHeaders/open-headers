/**
 * Import → local-mutation emission — applies an executed plan as
 * ordinary local batches through the target workspace's resident sync
 * service, so the import rides the exact path an editor write takes:
 * materialization, cache projection + persistence, broadcast, and the
 * outbound mutation plane. This is the fix for the disproven premise
 * that a post-import reseed syncs upstream — seed batches apply with
 * `applyOrigin: 'inbound'`, which the outbound plane drops, so an
 * import used to land host-local on every client host.
 *
 * Storage persistence is a consequence here, not a step: every touched
 * family's cache re-projects on broadcast and persists its own key, so
 * the caller skips the wholesale `setMany` when emission ran.
 *
 * Resident-first: a picked non-resident target (or a host without the
 * sync runtime) falls back to the caller's storage-write path —
 * emission never force-materializes a service SOMEONE ELSE owns. The
 * one exception is mode `new` (`materializeIfAbsent`): the target was
 * created inside this import, is empty, and — when bound to a consumed
 * Org — needs emission for its content to reach the wire at all.
 */

import type { MutatorContext } from '@openheaders/core/sync';
import {
  type EmissionBatch,
  synthesizeImportEmission,
} from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import { logger } from '@openheaders/core/utils';
import type { ImportPlan, LocalFolder, PlanEntry } from '@openheaders/core/workspace-export';
import {
  acquireResidentWorkspaceService,
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  type WorkspaceServiceState,
} from '@openheaders/oracle/sync/service';
import { isInTree } from './plan-helpers';
import type { ReadTargetResult } from './target';

export interface EmitPlanArgs {
  targetWorkspaceId: string;
  plan: ImportPlan;
  target: ReadTargetResult['target'];
  /**
   * Build the service when none is resident — the mode-`new` path,
   * where the target was created moments ago inside this very import
   * and CANNOT have a service yet. The just-minted workspace is empty,
   * so materialization is cheap and safe; emission is what lets a
   * consumed-Org new workspace's content propagate upstream instead of
   * landing as sync-invisible storage writes. Hosts without a sync
   * runtime (no deps factory installed) fall back to the caller's
   * storage-write path via the catch.
   */
  materializeIfAbsent?: boolean;
}

function acquireForEmission(args: EmitPlanArgs): WorkspaceServiceState | null {
  if (!args.materializeIfAbsent) return acquireResidentWorkspaceService(args.targetWorkspaceId);
  try {
    return getOrCreateWorkspaceService(args.targetWorkspaceId);
  } catch {
    return null;
  }
}

/**
 * Emit the plan's non-skip entries as local mutations through the
 * target's resident sync service. Returns `false` without touching
 * anything when no service is resident — the caller then takes the
 * storage-write path. Per-batch failures are logged and skipped (the
 * same partial-success contract the reseed path had); the import
 * report's storage-level error slots stay the caller's concern.
 */
export async function emitPlanAsLocalMutations(args: EmitPlanArgs): Promise<boolean> {
  const svc = acquireForEmission(args);
  if (!svc) return false;
  try {
    await svc.hydrated;
    const { plan, target } = args;
    const batches = synthesizeImportEmission(
      {
        plan,
        ruleCollections: treeSlice(plan.collections, 'rules'),
        requestCollections: treeSlice(plan.collections, 'requests'),
        templateCollections: treeSlice(plan.collections, 'templates'),
        ruleFolders: treeSlice(plan.folders, 'rules'),
        requestFolders: treeSlice(plan.folders, 'requests'),
        templateFolders: treeSlice(plan.folders, 'templates'),
      },
      {
        rules: target.rules ?? [],
        requests: target.requests ?? [],
        templates: target.templates ?? [],
        environments: target.environments ?? [],
        liveWorkflows: target.liveWorkflows ?? [],
        liveVariables: target.liveVariables ?? [],
        specs: target.specs ?? [],
        ruleCollections: target.collections ?? [],
        requestCollections: target.requestCollections ?? [],
        templateCollections: target.templateCollections ?? [],
        ruleFolders: (target.folders ?? []) as LocalFolder[],
        requestFolders: (target.requestFolders ?? []) as LocalFolder[],
        templateFolders: (target.templateFolders ?? []) as LocalFolder[],
        ...(target.workspaceVars ? { workspaceVars: target.workspaceVars } : {}),
        ...(target.vault ? { vault: target.vault } : {}),
      },
      {
        nextCtx: (): MutatorContext => svc.context.next({ surfaceId: 'sw' }),
        liveSetEntries: (entityType, id, setPath) =>
          svc.oracle
            .liveOrderedSetItems(entityType, id, setPath)
            .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
      },
    );
    await applyAll(svc.oracle, batches);
    return true;
  } finally {
    releaseWorkspaceService(args.targetWorkspaceId);
  }
}

function treeSlice<T extends { path: string }>(
  entries: PlanEntry<T>[],
  tree: 'rules' | 'requests' | 'templates',
): PlanEntry<T>[] {
  return entries.filter((e) => isInTree(e.entity.path, tree));
}

async function applyAll(oracle: WorkspaceServiceState['oracle'], batches: EmissionBatch[]): Promise<void> {
  for (const { label, batch, sideEffects } of batches) {
    const result = await oracle.apply(batch, sideEffects);
    if (!result.ok) {
      logger.warn(
        'WorkspaceImportOrchestrator',
        `emission: ${label} rejected (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
      );
    }
  }
}
