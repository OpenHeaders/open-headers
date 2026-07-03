import { workflowDefinitionFingerprint } from '@openheaders/core/live';
import { logger } from '@openheaders/core/utils';
import { getActiveEnvironmentId } from '../../entity/environment-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { clearWorkflowRunCache, markWorkflowDefinitionallyStale } from '../live-cache-store';
import { getLiveVariablesForWorkflow } from '../live-variable-store';
import { getLiveWorkflows } from '../live-workflow-store';
import { canScheduleWorkflow } from '../scheduling-gate';
import { LOG, refreshNow } from './shared';

// ── LF3 — workflow delete + definition edit ───────────────────────
//
// A workflow's cached token is minted from a third recipe input: the
// workflow DEFINITION itself — which steps run, in what order, under
// what gates, capturing what. Two definition changes invalidate it:
//
//   • Delete — the workflow is gone; its `liveCache` rows are orphaned.
//     A bound `{{live.X}}` would otherwise resolve a frozen, never-
//     refreshed value forever. Every env-keyed cache row is purged.
//   • Definition edit — re-pointing a step at a different request,
//     changing an extractor, adding / removing / reordering steps.
//     Treated like a material request edit (LF1): flag every env row
//     definitionally stale + refresh the active env when runnable.
//
// Both off the same `onLiveWorkflowStoreChange` broadcast against one
// workspace-tagged baseline. The fingerprint excludes cosmetic +
// scheduling fields (`name`, `description`, `enabled`, `published`,
// `refresh`), so a rename / enable-toggle / cadence change never fires.
// No debounce — a delete or a save is atomic, not a keystroke burst.

let workflowDefinitionBaseline: { workspaceId: string; defs: Map<string, string> } | null = null;

/** Test-only: drop the workflow-definition baseline so the next change re-primes. */
export function __resetWorkflowDefinitionBaseline(): void {
  workflowDefinitionBaseline = null;
}

/** Fingerprint every active-workspace workflow's executable definition. */
function snapshotWorkflowDefinitions(): Map<string, string> {
  const out = new Map<string, string>();
  for (const wf of getLiveWorkflows()) out.set(wf.uid, workflowDefinitionFingerprint(wf));
  return out;
}

/** Diff the active workspace's workflow definitions; purge deletes, refresh edits. */
export async function settleWorkflowDefinitionChanges(): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  const current = snapshotWorkflowDefinitions();
  // First sight, or a workspace switch — adopt the new map without
  // acting (any vanished uid belongs to the other workspace, not a
  // delete; any fingerprint shift is the hydration broadcast).
  if (!workflowDefinitionBaseline || workflowDefinitionBaseline.workspaceId !== workspaceId) {
    workflowDefinitionBaseline = { workspaceId, defs: current };
    return;
  }
  const deleted: string[] = [];
  const edited: string[] = [];
  for (const [uid, fingerprint] of workflowDefinitionBaseline.defs) {
    const next = current.get(uid);
    if (next === undefined) deleted.push(uid);
    else if (next !== fingerprint) edited.push(uid);
  }
  workflowDefinitionBaseline = { workspaceId, defs: current };

  for (const uid of deleted) {
    void clearWorkflowRunCache(uid, workspaceId).catch((err) => {
      logger.info(LOG, `workflow-delete cache purge failed for ${uid}: ${(err as Error).message}`);
    });
  }
  if (edited.length > 0) await refreshWorkflowsForChangedDefinitions(edited, workspaceId);
}

/** Flag every edited workflow definitionally stale; refresh the active env of those runnable now. */
async function refreshWorkflowsForChangedDefinitions(
  editedUids: readonly string[],
  workspaceId: string,
): Promise<void> {
  const activeEnvironmentId = getActiveEnvironmentId();
  const workflowsByUid = new Map(getLiveWorkflows().map((w) => [w.uid, w]));
  for (const uid of editedUids) {
    const workflow = workflowsByUid.get(uid);
    if (!workflow) continue;
    // Flag every env cache row definitionally stale, before any gate —
    // the whole treatment for manual workflows and for one not
    // schedulable right now; `computeNextFireAt` honors the flag.
    try {
      await markWorkflowDefinitionallyStale(uid, workspaceId);
    } catch (err) {
      logger.info(LOG, `definitional-stale flag failed for ${uid}: ${(err as Error).message}`);
    }
    if (workflow.refresh.kind === 'manual') continue;
    const boundVariables = getLiveVariablesForWorkflow(uid);
    if (!canScheduleWorkflow(workflow, boundVariables)) continue;
    void refreshNow?.(workspaceId, uid, activeEnvironmentId).catch((err) => {
      logger.info(LOG, `workflow-definition refresh failed for ${uid}: ${(err as Error).message}`);
    });
  }
}
