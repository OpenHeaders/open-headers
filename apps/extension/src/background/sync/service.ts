/**
 * Sync service — singleton lifecycle around {@link RuleOracle} for the
 * SW background context (Phase A foundation, Option A scope).
 *
 * What it owns:
 *   1. The active workspace's {@link RuleOracle}, with production-wired
 *      dependencies: IDB-backed mutation log, IDB-backed pending
 *      intents, an in-memory broadcast bus, and the lock adapter that
 *      reuses the existing per-entity Web Lock plumbing.
 *   2. The bridge subscription that re-publishes oracle broadcasts as
 *      cross-context `syncBroadcast` events so renderer surfaces can
 *      ack + replay.
 *
 * What it explicitly does NOT do (yet):
 *   • Seed the oracle's in-memory store from `rule-store.ts`
 *     snapshots. While legacy write paths (`updateRule`, `toggleRule`,
 *     etc.) still bypass the oracle, any hydration we did at boot
 *     would go stale on the next legacy write, then mislead the first
 *     mutation that does flow through. Hydration is a W1 concern: the
 *     write-site flip will lazy-seed from the current rule-store row
 *     when it routes a mutation, and once every Rule write site flips
 *     the staleness window closes.
 *   • Persist materialized snapshots back to `chrome.storage.local`.
 *     Same reason — the persistence-sink listener is meaningless until
 *     the oracle actually has data flowing through it.
 *
 * Until W1 lands the service is therefore dormant: it accepts the
 * `oh.sync.apply` RPC, runs it against an empty store, and broadcasts
 * outcomes for any envelope it receives. No production write surface
 * calls the RPC yet, so the dormancy is correct — we're paying the
 * boot cost (open IDB connections, register one chrome.runtime
 * listener) so W1 has nothing to wire when it lands.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { SyncApplyRequest, SyncApplyResponse } from '@openheaders/core/protocol';
import { broadcast as bridgeBroadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { handleSyncApply, wireBroadcastToSink } from './bridge';
import { InMemoryBroadcast } from './broadcast';
import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { ruleOracleLockAcquirer } from './lock-adapter';
import { RuleOracle } from './oracle';

/**
 * Snapshot of the live service state. Held in a closure so callers
 * never see a partially-constructed instance — `init` resolves only
 * after every dependency is wired.
 */
interface ServiceState {
  workspaceId: string;
  oracle: RuleOracle;
  broadcast: InMemoryBroadcast;
  unsubscribeBroadcast: () => void;
}

let state: ServiceState | null = null;

/**
 * Initialize the sync service for `workspaceId`. Idempotent for the
 * same workspace; switching workspaces should call {@link dispose}
 * first (or use {@link reinitForWorkspace}). Safe to call before any
 * UI surface is open — the IDB connections it opens are lazy and the
 * broadcast subscription is a no-op until something publishes.
 */
export function initSyncService(workspaceId: string): void {
  if (state?.workspaceId === workspaceId) return;
  if (state) dispose();

  const log = new IdbMutationLog(workspaceId);
  const intents = new IdbPendingIntents(workspaceId);
  const broadcast = new InMemoryBroadcast();

  const oracle = new RuleOracle({
    workspaceId,
    lock: ruleOracleLockAcquirer,
    log,
    intents,
    broadcast,
  });

  // Re-publish every committed `(envelope, outcome)` to subscribed
  // surfaces via the existing chrome.runtime broadcast bus. We pipe
  // `SyncBroadcastEvent` straight through to a typed
  // `bridge.broadcast('syncBroadcast', …)` call — the renderer
  // subscribes once and gets every workspace's events. (Workspace
  // scoping is implicit: only one workspace's oracle is live at a
  // time, and any envelope carries `workspaceId` for surfaces that
  // still need to filter — e.g., a popup that hasn't yet observed the
  // workspace switch.)
  const unsubscribeBroadcast = wireBroadcastToSink(broadcast, (event) => {
    bridgeBroadcast('syncBroadcast', {
      envelope: event.envelope,
      outcome: event.outcome,
      batchId: event.batchId,
    });
  });

  state = { workspaceId, oracle, broadcast, unsubscribeBroadcast };
  logger.info('SyncService', `Initialized for workspace ${workspaceId} (entity=${RULE_ENTITY_TYPE})`);
}

/** Tear down the active service — used on workspace switch + on shutdown. */
export function dispose(): void {
  if (!state) return;
  state.unsubscribeBroadcast();
  logger.info('SyncService', `Disposed (workspace ${state.workspaceId})`);
  state = null;
}

/**
 * Re-initialize for a new workspace in one call. Wraps the dispose +
 * init pair so background.ts doesn't need to reach into both.
 */
export function reinitForWorkspace(workspaceId: string): void {
  dispose();
  initSyncService(workspaceId);
}

/**
 * Apply a `SyncApplyRequest` against the active oracle. Throws if the
 * service hasn't been initialized — that would mean a renderer beat
 * boot, which `background.ts` orders to avoid.
 */
export function applySyncRequest(request: SyncApplyRequest): Promise<SyncApplyResponse> {
  if (!state) {
    throw new Error('SyncService.applySyncRequest called before init');
  }
  return handleSyncApply(state.oracle, request);
}

/**
 * Direct oracle access for in-process consumers (W-series write-site
 * conversions land seeding + persistence-sink wiring against this
 * handle). Returns null when uninitialized so callers in alarm
 * dispatch paths don't crash on cold-wake races.
 */
export function getOracleForCurrentWorkspace(): RuleOracle | null {
  return state?.oracle ?? null;
}
