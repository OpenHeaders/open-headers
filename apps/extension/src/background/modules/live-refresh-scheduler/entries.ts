/**
 * Job shape + reconcile data collection — the `LiveEntry` unit the
 * scheduler dispatches (one alarm per `(workspace, workflow, env)`) and
 * the cache-summary projection the core cadence math consumes.
 */

import { type CacheSummary, initialCircuitSnapshot } from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { listCachesForWorkflow, type WorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import { getLiveVariablesForWorkflow } from '@openheaders/oracle/live/live-variable-store';
import { getLiveWorkflows } from '@openheaders/oracle/live/live-workflow-store';
import { hostStorage, OH } from '@openheaders/oracle/storage';

// ── Cache summary projection ──────────────────────────────────────
//
// The schedulability gate (`canScheduleWorkflow`) is host-neutral and
// lives in `@openheaders/oracle/live/scheduling-gate`;
// the folder barrel re-exports it for its external callers + tests.

/**
 * Project a `WorkflowRunCache` down to the `CacheSummary` the core
 * cadence function needs. Pure mapping — lets the scheduler stay
 * dependency-light at its boundary with the core module.
 */
export function toCacheSummary(run: WorkflowRunCache | null | undefined): CacheSummary | null {
  if (!run) return null;
  return {
    extractedAt: run.extractedAt || undefined,
    stepCaptures: run.stepCaptures,
    consecutiveFailures: run.consecutiveFailures,
    lastErrorAt: run.lastErrorAt,
    // Cadence math consults this first when present — OPEN states
    // schedule to `circuit.nextAttemptAt`, pre-breaker CLOSED failures
    // get the 5s±5s tier. The fallback to `initialCircuitSnapshot`
    // mirrors `normalizeBlob`'s per-row tolerant read.
    circuit: run.circuit ?? initialCircuitSnapshot(),
    // A definitionally-stale row's recipe changed — the cadence math
    // overrides the healthy tick to "fire ASAP" so the wrong-recipe
    // value is not served until natural expiry.
    definitionallyStale: run.definitionallyStale,
  };
}

// ── Job shape — one alarm per (workspace, workflow, env) ──────────

/**
 * One scheduleable refresh — a workflow paired with a specific env
 * and the cache row for that env (if any). The scheduler dispatches
 * one alarm per entry; `listAll` expands each workflow into N entries
 * across its cached envs (or a single `null`-env entry when the
 * workflow has never refreshed).
 */
export interface LiveEntry {
  workspaceId: string;
  workflow: LiveWorkflow;
  boundVariables: LiveVariable[];
  cache: WorkflowRunCache | null;
  environmentId: string | null;
}

// ── Reconcile data collection ─────────────────────────────────────
//
// Active-workspace-only: the scheduler ONLY refreshes workflows that
// belong to the workspace the user is currently using. Inactive
// workspaces' workflows go quiet on disk — their cache rows survive
// (so switching back finds them still-fresh within the cadence
// window) but no alarms fire for them. This is by design:
//   • OAuth refresh tokens for unused workspaces stop rotating
//     server-side, shrinking the always-live attack surface.
//   • Battery + network costs scale with what the user actually
//     touches, not with how many workspaces exist on disk.
//   • Refresh failures (rotated creds, locked accounts, network
//     blips) only generate noise for workspaces the user can
//     observe + fix.
//
// On workspace switch, `kickActiveContextRefresh` (`./api`) drives a
// best-effort warm pass for the new context's missing/stale rows so
// the user doesn't see a silent "no cache for env X" gap on a
// workspace they actively work in.

export async function collectEntries(): Promise<LiveEntry[]> {
  const activeWorkflows = getLiveWorkflows();
  const activeId = (await hostStorage.get(OH.runtimeActive)) ?? '';
  if (activeWorkflows.length === 0 || typeof activeId !== 'string' || activeId.length === 0) return [];

  const out: LiveEntry[] = [];
  for (const workflow of activeWorkflows) {
    const runs = await listCachesForWorkflow(workflow.uid, activeId);
    const envs: Array<string | null> = runs.length > 0 ? runs.map((r) => r.environmentId) : [null];
    const boundVariables = getLiveVariablesForWorkflow(workflow.uid);
    for (const envId of envs) {
      out.push({
        workspaceId: activeId,
        workflow,
        boundVariables,
        cache: runs.find((r) => r.environmentId === envId) ?? null,
        environmentId: envId,
      });
    }
  }
  return out;
}
