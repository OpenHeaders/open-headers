/**
 * Activity Feed installer — Phase C F2.
 *
 * Wires the oracle's `broadcastSyncEvent` hook to the workspace-wide
 * Activity Feed:
 *
 *   1. The oracle calls `broadcastSyncEvent` per committed envelope
 *      (see `background.ts`).
 *   2. The hook forwards the event to {@link observeForActivityFeed}.
 *   3. The observer asks {@link classifyEnvelopeForActivity} for one
 *      or more {@link ActivityEntry} rows (gated on inbound + applied);
 *      each row is appended to the installed {@link ActivityLog}.
 *
 * Pattern mirrors {@link sync-mutation-forwarder}: the queue is
 * installed once at boot, the observer is fire-and-forget (so apply
 * latency is unaffected by IDB latency), and a single failed write
 * is logged but never crashes the apply path.
 *
 * Inbound detection rides the existing wire-side seen-set: an
 * envelope is "inbound" iff
 * {@link hasRecentlyApplied}(`mutationId`) returns true — the
 * mutation-stream bridge sets that bit for every envelope it routes
 * from a peer over the wire. Local-emit envelopes never enter the
 * set and therefore never appear in the feed.
 */

import { classifyEnvelopeForActivity, type ActivityLog, type OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';

import { logger } from '@utils/logger';
import { hasRecentlyApplied } from './sync-mutation-receiver';

const SCOPE = 'SyncActivity';

let activityLog: ActivityLog | null = null;
let loggedNoLogOnce = false;
let droppedNoLog = 0;
let clock: () => number = () => Date.now();

/**
 * Install the activity log. Called once during boot wiring after the
 * persistence provider has been chosen (IDB on the extension SW).
 * Without this, the observer counts drops for telemetry.
 */
export function setActivityLog(log: ActivityLog | null): void {
  activityLog = log;
}

/** Test seam — swap the wall-clock source. */
export function setActivityClockForTests(now: () => number): void {
  clock = now;
}

/**
 * Observe one committed envelope. Synchronous entry point that
 * dispatches the IDB writes fire-and-forget. Safe to call before
 * {@link setActivityLog}; entries are dropped + counted in that
 * window.
 */
export function observeForActivityFeed(event: OracleSyncBroadcastEvent): void {
  const entries = classifyEnvelopeForActivity({
    envelope: event.envelope,
    outcome: event.outcome,
    isInbound: hasRecentlyApplied(event.envelope.mutationId),
    observedAt: clock(),
  });
  if (entries.length === 0) return;

  if (!activityLog) {
    droppedNoLog += entries.length;
    if (!loggedNoLogOnce) {
      logger.info(SCOPE, 'no activity log installed; entry dropped');
      loggedNoLogOnce = true;
    }
    return;
  }

  const log = activityLog;
  for (const entry of entries) {
    void log.append(entry).catch((err) => {
      logger.warn(SCOPE, 'activity log append failed', err);
    });
  }
}

/** Test-only — entries dropped because no log was installed. */
export function __getDroppedNoLogCount(): number {
  return droppedNoLog;
}

/** Test-only — reset internal state between cases. */
export function __resetActivityInstallerForTests(): void {
  activityLog = null;
  droppedNoLog = 0;
  loggedNoLogOnce = false;
  clock = () => Date.now();
}
