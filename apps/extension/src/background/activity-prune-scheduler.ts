/**
 * Extension SW side of Activity Feed auto-decay (Phase C F7).
 *
 * Owns the timer mechanism for the service worker host: a single
 * recurring `chrome.alarms` tick that calls into the host-neutral
 * {@link runActivityPruneSweep} once an hour. The sweep iterates every
 * resident workspace and drops rows older than the retention window.
 *
 * Why chrome.alarms (not setInterval): the SW gets evicted on idle.
 * Alarms survive eviction and wake the SW back up to fire — a
 * setInterval would simply stop after the first eviction and the
 * activity log would grow unbounded.
 *
 * The alarm is registered idempotently — `chrome.alarms.create` with
 * the same name is a no-op when an alarm already exists. The handler
 * delegates to the host-neutral sweep core; this module is pure glue.
 */

import {
  ACTIVITY_PRUNE_DEFAULT_PERIOD_MS,
  runActivityPruneSweep,
  type ActivityLog,
  type ActivityPruneSweepResult,
} from '@openheaders/oracle/sync';
import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';

const SCOPE = 'ActivityPrune';
const ALARM_NAME = 'oh.sync.activity-prune';
const PERIOD_MINUTES = ACTIVITY_PRUNE_DEFAULT_PERIOD_MS / 60_000;

let getLogRef: (() => ActivityLog | null) | null = null;
let listWorkspaceIdsRef: (() => readonly string[]) | null = null;
let nowRef: () => number = () => Date.now();

export interface InstallActivityPruneSchedulerInput {
  /** Resolves to the currently-installed activity log; `null` is tolerated. */
  getLog: () => ActivityLog | null;
  /** Snapshot of every workspace whose log should be swept this tick. */
  listWorkspaceIds: () => readonly string[];
  /** Optional clock override for tests. */
  now?: () => number;
}

/**
 * Register the recurring sweep alarm. Subsequent calls overwrite the
 * wiring (e.g. test teardown reinstalls fresh callbacks).
 */
export function installActivityPruneScheduler(input: InstallActivityPruneSchedulerInput): void {
  getLogRef = input.getLog;
  listWorkspaceIdsRef = input.listWorkspaceIds;
  nowRef = input.now ?? (() => Date.now());
  if (!alarms) return;
  alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MINUTES });
}

/** Cheap predicate routed from the central alarm dispatcher in background.ts. */
export function isActivityPruneAlarm(alarm: chrome.alarms.Alarm): boolean {
  return alarm?.name === ALARM_NAME;
}

/**
 * Run one sweep. Exposed for the alarm dispatcher (production) and tests
 * (direct invocation without going through chrome.alarms). Returns the
 * sweep result so the dispatcher can log totals.
 */
export async function handleActivityPruneAlarm(): Promise<ActivityPruneSweepResult> {
  if (!getLogRef || !listWorkspaceIdsRef) {
    return { cutoffObservedAtMs: nowRef(), perWorkspace: [], totalRemoved: 0 };
  }
  const result = await runActivityPruneSweep({
    log: getLogRef(),
    workspaceIds: listWorkspaceIdsRef(),
    now: nowRef(),
  });
  if (result.totalRemoved > 0) {
    logger.info(SCOPE, `pruned ${result.totalRemoved} expired activity row(s) across ${result.perWorkspace.length} workspace(s)`);
  }
  return result;
}

/** Test-only — drop the registered wiring so the next install starts fresh. */
export function __resetActivityPruneSchedulerForTests(): void {
  getLogRef = null;
  listWorkspaceIdsRef = null;
  nowRef = () => Date.now();
}
