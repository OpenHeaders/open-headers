/**
 * A workflow run once because a person asked — the workflow editor's
 * Refresh, the live variable editors', Workflow Status's. Host-neutral:
 * every host's door calls this one rule and differs only in what it
 * injects (the workflow runs plan, Decisions log, S5).
 *
 * What a press passes that a scheduled fire does not:
 *   - the scheduling gate. A fire declines a workflow no live variable
 *     reads; a person runs one to see its captures before binding any.
 *   - an OPEN circuit inside its backoff. The press runs anyway, as a
 *     bypass: a failure then records the error and leaves the circuit
 *     where it was, so the click never pushes the next scheduled retry
 *     further out.
 *
 * A press on a circuit that would let a fire through (closed, half-open,
 * open past `nextAttemptAt`) is a fire in every respect: an open circuit
 * is marked as probing first, and a failure advances it.
 *
 * Success is the same on both paths — the cache write closes the circuit.
 * A failure reaches the caller as the runner's own error.
 *
 * A host that runs in the realm of its stores calls the rule whole. One
 * whose run lives elsewhere calls its two halves, around the run.
 */

import { canAttempt } from '@openheaders/core/live';
import type { LiveWorkflow, WorkflowRunCache } from '@openheaders/core/types';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '../sync/service';
import { listCachesForWorkflow, markProbeStartForRun } from './live-cache-store';
import { getLiveWorkflowInWorkspace } from './live-workflow-store';

export interface ManualRefreshTarget {
  workspaceId: string;
  workflowUid: string;
  /** `null` = "No environment". */
  environmentId: string | null;
  /** The caller's id for this run — its step events carry it. */
  runId?: string;
}

export interface ManualRefreshRun {
  workspaceId: string;
  workflow: LiveWorkflow;
  environmentId: string | null;
  /** The press overrides an open circuit: a failure must leave the circuit as it was. */
  bypass: boolean;
  /** What the run's first step event says started it. */
  trigger: 'manual';
  runId?: string;
}

export interface ManualRefreshHooks {
  /** A host that can tell it has no network refuses the press before it counts as a failure. */
  isOnline?(): boolean;
  onFired?(): void;
  onSucceeded?(): void;
  /** `cache` is the row as the failed run left it. */
  onFailed?(error: Error, cache: WorkflowRunCache | null): void;
}

export interface ManualRefreshHost extends ManualRefreshHooks {
  /** Run the workflow and write its outcome to the cache. Throws when the run fails. */
  run(args: ManualRefreshRun): Promise<void>;
}

/** What the rule decided before the run. */
export interface ManualRefreshBegun {
  workflow: LiveWorkflow;
  /** The press overrides an open circuit: a failure must leave the circuit as it was. */
  bypass: boolean;
}

async function readRow(target: ManualRefreshTarget): Promise<WorkflowRunCache | null> {
  const runs = await listCachesForWorkflow(target.workflowUid, target.workspaceId);
  return runs.find((run) => run.environmentId === target.environmentId) ?? null;
}

/**
 * The workspace's stores stay resident for `fn` even when nothing else
 * holds them — a press on a workspace that is not the active one.
 */
async function holdingWorkspace<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const service = getOrCreateWorkspaceService(workspaceId);
  try {
    await service.hydrated;
    return await fn();
  } finally {
    releaseWorkspaceService(workspaceId);
  }
}

async function begin(target: ManualRefreshTarget, hooks: ManualRefreshHooks): Promise<ManualRefreshBegun> {
  const { workspaceId, workflowUid, environmentId } = target;
  const workflow = getLiveWorkflowInWorkspace(workflowUid, workspaceId);
  if (!workflow) throw new Error(`Workflow ${workflowUid} not found in workspace ${workspaceId}`);

  if (hooks.isOnline?.() === false) {
    throw new Error("You're offline — refresh will resume automatically when connectivity returns.");
  }

  const now = Date.now();
  const circuit = (await readRow(target))?.circuit ?? null;
  const bypass = circuit !== null && !canAttempt(circuit, now);

  hooks.onFired?.();
  if (!bypass && circuit?.state === 'open') {
    await markProbeStartForRun(workflowUid, environmentId, now, workspaceId);
  }
  return { workflow, bypass };
}

async function settle(target: ManualRefreshTarget, hooks: ManualRefreshHooks, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    hooks.onFailed?.(error, await readRow(target));
    throw error;
  }
  hooks.onSucceeded?.();
}

export async function refreshWorkflowByUser(target: ManualRefreshTarget, host: ManualRefreshHost): Promise<void> {
  const { workspaceId, environmentId, runId } = target;
  return holdingWorkspace(workspaceId, async () => {
    const { workflow, bypass } = await begin(target, host);
    await settle(target, host, () =>
      host.run({
        workspaceId,
        workflow,
        environmentId,
        bypass,
        trigger: 'manual',
        ...(runId !== undefined ? { runId } : {}),
      }),
    );
  });
}

/**
 * The rule's first half, for a host whose run lives in another realm
 * than its stores (the workflow runs plan, Laws — "The run lives with its
 * session"): everything decided before the run, answered to the realm
 * that runs it. {@link settleManualRefresh} is the other half.
 */
export function beginManualRefresh(
  target: ManualRefreshTarget,
  hooks: ManualRefreshHooks,
): Promise<ManualRefreshBegun> {
  return holdingWorkspace(target.workspaceId, () => begin(target, hooks));
}

/**
 * The rule's second half: `commit` writes the outcome a run in another
 * realm handed back and throws when that run failed, as a runner does.
 */
export function settleManualRefresh(
  target: ManualRefreshTarget,
  hooks: ManualRefreshHooks,
  commit: () => Promise<void>,
): Promise<void> {
  return holdingWorkspace(target.workspaceId, () => settle(target, hooks, commit));
}
