/**
 * Desktop main side of Activity Feed auto-decay (Phase C F7).
 *
 * Mirror of {@link apps/extension/src/background/activity-prune-scheduler.ts}
 * for the main process. The main process is long-lived (no SW eviction
 * to mask) so a plain `setInterval` is sufficient — chrome.alarms isn't
 * available outside the SW host anyway. Both hosts delegate to the same
 * {@link runActivityPruneSweep} core so retention semantics stay
 * identical across surfaces.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import {
  ACTIVITY_PRUNE_DEFAULT_PERIOD_MS,
  runActivityPruneSweep,
  type ActivityLog,
} from '@openheaders/oracle/sync';

const SCOPE = 'ActivityPrune';

export interface InstallActivityPruneSchedulerInput {
  /** Resolves to the currently-installed activity log; `null` is tolerated. */
  getLog: () => ActivityLog | null;
  /** Snapshot of every workspace whose log should be swept this tick. */
  listWorkspaceIds: () => readonly string[];
  /** Period override (default = 1 hour). Tests pass smaller values. */
  periodMs?: number;
  /** Optional clock override for tests. */
  now?: () => number;
}

/**
 * Start the recurring sweep. Returns a `stop` handle for app teardown +
 * tests. Calling `stop` is idempotent.
 */
export function installActivityPruneScheduler(input: InstallActivityPruneSchedulerInput): () => void {
  const periodMs = input.periodMs ?? ACTIVITY_PRUNE_DEFAULT_PERIOD_MS;
  const now = input.now ?? (() => Date.now());
  const timer = setInterval(() => {
    void runActivityPruneSweep({
      log: input.getLog(),
      workspaceIds: input.listWorkspaceIds(),
      now: now(),
    })
      .then((result) => {
        if (result.totalRemoved > 0) {
          logger.info(
            SCOPE,
            `pruned ${result.totalRemoved} expired activity row(s) across ${result.perWorkspace.length} workspace(s)`,
          );
        }
      })
      .catch((err: unknown) => {
        logger.warn(SCOPE, 'activity prune sweep failed', err);
      });
  }, periodMs);
  // Node's setInterval keeps the event loop alive; opt out so a quiet
  // process can still exit cleanly under `electron .` + Ctrl-C.
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    (timer as { unref: () => void }).unref();
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };
}
