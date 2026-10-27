/**
 * Sync service — service construction: the production dependency
 * factory and the shared `buildService` wiring (oracle, caches,
 * broadcast bridge, awareness, the log replay and the cache passes
 * behind the `hydrated` gate).
 */

import { LIVE_VALUE_ENTITY_TYPE, OAUTH_BUNDLE_ENTITY_TYPE, VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import { getOracleHostHooks } from '@openheaders/oracle/sync';
import { createAwarenessStore } from '../awareness/awareness';
import { wireBroadcastToSink } from '../bridge';
import { InMemoryBroadcast } from '../broadcast';
import { createTreeOrderCache } from '../caches/tree-order-cache';
import {
  buildLocalWriteValidator,
  buildProjectorPipeline,
  buildSchemaRegistry,
  type EntityCacheLike,
  type EntityRegistration,
  FOLDER_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  TEMPLATE_FOLDER_REGISTRATION,
  WORKSPACE_REGISTRY,
} from '../entity-registry';
import { hydrateOracleFromLog } from '../hydrate-from-log';
import { ruleOracleLockAcquirer } from '../lock-adapter';
import { EntityOracle } from '../oracle';
import { createSwContextHandle } from '../sw-context';
import { getSyncPersistenceProvider } from '../sync-persistence-provider';
import { createTreeSlotReconciler } from '../tree-slot-reconciler';
import type { WireDeps, WorkspaceServiceState } from './types';

export function productionDepsFactory(workspaceId: string): WireDeps {
  const persistence = getSyncPersistenceProvider();
  return {
    workspaceId,
    log: persistence.createMutationLog(workspaceId),
    intents: persistence.createPendingIntents(workspaceId),
    lock: ruleOracleLockAcquirer,
    recompile: (reason) => getOracleHostHooks().scheduleRuleEngineUpdate?.(reason),
    sink: (event) => getOracleHostHooks().broadcastSyncEvent?.(event),
    awarenessSink: (presence) => getOracleHostHooks().broadcastAwareness?.({ workspaceId, presence }),
  };
}

/**
 * Build the full service state — production and test paths share this
 * factory so the wiring can never drift between them. Side-effect
 * runners and the awareness store are the only pieces with shape that
 * changes between scopes; everything else is pulled from
 * `WORKSPACE_REGISTRY`.
 *
 * Caches are constructed and subscribed to the workspace's broadcast
 * bus and live on {@link WorkspaceServiceState.caches} for the full
 * residency of the workspace. SW-internal consumers reach for the
 * runtime-Active workspace's cache through
 * {@link getActiveCacheForRegistration}; non-Active workspaces still
 * keep their caches warm so per-workspace persistence keeps flowing
 * through every workspace's broadcast bus.
 */
export function buildService(deps: WireDeps): WorkspaceServiceState {
  const broadcast = new InMemoryBroadcast();
  const context = createSwContextHandle(deps.workspaceId);
  const oracle = new EntityOracle({
    workspaceId: deps.workspaceId,
    lock: deps.lock,
    log: deps.log,
    intents: deps.intents,
    broadcast,
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
    validateLocalWrite: buildLocalWriteValidator(WORKSPACE_REGISTRY),
    // Fold every committed batch's max HLC into the sequencer so the
    // next mint strictly exceeds the batch's ticked envelopes.
    onBatchApplied: (hlc) => context.observe(hlc),
  });

  // Build caches via the registry's createCache. Each cache is owned
  // exclusively by this service state; lookups for the runtime-Active
  // workspace's cache go through `getActiveCacheForRegistration`.
  const caches: EntityCacheLike[] = WORKSPACE_REGISTRY.map((reg) =>
    reg.createCache(deps.workspaceId, oracle, broadcast, () => context.next()),
  );
  // Path-derived slot reconciliation rides the same bus as a cache; it
  // is appended AFTER the registry's caches so registry-index lookups
  // (`getActiveCacheForRegistration`) stay aligned.
  const treeSlots = createTreeSlotReconciler(deps.workspaceId, oracle, broadcast, () => context.next());
  caches.push(treeSlots);
  // The per-container order record the reconciler's hydration pass
  // reads back; written from the live sets on every containment write.
  const treeOrder = createTreeOrderCache(deps.workspaceId, oracle, broadcast);
  caches.push(treeOrder);

  const awareness = createAwarenessStore({
    workspaceId: deps.workspaceId,
    emit: deps.awarenessSink,
    // Vault + OAuth bundles + live values are §12.1 schema-marked
    // sensitive — entity-level awareness only; per-secret-name /
    // per-credentialRef / per-run-key presence would leak the secret
    // namespace and access patterns (§14.4).
    sensitiveEntityTypes: new Set<string>([VAULT_ENTITY_TYPE, OAUTH_BUNDLE_ENTITY_TYPE, LIVE_VALUE_ENTITY_TYPE]),
  });

  // Bridge multi-broadcast aggregator: every resident workspace's
  // broadcast bus feeds chrome.runtime via its own subscription. The
  // aggregator IS the per-service `wireBroadcastToSink` call below —
  // there's no separate aggregator module because each service holds
  // its own subscription bookkeeping. Renderer mirrors filter by
  // `event.workspaceId` (commit 2) to dispatch to the right mirror.
  const projector = buildProjectorPipeline(oracle, WORKSPACE_REGISTRY);
  const unsubscribeBroadcast = wireBroadcastToSink(broadcast, deps.sink, projector);

  // Boot by replay: the scope's durable log is the source of truth, and
  // the oracle holds its replayed state before any cache looks at it.
  // Each cache then re-projects from the oracle and persists its
  // projection — the `oh.ws.<id>.*` keys are the write-through cache —
  // and migrates its stored projection into the log exactly once when
  // the log holds no row of its entity type (a profile from before the
  // log was the boot source). A migration mints real commits, so the
  // passes run one cache at a time (each commit folds its HLC into the
  // sequencer before the next cache mints, so no two batches share an
  // HLC), and a folder's commit resolves its collection parent from the
  // oracle, so the collection caches finish before the folder caches
  // start; over a hydrated log every pass is a synchronous re-projection
  // and appends nothing. The tree slot reconciler's hydration pass runs
  // after them as a permanent reconciliation of slot-less children (it
  // mints only when it heals), then the order cache arms. The `hydrated`
  // promise resolves after all of it, and every reader of the oracle or
  // its log awaits it — including a handshake's state-vector read, which
  // therefore appends nothing.
  const folderRegistrations = new Set<EntityRegistration>([
    FOLDER_REGISTRATION,
    REQUEST_FOLDER_REGISTRATION,
    TEMPLATE_FOLDER_REGISTRATION,
  ]);
  const nonFolderCaches: EntityCacheLike[] = [];
  const folderCaches: EntityCacheLike[] = [];
  WORKSPACE_REGISTRY.forEach((reg, idx) => {
    if (folderRegistrations.has(reg)) folderCaches.push(caches[idx]);
    else nonFolderCaches.push(caches[idx]);
  });
  const hydrated = (async () => {
    await hydrateOracleFromLog(oracle, deps.log, 'SyncService', deps.workspaceId);
    for (const cache of nonFolderCaches) await cache.hydrateFromStorage();
    for (const cache of folderCaches) await cache.hydrateFromStorage();
    await treeSlots.hydrateFromStorage();
    await treeOrder.hydrateFromStorage();
  })();

  // Active-bound runners (DNR + resolver-invalidate) are NOT subscribed
  // here. They're built + subscribed by `setRuntimeActive` when this
  // workspace becomes Active and disposed when it stops being Active.
  // Both runners trigger `recompile` (= browser-singular DNR rebuild),
  // so only the Active workspace should drive them.
  return {
    workspaceId: deps.workspaceId,
    hydrated,
    oracle,
    log: deps.log,
    intents: deps.intents,
    broadcast,
    caches,
    context,
    awareness,
    dnrSubscription: null,
    resolverInvalidateSubscription: null,
    recompile: deps.recompile,
    unsubscribeBroadcast,
    refcount: 0,
    disposalTimer: null,
    disposing: false,
  };
}
