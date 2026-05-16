/**
 * Desktop main Activity Feed installer — Phase C F2.
 *
 * Mirror of {@link apps/extension/src/background/sync-activity-installer.ts}
 * for the desktop main process. Wires the oracle's `broadcastSyncEvent`
 * host hook to the SQLite-backed activity log so workbench-side broadcasts
 * feed the same workspace-wide feed the extension SW already populates.
 *
 * Two transports, one log per host:
 *
 *   1. Per envelope the local oracle commits, the host hook in
 *      {@link install-rpc-host} forwards the event to
 *      {@link observeForActivityFeed}.
 *   2. The observer asks {@link classifyEnvelopeForActivity} for one or
 *      more {@link ActivityEntry} rows (gated on inbound + applied);
 *      each row is appended to the installed {@link ActivityLog} and
 *      every registered subscriber receives the entry synchronously.
 *
 * Inbound detection rides the same wire-side seen-set the extension uses
 * (`hasRecentlyApplied`) — the mutation-stream bridge sets it for every
 * envelope routed from a peer over the WS server. Local-emit envelopes
 * never enter the set and are skipped by the classifier.
 *
 * Append is fire-and-forget so apply latency is unaffected by SQLite
 * latency; a failed write is logged but never crashes the apply path.
 */

import type { ActivityEntry } from '@openheaders/core/sync';
import {
  classifyEnvelopeForActivity,
  consumePriorForMutation,
  ensureMutesLoaded,
  getOracleForWorkspace,
  hasRecentlyApplied,
  isMutedForActivityFeed,
  type ActivityLog,
  type OracleSyncBroadcastEvent,
} from '@openheaders/oracle/sync';
import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'SyncActivity';

let activityLog: ActivityLog | null = null;
let loggedNoLogOnce = false;
let droppedNoLog = 0;
let clock: () => number = () => Date.now();

const subscribers = new Set<(entry: ActivityEntry) => void>();

/**
 * Install the activity log. Called once during boot wiring after the
 * SQLite sync persistence provider is created. Without this, the
 * observer counts drops for telemetry.
 */
export function setActivityLog(log: ActivityLog | null): void {
  activityLog = log;
}

/** Test seam — swap the wall-clock source. */
export function setActivityClockForTests(now: () => number): void {
  clock = now;
}

/**
 * Subscribe to classified entries — fired synchronously per entry before
 * the SQLite append is dispatched. Used by future status reporters and
 * panel mirrors to pulse on every inbound without polling the log.
 * Returns an unsubscribe.
 *
 * Listeners run inside `observeForActivityFeed`; throwing from one
 * listener does not block the others or the log append.
 */
export function subscribeActivityEntries(listener: (entry: ActivityEntry) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Snapshot the unread count for `workspaceId`. Returns 0 when no log is
 * installed (e.g. the very first boot before
 * `syncPersistence.createActivityLog()` resolves).
 */
export async function countUnreadActivityEntries(workspaceId: string): Promise<number> {
  if (!activityLog) return 0;
  return activityLog.countUnread(workspaceId);
}

/**
 * Observe one committed envelope. Synchronous entry point that
 * dispatches the SQLite writes fire-and-forget. Safe to call before
 * {@link setActivityLog}; entries are dropped + counted in that window.
 */
export function observeForActivityFeed(event: OracleSyncBroadcastEvent): void {
  const isInbound = hasRecentlyApplied(event.envelope.mutationId);
  // Drain the prior unconditionally so it cannot leak when an envelope
  // turns out to be non-inbound or non-applied — the bridge captured it
  // speculatively for every wire-delivered envelope.
  const { prior, inverse } = consumePriorForMutation(event.envelope.mutationId);
  const next = isInbound ? readNextMaterialized(event) : null;
  // Trigger lazy mute-cache hydration on first inbound observation so
  // the synchronous gate below is hot. The promise is fire-and-forget;
  // subsequent envelopes for the same workspace dedup on the cached
  // promise.
  if (isInbound) {
    void ensureMutesLoaded(event.envelope.workspaceId).catch((err: Error) => {
      logger.warn(SCOPE, 'activity mute cache hydrate failed', err);
    });
  }

  const entries = classifyEnvelopeForActivity({
    envelope: event.envelope,
    outcome: event.outcome,
    isInbound,
    observedAt: clock(),
    prior,
    next,
    inverse,
  });
  if (entries.length === 0) return;

  // Drop muted-entity rows before they reach subscribers + log. The
  // panel cannot see them and the badge ignores them; an unmute does
  // NOT resurrect dropped rows — that's by design.
  const filtered = entries.filter(
    (entry) => !isMutedForActivityFeed(entry.workspaceId, entry.entityType, entry.entityId),
  );
  if (filtered.length === 0) return;

  for (const entry of filtered) {
    fanOutToSubscribers(entry);
  }

  if (!activityLog) {
    droppedNoLog += filtered.length;
    if (!loggedNoLogOnce) {
      logger.info(SCOPE, 'no activity log installed; entry dropped');
      loggedNoLogOnce = true;
    }
    return;
  }

  const log = activityLog;
  for (const entry of filtered) {
    void log.append(entry).catch((err) => {
      logger.warn(SCOPE, 'activity log append failed', err);
    });
  }
}

/**
 * Snapshot the post-apply materialized entity. The classifier needs this
 * paired with the bridge-captured prior to detect highlight kinds.
 * Returns `null` for delete envelopes (the entity is tombstoned by apply
 * time) or when no oracle exists yet for the workspace.
 */
function readNextMaterialized(event: OracleSyncBroadcastEvent) {
  const oracle = getOracleForWorkspace(event.envelope.workspaceId);
  if (!oracle) return null;
  return oracle.materializeOne(event.envelope.body.type, event.envelope.body.id);
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
