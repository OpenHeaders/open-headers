/**
 * Node-host Activity Feed installer — Phase C F2.
 *
 * Mirror of {@link apps/extension/src/background/sync-activity-installer.ts}
 * for Node hosts (desktop main, standalone daemon). Wires the oracle's
 * `broadcastSyncEvent` host hook to the SQLite-backed activity log so
 * host-side broadcasts feed the same workspace-wide feed the extension
 * SW already populates.
 *
 * Two transports, one log per host:
 *
 *   1. Per envelope the local oracle commits, the host hook in
 *      the boot spine forwards the event to
 *      {@link observeForActivityFeed}.
 *   2. The observer asks {@link classifyEnvelopeForActivity} for one or
 *      more {@link ActivityEntry} rows (gated on inbound + applied);
 *      each row is appended to the installed {@link ActivityLog} and
 *      every registered subscriber receives the entry synchronously.
 *
 * Inbound detection rides the same wire-side seen-set the extension uses
 * (`hasRecentlyApplied`) — the mutation-stream bridge sets it for every
 * envelope routed from a peer over the WS server. Local-emit envelopes
 * never enter the set and are skipped by the classifier — with one
 * exception: MCP-minted envelopes (`origin.surfaceId === MCP_SURFACE_ID`)
 * are an agent surface, so they classify into the feed like a peer's
 * (the MCP write path captures their priors + inverses so Revert works).
 *
 * Append is fire-and-forget so apply latency is unaffected by SQLite
 * latency; a failed write is logged but never crashes the apply path.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { type ActivityEntry, activityEntryId } from '@openheaders/core/sync';
import {
  type ActivityLog,
  classifyEnvelopeForActivity,
  consumePriorForMutation,
  ensureMutesLoaded,
  getOracleForWorkspace,
  hasRecentlyApplied,
  isMutedForActivityFeed,
  type OracleSyncBroadcastEvent,
} from '@openheaders/oracle/sync';
import { nextSwMutatorContextForWorkspace } from '@openheaders/oracle/sync/service';
import { MCP_SURFACE_ID } from '../mcp';

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
  // Feed-worthy = wire-delivered from a peer OR minted by the MCP agent
  // surface. Both are "someone other than this window's user changed the
  // workspace"; both carry bridge-captured priors for classification.
  const isInbound = hasRecentlyApplied(event.envelope.mutationId) || event.envelope.origin.surfaceId === MCP_SURFACE_ID;
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

/** One successful agent read through the MCP `observe` tier. */
export interface AgentObservationInput {
  workspaceId: string;
  toolName: string;
  tokenId: string;
  tokenLabel?: string;
  userId: string;
  /** The read projected RAW values under the persistent unredacted
   *  session grant (AGENT_TRAFFIC_PLAN.md §11.5) — surfaced on the
   *  feed card so "what did the agent look at" includes "and how". */
  raw?: boolean;
}

/** Disambiguates observe entries minted inside one HLC tick. */
let observeSeq = 0;

/**
 * Land one `observe`-tier read in the Activity Feed
 * (AGENT_TRAFFIC_PLAN.md §4: "a human must be able to answer 'what did
 * the agent look at?' after the fact"). Reads have no envelope, no
 * prior and nothing to revert, so the entry is minted directly rather
 * than through the classifier: the workspace's own context handle
 * supplies the HLC and deviceId, so observe rows order correctly among
 * the mutation rows in the same feed. A workspace that is not loaded
 * on this host drops the entry with a log line — the gate already
 * audited the read on the capability plane.
 */
export function recordAgentObservation(input: AgentObservationInput): void {
  const ctx = nextSwMutatorContextForWorkspace(input.workspaceId, { surfaceId: MCP_SURFACE_ID });
  if (!ctx) {
    logger.info(SCOPE, `observe entry dropped — workspace ${input.workspaceId} not loaded`);
    return;
  }
  const mutationId = `observe-${ctx.hlc.physicalMs}-${ctx.hlc.logical}-${observeSeq++}`;
  const entry: ActivityEntry = {
    id: activityEntryId({ hlc: ctx.hlc, mutationId, kind: 'agent-observe' }),
    workspaceId: input.workspaceId,
    mutationId,
    hlc: ctx.hlc,
    kind: 'agent-observe',
    entityType: 'traffic-observation',
    entityId: input.toolName,
    origin: {
      surfaceId: MCP_SURFACE_ID,
      deviceId: ctx.deviceId,
      userId: input.userId,
    },
    observedAt: clock(),
    read: false,
    summary: input.tokenLabel !== undefined ? `${input.toolName} · ${input.tokenLabel}` : input.toolName,
    context: {
      toolName: input.toolName,
      tokenId: input.tokenId,
      ...(input.tokenLabel !== undefined ? { tokenLabel: input.tokenLabel } : {}),
      ...(input.raw === true ? { raw: true } : {}),
    },
  };

  fanOutToSubscribers(entry);

  if (!activityLog) {
    droppedNoLog += 1;
    if (!loggedNoLogOnce) {
      logger.info(SCOPE, 'no activity log installed; entry dropped');
      loggedNoLogOnce = true;
    }
    return;
  }
  void activityLog.append(entry).catch((err) => {
    logger.warn(SCOPE, 'activity log append failed', err);
  });
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
