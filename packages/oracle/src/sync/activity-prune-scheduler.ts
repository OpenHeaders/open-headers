/**
 * Activity Feed auto-decay — Phase C F7.
 *
 * The {@link ActivityLog.prune} contract drops rows whose `observedAt`
 * is strictly older than a caller-supplied cutoff. F7 supplies the
 * cadence: a host-neutral sweep that iterates every resident workspace
 * and calls `prune` with `now - retentionMs`.
 *
 * Why a shared core, not a shared timer: chrome.alarms (extension SW)
 * and setInterval (desktop main) have different lifecycle semantics —
 * alarms survive SW eviction and reschedule themselves, intervals don't.
 * Each host owns its timer wrapper; this module owns the iteration
 * policy + retention constants so both hosts cap at the same cutoff.
 *
 * The sweep is best-effort: a failure on one workspace logs the error
 * and continues with the rest. Pruning is idempotent — a missed tick
 * just means the next tick covers a slightly wider window.
 */

import { hostLogger as logger } from '@openheaders/core/logger';

import type { ActivityLog } from './activity-log';

const SCOPE = 'ActivityPrune';

/** Default retention window — 7 days, per `docs/DATA_PLANE_TOPOLOGIES.md` §11.6. */
export const ACTIVITY_PRUNE_DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Default sweep cadence — once an hour. Cheap enough to skip throttling. */
export const ACTIVITY_PRUNE_DEFAULT_PERIOD_MS = 60 * 60 * 1000;

export interface RunActivityPruneSweepInput {
  /** The installed log. `null` short-circuits the sweep with an empty result. */
  log: ActivityLog | null;
  /** Workspaces to sweep this tick. Typically every resident workspace. */
  workspaceIds: readonly string[];
  /** Wall clock. Injected so tests can drive cutoffs deterministically. */
  now: number;
  /** Retention window. Defaults to {@link ACTIVITY_PRUNE_DEFAULT_RETENTION_MS}. */
  retentionMs?: number;
}

export interface ActivityPruneWorkspaceResult {
  workspaceId: string;
  /** Rows removed, or `null` if `prune` threw for this workspace. */
  removed: number | null;
}

export interface ActivityPruneSweepResult {
  cutoffObservedAtMs: number;
  perWorkspace: readonly ActivityPruneWorkspaceResult[];
  totalRemoved: number;
}

/**
 * Drop rows older than the cutoff across every supplied workspace.
 * Per-workspace failures are caught and recorded as `removed: null` so
 * one bad bucket cannot starve the others.
 */
export async function runActivityPruneSweep(
  input: RunActivityPruneSweepInput,
): Promise<ActivityPruneSweepResult> {
  const retentionMs = input.retentionMs ?? ACTIVITY_PRUNE_DEFAULT_RETENTION_MS;
  const cutoffObservedAtMs = input.now - retentionMs;
  if (!input.log || input.workspaceIds.length === 0) {
    return { cutoffObservedAtMs, perWorkspace: [], totalRemoved: 0 };
  }
  const log = input.log;
  const perWorkspace: ActivityPruneWorkspaceResult[] = [];
  let totalRemoved = 0;
  for (const workspaceId of input.workspaceIds) {
    try {
      const removed = await log.prune(workspaceId, cutoffObservedAtMs);
      perWorkspace.push({ workspaceId, removed });
      totalRemoved += removed;
    } catch (err) {
      logger.warn(SCOPE, `prune failed for workspace ${workspaceId}`, err);
      perWorkspace.push({ workspaceId, removed: null });
    }
  }
  return { cutoffObservedAtMs, perWorkspace, totalRemoved };
}
