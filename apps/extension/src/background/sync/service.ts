/**
 * Sync service — singleton lifecycle around {@link RuleOracle} for the
 * SW background context (Phase A foundation).
 *
 * Responsibilities (all per-workspace):
 *   1. Construct the {@link RuleOracle} with production-wired
 *      dependencies — IDB-backed mutation log + pending intents, the
 *      lock adapter that reuses the existing per-entity Web Lock, and
 *      an in-memory broadcast bus.
 *   2. Mint an SW-side HLC sequencer + `RuleMutatorContext` factory
 *      ({@link sw-context.ts}) — every mutation emitted from the
 *      background context (boot-time hydration, SW-internal write
 *      paths) carries a context built from this factory.
 *   3. Construct the per-workspace {@link RuleCache} ({@link rule-cache.ts}),
 *      register it as the active cache so `rule-store.ts` reads route
 *      to it, and wire its broadcast subscription against the oracle's
 *      bus so every committed envelope re-projects + persists.
 *   4. Pipe oracle broadcasts onto the `chrome.runtime` `syncBroadcast`
 *      channel so renderer surfaces can ack + replay.
 *
 * Workspace switch: {@link reinitForWorkspace} disposes the current
 * cache (drops the broadcast subscription, clears active-cache
 * pointer), then re-runs init for the new workspace. The IDB stores
 * are workspace-prefixed at the PK level so they can stay shared
 * across workspaces — only the in-memory state belongs to one
 * workspace at a time.
 */

import type { SyncApplyRequest, SyncApplyResponse } from '@openheaders/core/protocol';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { broadcast as bridgeBroadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { handleSyncApply, wireBroadcastToSink } from './bridge';
import { InMemoryBroadcast } from './broadcast';
import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { ruleOracleLockAcquirer } from './lock-adapter';
import { InMemoryMutationLog, type MutationLog } from './mutation-log';
import { type LockAcquirer, RuleOracle } from './oracle';
import { InMemoryPendingIntents, type PendingIntents } from './pending-intents';
import { createRuleCache, type RuleCache, setActiveRuleCache } from './rule-cache';
import { createSwContextHandle, type SwContextHandle } from './sw-context';

interface ServiceState {
  workspaceId: string;
  oracle: RuleOracle;
  broadcast: InMemoryBroadcast;
  cache: RuleCache;
  context: SwContextHandle;
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
  const context = createSwContextHandle(workspaceId);

  const oracle = new RuleOracle({
    workspaceId,
    lock: ruleOracleLockAcquirer,
    log,
    intents,
    broadcast,
  });

  const cache = createRuleCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveRuleCache(cache);

  // Re-publish every committed `(envelope, outcome)` to subscribed
  // surfaces via the existing chrome.runtime broadcast bus.
  const unsubscribeBroadcast = wireBroadcastToSink(broadcast, (event) => {
    bridgeBroadcast('syncBroadcast', {
      envelope: event.envelope,
      outcome: event.outcome,
      batchId: event.batchId,
    });
  });

  state = { workspaceId, oracle, broadcast, cache, context, unsubscribeBroadcast };
  logger.info(
    'SyncService',
    `Initialized for workspace ${workspaceId} (entity=${RULE_ENTITY_TYPE}, nodeId=${context.nodeId})`,
  );
}

/** Tear down the active service — used on workspace switch + on shutdown. */
export function dispose(): void {
  if (!state) return;
  state.unsubscribeBroadcast();
  state.cache.dispose();
  setActiveRuleCache(null);
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
 * Direct oracle access for SW-internal consumers (rule-store's write
 * path emits mutations through this rather than the bridge layer —
 * they're already in-process). Returns null when the service hasn't
 * been initialized so alarm dispatch paths don't crash on cold-wake
 * races.
 */
export function getOracleForCurrentWorkspace(): RuleOracle | null {
  return state?.oracle ?? null;
}

/**
 * Mint a fresh `RuleMutatorContext` from the SW's HLC sequencer. Used
 * by SW-internal callers (rule-store, hydration) — surfaces hosted in
 * a renderer mint their own contexts with their own nodeId.
 */
export function nextSwMutatorContext(opts?: Parameters<SwContextHandle['next']>[0]): import('@openheaders/core/sync').RuleMutatorContext | null {
  return state?.context.next(opts) ?? null;
}

// ── Test-only entry point ────────────────────────────────────────────

export interface SyncServiceTestDeps {
  log?: MutationLog;
  intents?: PendingIntents;
  lock?: LockAcquirer;
}

/**
 * Initialize the service with in-memory dependencies. Skips IDB +
 * chrome.runtime broadcast wiring so tests don't need fake-indexeddb
 * or a chrome bridge fixture. The cache + oracle + broadcast bus are
 * the real production classes — only the persistence + lock
 * adapters are swapped.
 */
export function __initSyncServiceForTests(workspaceId: string, deps: SyncServiceTestDeps = {}): void {
  if (state) dispose();

  const log = deps.log ?? new InMemoryMutationLog();
  const intents = deps.intents ?? new InMemoryPendingIntents();
  const lock: LockAcquirer = deps.lock ?? ((_ws, _t, _id, fn) => Promise.resolve().then(fn));
  const broadcast = new InMemoryBroadcast();
  const context = createSwContextHandle(workspaceId);

  const oracle = new RuleOracle({ workspaceId, lock, log, intents, broadcast });
  const cache = createRuleCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveRuleCache(cache);

  state = {
    workspaceId,
    oracle,
    broadcast,
    cache,
    context,
    unsubscribeBroadcast: () => {
      // No chrome.runtime sink in tests.
    },
  };
}
