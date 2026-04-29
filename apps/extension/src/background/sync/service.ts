/**
 * Sync service — singleton lifecycle around {@link EntityOracle} for the
 * SW background context (Phase A foundation).
 *
 * Responsibilities (all per-workspace):
 *   1. Construct the {@link EntityOracle} with production-wired
 *      dependencies — IDB-backed mutation log + pending intents, the
 *      lock adapter that reuses the existing per-entity Web Lock, and
 *      an in-memory broadcast bus.
 *   2. Mint an SW-side HLC sequencer + `MutatorContext` factory
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

import type {
  AwarenessPublishRequest,
  AwarenessPublishResponse,
  AwarenessState,
  SyncApplyRequest,
  SyncApplyResponse,
  SyncBroadcastEvent,
  SyncEnvironmentPostState,
  SyncRulePostState,
} from '@openheaders/core/protocol';
import { ENVIRONMENT_ENTITY_TYPE, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { broadcast as bridgeBroadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { scheduleUpdate } from '@/background/modules/rule-engine';
import { type AwarenessStore, createAwarenessStore } from './awareness';
import { handleAwarenessPublish } from './awareness-bridge';
import { type BroadcastProjector, composeProjectors, handleSyncApply, wireBroadcastToSink } from './bridge';
import { createDnrIntentRunner, type DnrIntentRunner } from './dnr-intent-runner';
import { projectEnvironmentByUid, projectEnvironmentPostState } from './env-post-state';
import {
  createEnvironmentCache,
  type EnvironmentCache,
  setActiveEnvironmentCache,
} from './environment-cache';
import { projectRuleByUid, projectRulePostState } from './rule-post-state';
import { InMemoryBroadcast } from './broadcast';
import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { ruleOracleLockAcquirer } from './lock-adapter';
import { InMemoryMutationLog, type MutationLog } from './mutation-log';
import { type LockAcquirer, EntityOracle } from './oracle';
import { InMemoryPendingIntents, type PendingIntents } from './pending-intents';
import { createRuleCache, type RuleCache, setActiveRuleCache } from './rule-cache';
import { createSwContextHandle, type SwContextHandle } from './sw-context';

interface ServiceState {
  workspaceId: string;
  oracle: EntityOracle;
  broadcast: InMemoryBroadcast;
  ruleCache: RuleCache;
  envCache: EnvironmentCache;
  context: SwContextHandle;
  awareness: AwarenessStore;
  dnrRunner: DnrIntentRunner;
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

  const oracle = new EntityOracle({
    workspaceId,
    lock: ruleOracleLockAcquirer,
    log,
    intents,
    broadcast,
  });

  const ruleCache = createRuleCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveRuleCache(ruleCache);

  const envCache = createEnvironmentCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveEnvironmentCache(envCache);

  // DNR intent runner — subscribes AFTER the cache so by the time the
  // runner asks rule-engine to recompile, the rule mirror already
  // reflects post-commit state.
  const dnrRunner = createDnrIntentRunner({
    broadcast,
    intents,
    recompile: (reason) => scheduleUpdate(reason, { immediate: false }),
  });

  const awareness = createAwarenessStore({
    workspaceId,
    emit: (presence) => {
      bridgeBroadcast('awarenessBroadcast', { workspaceId, presence });
    },
  });

  // Re-publish every committed `(envelope, outcome)` to subscribed
  // surfaces via the existing chrome.runtime broadcast bus. The
  // per-entity projectors read post-commit state so renderer mirrors
  // stay in lockstep with the oracle without round-tripping; new
  // entity types extend the registry by registering their own
  // projector here.
  const ruleProjector: BroadcastProjector = (envelope) => {
    const rulePostState = projectRulePostState(oracle, envelope);
    return rulePostState ? { rulePostState } : null;
  };
  const envProjector: BroadcastProjector = (envelope) => {
    const environmentPostState = projectEnvironmentPostState(oracle, envelope);
    return environmentPostState ? { environmentPostState } : null;
  };
  const projector = composeProjectors(ruleProjector, envProjector);
  const unsubscribeBroadcast = wireBroadcastToSink(
    broadcast,
    (event: SyncBroadcastEvent) => {
      bridgeBroadcast('syncBroadcast', {
        envelope: event.envelope,
        outcome: event.outcome,
        batchId: event.batchId,
        ...(event.rulePostState ? { rulePostState: event.rulePostState } : {}),
        ...(event.environmentPostState ? { environmentPostState: event.environmentPostState } : {}),
      });
    },
    projector,
  );

  state = {
    workspaceId,
    oracle,
    broadcast,
    ruleCache,
    envCache,
    context,
    awareness,
    dnrRunner,
    unsubscribeBroadcast,
  };
  logger.info(
    'SyncService',
    `Initialized for workspace ${workspaceId} (entity=${RULE_ENTITY_TYPE}, nodeId=${context.nodeId})`,
  );
}

/** Tear down the active service — used on workspace switch + on shutdown. */
export function dispose(): void {
  if (!state) return;
  state.unsubscribeBroadcast();
  state.dnrRunner.dispose();
  state.ruleCache.dispose();
  state.envCache.dispose();
  state.awareness.dispose();
  setActiveRuleCache(null);
  setActiveEnvironmentCache(null);
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
export function getOracleForCurrentWorkspace(): EntityOracle | null {
  return state?.oracle ?? null;
}

/**
 * Snapshot every Rule the active oracle holds — `(rule, setItemIds)`
 * per uid, the same shape `BroadcastProjector` attaches to live
 * envelopes. Renderer surfaces call this on mount via the
 * `oh.sync.snapshotRules` RPC so their local mirror has a starting
 * view before the next broadcast arrives. Returns `{ entries: [] }`
 * when the service isn't initialized — the renderer treats that as
 * "no snapshot yet" and falls back to broadcast-only seeding.
 */
export function snapshotRulePostStates(): SyncRulePostState[] {
  if (!state) return [];
  const oracle = state.oracle;
  const out: SyncRulePostState[] = [];
  for (const materialized of oracle.materializeAll()) {
    if (materialized.type !== RULE_ENTITY_TYPE) continue;
    const projection = projectRuleByUid(oracle, materialized.id);
    if (projection) out.push(projection);
  }
  return out;
}

/**
 * Snapshot every Environment the active oracle holds. Same shape the
 * `BroadcastProjector` attaches to live envelopes; consumed by the
 * `oh.sync.snapshotEnvironments` RPC for renderer mirror bootstrap.
 * Returns `[]` when the service isn't initialized.
 */
export function snapshotEnvironmentPostStates(): SyncEnvironmentPostState[] {
  if (!state) return [];
  const oracle = state.oracle;
  const out: SyncEnvironmentPostState[] = [];
  for (const materialized of oracle.materializeAll()) {
    if (materialized.type !== ENVIRONMENT_ENTITY_TYPE) continue;
    const projection = projectEnvironmentByUid(oracle, materialized.id);
    if (projection) out.push(projection);
  }
  return out;
}

/**
 * Apply an awareness publish from a renderer surface. Returns the
 * post-GC presence so the caller's local mirror has an immediate
 * synchronous answer; the subsequent `awarenessBroadcast` carries the
 * same shape to every other surface. Cross-workspace publishes (a
 * renderer that hasn't observed an active-workspace switch yet) drop
 * to an empty presence list rather than throwing — the renderer's
 * mirror clears the entry.
 */
export function publishAwareness(request: AwarenessPublishRequest): AwarenessPublishResponse {
  return handleAwarenessPublish(
    (workspaceId) => (state && state.workspaceId === workspaceId ? state.awareness : null),
    request,
  );
}

/**
 * Direct accessor for SW-internal consumers (e.g. tests). Returns null
 * when the service isn't initialized or the requested workspace isn't
 * the active one.
 */
export function getAwarenessStoreForCurrentWorkspace(): AwarenessStore | null {
  return state?.awareness ?? null;
}

/**
 * Snapshot the canonical presence list — used by renderer surfaces on
 * mount so they have a starting view before the next publish/broadcast.
 */
export function snapshotAwarenessPresence(): AwarenessState[] {
  return state?.awareness.list() ?? [];
}

/**
 * Mint a fresh `MutatorContext` from the SW's HLC sequencer. Used
 * by SW-internal callers (rule-store, hydration) — surfaces hosted in
 * a renderer mint their own contexts with their own nodeId.
 */
export function nextSwMutatorContext(opts?: Parameters<SwContextHandle['next']>[0]): import('@openheaders/core/sync').MutatorContext | null {
  return state?.context.next(opts) ?? null;
}

// ── Test-only entry point ────────────────────────────────────────────

export interface SyncServiceTestDeps {
  log?: MutationLog;
  intents?: PendingIntents;
  lock?: LockAcquirer;
  /** Recompile shim for tests that want to assert "the runner asked
   *  for a recompile" without booting the real DNR layer. Defaults to
   *  a no-op. */
  recompile?: (reason: string) => void;
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

  const oracle = new EntityOracle({ workspaceId, lock, log, intents, broadcast });
  const ruleCache = createRuleCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveRuleCache(ruleCache);
  const envCache = createEnvironmentCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveEnvironmentCache(envCache);

  const dnrRunner = createDnrIntentRunner({
    broadcast,
    intents,
    recompile: deps.recompile ?? (() => {}),
  });

  const awareness = createAwarenessStore({
    workspaceId,
    emit: () => {
      // No chrome.runtime sink in tests.
    },
  });

  state = {
    workspaceId,
    oracle,
    broadcast,
    ruleCache,
    envCache,
    context,
    awareness,
    dnrRunner,
    unsubscribeBroadcast: () => {
      // No chrome.runtime sink in tests.
    },
  };
}
