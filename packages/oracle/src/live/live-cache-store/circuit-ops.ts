/**
 * Circuit-breaker operations on cached runs — probe-start transition,
 * exclusive-degraded marking, manual-bypass failure, and hard reset.
 */

import { resetCircuit as resetCircuitSnapshot, transitionOpenToHalfOpen } from '@openheaders/core/live';
import type { WorkflowRunCache } from '@openheaders/core/types';
import { type LiveCacheBlob, readBlob, resolveWorkspaceId, runKey, truncate, withCacheLock, writeBlob } from './blob';
import { notifyChange } from './listeners';
import type { RefreshErrorInput } from './refresh-writes';

/**
 * Transition the circuit `open → half-open` in persisted state at
 * the moment a probe attempt is about to dispatch. Called from the
 * scheduler's alarm path AFTER `canAttempt` says yes and BEFORE the
 * adapter runs the chain. Idempotent — no-op when state isn't
 * `open` or when `nextAttemptAt` hasn't been reached yet.
 *
 * Why persist before the probe: `onCircuitFailure` has different
 * semantics for `half-open` (bump openings) vs `open` (preserve
 * openings — that branch is for manual-bypass failures). If we
 * didn't transition first, a failed scheduled probe would take the
 * open-branch and not grow the backoff curve across repeated
 * outages. Writing through the cache store means the UI's "probing..."
 * state lights up immediately too.
 */
export async function markProbeStartForRun(
  workflowUid: string,
  environmentId: string | null,
  nowMs: number = Date.now(),
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let latest: WorkflowRunCache | null = null;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous) return;
    const transitioned = transitionOpenToHalfOpen(previous.circuit, nowMs);
    if (transitioned === previous.circuit) return; // no-op
    latest = { ...previous, circuit: transitioned };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (latest) notifyChange(wsId, workflowUid, postWriteRuns);
  return latest;
}

/**
 * Mark a run's *exclusive* credential as degraded because a connected peer
 * declined to self-refresh it at the near-expiry escape hatch (WS-C C9) —
 * the backend that was producing this remote-sourced value went silent and
 * a self-refresh would burn the single-use code / trip OAuth reuse-detection.
 *
 * Idempotent: once marked, a re-mark is a no-op (preserves the original
 * `since` and avoids notify churn on the steady-state re-check poll). No
 * row → null (nothing to degrade). The mark is cleared by a fresh remote
 * value (`applySyncedLiveValues`) or this host producing the value itself
 * (`putWorkflowRunCache` writes a row without the field).
 */
export async function markExclusiveDegradedForRun(
  workflowUid: string,
  environmentId: string | null,
  sinceMs: number = Date.now(),
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let latest: WorkflowRunCache | null = null;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous || previous.exclusiveDegradedSince != null) return; // absent or already degraded
    latest = { ...previous, exclusiveDegradedSince: sinceMs };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (latest) notifyChange(wsId, workflowUid, postWriteRuns);
  return latest;
}

/**
 * Record a failure from a manual-bypass attempt. Unlike
 * {@link recordRefreshError}, this path does NOT advance the circuit
 * state machine — `nextAttemptAt`, `consecutiveOpenings`, and
 * `consecutiveFailures` all stay at their pre-bypass values. The
 * only things written are the error-detail fields (`lastErrorAt`,
 * `lastErrorMessage`, `lastErrorStepId`) + `lastExtractorOk`.
 *
 * Rationale matches v4 `AdaptiveCircuitBreaker.executeWithBypass`:
 * a user clicking "Retry now" while the circuit is paused is not a
 * natural retry tick. If it fails, the provider is still broken;
 * the existing backoff curve is already the right answer — pushing
 * `nextAttemptAt` forward would punish the user for their clarifying
 * click.
 */
export async function recordManualBypassFailureForRun(
  input: RefreshErrorInput,
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(input.workflowUid, input.environmentId);
  let latest: WorkflowRunCache | null = null;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous) return;
    latest = {
      ...previous,
      lastErrorAt: Date.now(),
      lastErrorMessage: truncate(input.message, 200),
      lastErrorStepId: input.failedStepId,
      lastExtractorOk: input.extractorOk ?? false,
      // Circuit snapshot intentionally unchanged — bypass failures
      // don't advance the state machine.
    };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (latest) notifyChange(wsId, input.workflowUid, postWriteRuns);
  return latest;
}

/**
 * Hard-reset the circuit for one `(workflow, env)` entry. Called
 * from the Workflow Status sidebar's "Reset circuit" action when
 * the user is confident the upstream is recovered and wants to
 * clear the backoff state without waiting for `nextAttemptAt`. Does
 * NOT touch captures / extractedAt — a manual circuit reset is
 * purely a gate clear, not an invalidation.
 */
export async function resetCircuitForRun(
  workflowUid: string,
  environmentId: string | null,
  workspaceId?: string,
): Promise<WorkflowRunCache | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const key = runKey(workflowUid, environmentId);
  let latest: WorkflowRunCache | null = null;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(wsId, async () => {
    const current = await readBlob(wsId);
    const previous: WorkflowRunCache | undefined = current.runs[key];
    if (!previous) return;
    latest = {
      ...previous,
      consecutiveFailures: 0,
      circuit: resetCircuitSnapshot(),
      // Clear error residue so the UI flips green immediately — the
      // user's "Reset" click is an explicit "I'm vouching the upstream
      // is fine now" signal.
      lastErrorAt: undefined,
      lastErrorMessage: undefined,
      lastErrorStepId: undefined,
    };
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: { ...current.runs, [key]: latest },
    };
    await writeBlob(wsId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (latest) notifyChange(wsId, workflowUid, postWriteRuns);
  return latest;
}
