/**
 * Desktop live Status pill — aggregate the active workspace's cached
 * workflow runs into one `live` Status entry.
 *
 * The main-process counterpart to the extension's `recomputeLiveStatus`
 * (`apps/extension/src/background/modules/live-refresh-scheduler.ts`).
 * Same color rules, same active-workspace-only scope, same value-blind
 * reporting — only the host wiring differs: the desktop reports into the
 * shared store that `install-rpc-host` already broadcasts to renderers
 * over the `statusUpdated` channel.
 *
 * Color rules (plan §Observability → Status pill):
 *   green  — every run that has run at least once is fresh: no
 *            consecutive failures, extractor last OK, not stale beyond
 *            2× its cadence window.
 *   yellow — any run stale beyond 2× cadence OR `lastExtractorOk=false`
 *            OR `consecutiveFailures` in 1..4.
 *   red    — any run with `consecutiveFailures >= 5`.
 *
 * Inactive workspaces are excluded by design — the user can't see or act
 * on their runs, so reporting them would pill the footer for state out
 * of reach. A workspace switch re-reads the now-active cache (the
 * scheduler's reconcile re-fires this on the switch event).
 *
 * Values never appear in the message — only counts + the first failing
 * workflow uid as a triage hint.
 */

import { logger } from '@openheaders/core/utils';
import { listWorkflowRunCaches } from '@openheaders/oracle/live/live-cache-store';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { report as reportStatus } from '@openheaders/ui/shared/status/store';

const LOG = 'DesktopLiveRunner';

/** `consecutiveFailures` at or above this flips the run — and the pill — red. */
const RED_FAILURE_THRESHOLD = 5;

/**
 * Recompute the `live` pill from the active workspace's cache rows and
 * report it. A no-op-safe read: a missing active workspace (boot race)
 * or a storage fault leaves the previous pill untouched rather than
 * flipping it to a misleading state. `report` is idempotent, so an
 * unchanged result fans no broadcast.
 */
export async function recomputeDesktopLiveStatus(): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  if (!workspaceId) return; // no active workspace yet — nothing to aggregate

  let runs: Awaited<ReturnType<typeof listWorkflowRunCaches>>;
  try {
    runs = await listWorkflowRunCaches(workspaceId);
  } catch (err) {
    // Storage read failure — leave the pill alone. The next refresh
    // dispatch re-fires this off the resulting cache write.
    logger.warn(LOG, `live status recompute read failed: ${(err as Error).message}`);
    return;
  }

  if (runs.length === 0) {
    reportStatus({ subsystem: 'live', state: 'green', message: 'No workflows configured' });
    return;
  }

  let red = 0;
  let yellow = 0;
  let firstRed: string | undefined;
  let firstYellow: string | undefined;
  const now = Date.now();
  for (const run of runs) {
    if (run.consecutiveFailures >= RED_FAILURE_THRESHOLD) {
      red++;
      firstRed ??= run.workflowUid;
      continue;
    }
    if (run.consecutiveFailures > 0 || !run.lastExtractorOk) {
      yellow++;
      firstYellow ??= run.workflowUid;
      continue;
    }
    // Stale beyond 2× the cadence window — the cadence loop should have
    // re-warmed it; that it hasn't is worth a yellow nudge. Never-run
    // rows (`extractedAt === 0`) and no-expiry policies are exempt.
    if (run.expiresAt != null && run.extractedAt > 0) {
      const window = run.expiresAt - run.extractedAt;
      if (window > 0 && now - run.extractedAt > 2 * window) {
        yellow++;
        firstYellow ??= run.workflowUid;
      }
    }
  }

  if (red > 0) {
    reportStatus({
      subsystem: 'live',
      state: 'red',
      message: `${red} workflow${red === 1 ? '' : 's'} failing (${RED_FAILURE_THRESHOLD}+ consecutive)`,
      context: { red, yellow, firstRed },
    });
    return;
  }
  if (yellow > 0) {
    reportStatus({
      subsystem: 'live',
      state: 'yellow',
      message: `${yellow} workflow${yellow === 1 ? '' : 's'} stale or failing`,
      context: { yellow, firstYellow },
    });
    return;
  }
  reportStatus({
    subsystem: 'live',
    state: 'green',
    message: `${runs.length} workflow${runs.length === 1 ? '' : 's'} fresh`,
    context: { fresh: runs.length },
  });
}
