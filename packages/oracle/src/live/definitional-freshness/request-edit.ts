import { requestExecutableFingerprint } from '@openheaders/core/live';
import { logger } from '@openheaders/core/utils';
import { getActiveEnvironmentId } from '../../entity/environment-store';
import { getRequest } from '../../entity/request-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { markWorkflowDefinitionallyStale } from '../live-cache-store';
import { getLiveVariablesForWorkflow } from '../live-variable-store';
import { getLiveWorkflows } from '../live-workflow-store';
import { canScheduleWorkflow } from '../scheduling-gate';
import { LOG, refreshNow } from './shared';

// ── LF1 — material request-edit detector ──────────────────────────
//
// A workflow's cached token is a function of the request its steps
// embed. When that request's EXECUTABLE surface changes (URL, headers,
// auth, body, scripts — see `requestExecutableFingerprint`), every
// value the workflow cached was minted by a recipe that no longer
// exists. Cosmetic edits (rename, description, folder move) never
// change the fingerprint, so they never reach this path at all.

/** Debounce window collapsing a burst of request saves into one pass. */
let requestEditRefreshDebounceMs = 600;

/** Test-only: shrink the debounce so settle runs on the next macrotask. */
export function __setRequestEditRefreshDebounceMs(ms: number): void {
  requestEditRefreshDebounceMs = ms;
}

// Per-workspace fingerprint of every request embedded by that
// workspace's workflows, as of its last settled pass. Keyed by
// workspaceId so a baseline survives a workspace switch: an edit made
// just before switching away is still diffed against the correct
// pre-edit baseline when the user returns. Within a workspace, a uid
// present with a changed fingerprint is a material edit; a uid absent
// (newly referenced, or the first pass after wake) is adopted without
// a trigger. The first settle for a workspace self-primes off its
// hydration broadcast, which always precedes any human edit.
let requestExecBaseline = new Map<string, Map<string, string>>();
let requestEditDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Fingerprint each request embedded by an active-workspace workflow. */
function snapshotActiveRequestFingerprints(): Map<string, string> {
  const out = new Map<string, string>();
  for (const workflow of getLiveWorkflows()) {
    for (const step of workflow.steps) {
      if (out.has(step.requestUid)) continue;
      const request = getRequest(step.requestUid);
      if (request) out.set(step.requestUid, requestExecutableFingerprint(request));
    }
  }
  return out;
}

/** Debounced entry point — (re)arm the settle timer on every request-store change. */
export function onRequestStoreChangeForRefresh(): void {
  if (requestEditDebounceTimer) clearTimeout(requestEditDebounceTimer);
  requestEditDebounceTimer = setTimeout(() => {
    requestEditDebounceTimer = null;
    void settleRequestEditRefresh().catch((err) => {
      logger.info(LOG, `request-edit refresh settle failed: ${(err as Error).message}`);
    });
  }, requestEditRefreshDebounceMs);
}

/** Diff fingerprints against the active workspace's baseline; refresh workflows whose embedded request materially changed. */
async function settleRequestEditRefresh(): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated, can't key the baseline
  }
  const current = snapshotActiveRequestFingerprints();
  const prevForWs = requestExecBaseline.get(workspaceId);
  requestExecBaseline.set(workspaceId, current);
  // First settle for this workspace — adopt its snapshot without a
  // trigger (the hydration broadcast precedes any human edit).
  if (!prevForWs) return;
  const changed = new Set<string>();
  for (const [uid, fingerprint] of current) {
    const prev = prevForWs.get(uid);
    if (prev !== undefined && prev !== fingerprint) changed.add(uid);
  }
  if (changed.size === 0) return;
  await refreshWorkflowsForChangedRequests(changed);
}

/** Flag every embedding workflow definitionally stale; refresh the active env of those runnable now. */
async function refreshWorkflowsForChangedRequests(changedRequestUids: ReadonlySet<string>): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  const activeEnvironmentId = getActiveEnvironmentId();
  for (const workflow of getLiveWorkflows()) {
    if (!workflow.steps.some((step) => changedRequestUids.has(step.requestUid))) continue;
    // Flag every env cache row definitionally stale. This surfaces the
    // "needs re-run" badge AND — via `computeNextFireAt` — makes each
    // row due now, so the reconcile + cadence path refreshes it even
    // for a workflow that can't run at this instant (disabled,
    // unpublished) but becomes schedulable later.
    try {
      await markWorkflowDefinitionallyStale(workflow.uid, workspaceId);
    } catch (err) {
      logger.info(LOG, `definitional-stale flag failed for ${workflow.uid}: ${(err as Error).message}`);
    }
    // Manual workflows never auto-run — the flag is the whole treatment
    // (`computeNextFireAt` returns null for a manual policy).
    if (workflow.refresh.kind === 'manual') continue;
    // Non-manual + runnable now: refresh the ACTIVE env immediately so
    // the value the user is actually resolving has no wrong-recipe
    // window. Non-active envs — and a workflow not schedulable right
    // now — re-warm via the due-now alarm the flag drives.
    const boundVariables = getLiveVariablesForWorkflow(workflow.uid);
    if (!canScheduleWorkflow(workflow, boundVariables)) continue;
    void refreshNow?.(workspaceId, workflow.uid, activeEnvironmentId).catch((err) => {
      logger.info(LOG, `request-edit refresh failed for ${workflow.uid}: ${(err as Error).message}`);
    });
  }
}

/** Lifecycle teardown: clear the pending timer + drop every workspace baseline. */
export function resetRequestEditDetector(): void {
  if (requestEditDebounceTimer) {
    clearTimeout(requestEditDebounceTimer);
    requestEditDebounceTimer = null;
  }
  requestExecBaseline = new Map();
}
