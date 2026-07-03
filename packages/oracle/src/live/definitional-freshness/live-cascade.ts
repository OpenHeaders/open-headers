import { logger } from '@openheaders/core/utils';
import { getActiveEnvironmentId } from '../../entity/environment-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { markRunDefinitionallyStale, type WorkflowRunCache } from '../live-cache-store';
import { getLiveVariablesForWorkflow } from '../live-variable-store';
import { getLiveWorkflows } from '../live-workflow-store';
import { canScheduleWorkflow } from '../scheduling-gate';
import { canReachDownstream, computeWorkflowDownstreamMap } from '../workflow-dependency-graph';
import { type ChangedWorkflowEnv, LOG, refreshNow } from './shared';

// ── LF4 — chained-workflow cascade ────────────────────────────────
//
// A workflow's cached token is minted from any UPSTREAM live value its
// request embeds. When workflow A's `liveCache` row is rewritten by a
// real refresh, every workflow B whose step request resolves a
// `{{live.X}}` bound to A is downstream-stale: B's cached token was
// extracted from a request that carried A's OLD value.
//
// Detection: the cache-store change broadcast carries the full post-
// write run list. A row whose `extractedAt` ADVANCED since the last
// settled baseline was rewritten by a successful `putWorkflowRunCache`.
// Failures, probe-start transitions, and invalidations all preserve
// `extractedAt`, so they never spuriously cascade.
//
// Propagation is HOP-BY-HOP: a cascade refresh of B writes B's cache,
// which fires this same broadcast, which walks downstream of B to C. A
// chain A→B→C refreshes in topological order because each hop only
// fires once its upstream's new value has actually landed. A dependency
// cycle has no convergent fixpoint; the cycle guard
// (`canReachDownstream`) refuses to traverse a back-edge so the walk
// always terminates.

/** Debounce window collapsing a burst of upstream refreshes into one cascade pass. */
let liveCascadeRefreshDebounceMs = 600;

/** Test-only: shrink the debounce so the cascade settles on the next macrotask. */
export function __setLiveCascadeRefreshDebounceMs(ms: number): void {
  liveCascadeRefreshDebounceMs = ms;
}

/** Per-workspace, per-(workflow, env) `extractedAt` as of that workspace's last settled pass. */
let liveValueExtractedAtBaseline = new Map<string, Map<string, number>>();
let cascadeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Upstream (workflow, env) pairs whose live value advanced since the
 * last settle, bucketed by workspaceId. A bucket survives a switch away
 * from its workspace and is drained when that workspace is active again.
 */
export let pendingCascadeUpstreams = new Map<string, ChangedWorkflowEnv[]>();

/** Test-only: drop the cascade baseline so the next cache change re-primes. */
export function __resetLiveCascadeBaseline(): void {
  liveValueExtractedAtBaseline = new Map();
}

function cascadeRowKey(workflowUid: string, environmentId: string | null): string {
  return `${workflowUid}::${environmentId ?? '__none__'}`;
}

/**
 * LF4 detector — on every live-cache change, diff the changed
 * workflow's rows against the `extractedAt` baseline; a row that
 * advanced is a real refresh whose consumers must cascade-refresh.
 */
export function onLiveCacheChangeForCascade(
  workspaceId: string,
  workflowUid: string | null,
  runs: readonly WorkflowRunCache[],
): void {
  let activeWorkspaceId: string;
  try {
    activeWorkspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  // Active-workspace-only: a write to another workspace's cache can't
  // be cascaded — the workflow / request stores are the active view.
  if (workspaceId !== activeWorkspaceId) return;

  const current = new Map<string, number>();
  for (const run of runs) current.set(cascadeRowKey(run.workflowUid, run.environmentId), run.extractedAt ?? 0);

  // First sight of this workspace — adopt its baseline without a
  // cascade (any apparent advance is the hydration broadcast).
  const prevForWs = liveValueExtractedAtBaseline.get(workspaceId);
  liveValueExtractedAtBaseline.set(workspaceId, current);
  if (!prevForWs) return;

  // `workflowUid === null` is a bulk mutation (workspace purge) — no
  // single upstream to cascade from; the baseline was re-synced above.
  const bucket = pendingCascadeUpstreams.get(workspaceId) ?? [];
  if (workflowUid !== null) {
    for (const run of runs) {
      if (run.workflowUid !== workflowUid) continue;
      const key = cascadeRowKey(run.workflowUid, run.environmentId);
      const prev = prevForWs.get(key) ?? 0;
      const next = run.extractedAt ?? 0;
      // `extractedAt` advanced — a successful `putWorkflowRunCache`
      // minted a new value (a row's first-ever write counts: `prev`
      // defaults to 0). A failed first refresh writes `extractedAt: 0`,
      // so `next > 0` also screens that out.
      if (next > prev) {
        bucket.push({ workflowUid: run.workflowUid, environmentId: run.environmentId });
      }
    }
  }

  if (bucket.length === 0) return;
  pendingCascadeUpstreams.set(workspaceId, bucket);
  if (cascadeDebounceTimer) clearTimeout(cascadeDebounceTimer);
  cascadeDebounceTimer = setTimeout(() => {
    cascadeDebounceTimer = null;
    void settleLiveValueCascade().catch((err) => {
      logger.info(LOG, `live-value cascade settle failed: ${(err as Error).message}`);
    });
  }, liveCascadeRefreshDebounceMs);
}

/**
 * Walk downstream of each refreshed upstream (workflow, env) for the
 * active workspace; flag / refresh the consumers. Drains only the
 * active workspace's `pendingCascadeUpstreams` bucket — a bucket for a
 * workspace switched away from waits in the map until that workspace is
 * active again, so a cascade detected just before a switch is never lost.
 */
export async function settleLiveValueCascade(): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  const upstreams = pendingCascadeUpstreams.get(workspaceId);
  if (!upstreams || upstreams.length === 0) return;
  pendingCascadeUpstreams.delete(workspaceId);
  const downstream = computeWorkflowDownstreamMap();
  if (downstream.size === 0) return;

  // Collect the affected downstream (workflow, env) pairs, deduped — a
  // consumer of two upstreams that both refreshed is acted on once.
  const affected = new Map<string, Set<string | null>>();
  let skippedCycle = false;
  for (const { workflowUid: upstreamUid, environmentId } of upstreams) {
    const children = downstream.get(upstreamUid);
    if (!children) continue;
    for (const childUid of children) {
      // Cycle guard: an `upstream → child` edge is a back-edge when the
      // child can itself reach the upstream downstream. A cyclic config
      // has no convergent fixpoint — refuse to traverse the cycle so the
      // hop-by-hop walk terminates. Each workflow still refreshes on its
      // own cadence timer.
      if (canReachDownstream(childUid, upstreamUid, downstream)) {
        skippedCycle = true;
        continue;
      }
      let envs = affected.get(childUid);
      if (!envs) {
        envs = new Set();
        affected.set(childUid, envs);
      }
      envs.add(environmentId);
    }
  }
  if (skippedCycle) {
    logger.info(LOG, 'live-value cascade skipped a workflow dependency cycle');
  }
  if (affected.size === 0) return;

  const activeEnvironmentId = getActiveEnvironmentId();
  const workflowsByUid = new Map(getLiveWorkflows().map((w) => [w.uid, w]));
  for (const [childUid, environmentIds] of affected) {
    const workflow = workflowsByUid.get(childUid);
    if (!workflow) continue;
    // Flag every affected env cache row definitionally stale, before any
    // gate. The row is KEPT (it keeps serving so live traffic doesn't
    // gap, and stays in the scheduler's entry set so a non-active env
    // re-warms via the due-now reconcile). A successful refresh clears
    // the flag.
    for (const environmentId of environmentIds) {
      try {
        await markRunDefinitionallyStale(childUid, environmentId, workspaceId);
      } catch (err) {
        logger.info(LOG, `cascade definitional-stale flag failed for ${childUid}: ${(err as Error).message}`);
      }
    }
    if (workflow.refresh.kind === 'manual') continue;
    // Non-manual + runnable now: refresh the ACTIVE env immediately when
    // its upstream value changed. The resulting cache write fires the
    // next hop of the cascade.
    const boundVariables = getLiveVariablesForWorkflow(childUid);
    if (!canScheduleWorkflow(workflow, boundVariables)) continue;
    if (environmentIds.has(activeEnvironmentId)) {
      void refreshNow?.(workspaceId, childUid, activeEnvironmentId).catch((err) => {
        logger.info(LOG, `live-value cascade refresh failed for ${childUid}: ${(err as Error).message}`);
      });
    }
  }
}

/** Lifecycle teardown: clear the pending timer, the buckets, and every workspace baseline. */
export function resetLiveCascadeDetector(): void {
  if (cascadeDebounceTimer) {
    clearTimeout(cascadeDebounceTimer);
    cascadeDebounceTimer = null;
  }
  pendingCascadeUpstreams = new Map();
  liveValueExtractedAtBaseline = new Map();
}
