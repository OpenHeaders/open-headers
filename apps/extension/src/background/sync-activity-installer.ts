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
 *      each row is appended to the installed {@link ActivityLog} and
 *      every registered subscriber receives the entry synchronously
 *      (status reporter, future panel mirror).
 *
 * Pattern mirrors {@link sync-mutation-forwarder}: the log is installed
 * once at boot, the observer is fire-and-forget for the IDB write (so
 * apply latency is unaffected by IDB latency), and a single failed
 * write is logged but never crashes the apply path.
 *
 * Inbound detection rides the existing wire-side seen-set: an envelope
 * is "inbound" iff {@link hasRecentlyApplied}(`mutationId`) returns
 * true — the mutation-stream bridge sets that bit for every envelope
 * it routes from a peer over the wire. Local-emit envelopes never
 * enter the set and therefore never appear in the feed.
 */

import type { ActivityEntry } from '@openheaders/core/sync';
import { classifyEnvelopeForActivity, type ActivityLog, type OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';

import { logger } from '@utils/logger';
import { hasRecentlyApplied } from './sync-mutation-receiver';

const SCOPE = 'SyncActivity';

let activityLog: ActivityLog | null = null;
let loggedNoLogOnce = false;
let droppedNoLog = 0;
let clock: () => number = () => Date.now();

const subscribers = new Set<(entry: ActivityEntry) => void>();

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
 * Subscribe to classified entries — fired synchronously per entry
 * before the IDB append is dispatched. Used by the Status reporter
 * (F3) to pulse on every inbound and bump the unread badge without
 * polling the log. Returns an unsubscribe.
 *
 * Listeners run inside `observeForActivityFeed`; throwing from one
 * listener does not block the others or the log append — the observer
 * logs and continues.
 */
export function subscribeActivityEntries(listener: (entry: ActivityEntry) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Snapshot the unread count for `workspaceId`. Returns 0 when no log
 * is installed (e.g. the very first boot before
 * `getSyncPersistenceProvider().createActivityLog?.()` returns).
 * Used by the Status reporter on workspace switch to re-baseline the
 * badge without re-reading every entry.
 */
export async function countUnreadActivityEntries(workspaceId: string): Promise<number> {
  if (!activityLog) return 0;
  return activityLog.countUnread(workspaceId);
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

  for (const entry of entries) {
    fanOutToSubscribers(entry);
  }

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

function fanOutToSubscribers(entry: ActivityEntry): void {
  for (const listener of subscribers) {
    try {
      listener(entry);
    } catch (err) {
      logger.warn(SCOPE, 'activity subscriber threw', err);
    }
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
  subscribers.clear();
}
