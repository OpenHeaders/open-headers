/**
 * Sync service — service construction: the production dependency
 * factory and the shared `buildService` wiring (oracle, caches,
 * broadcast bridge, awareness, two-phase hydration).
 */

import { LIVE_VALUE_ENTITY_TYPE, OAUTH_BUNDLE_ENTITY_TYPE, VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import { getOracleHostHooks } from '@openheaders/oracle/sync';
import { createAwarenessStore } from '../awareness/awareness';
import { wireBroadcastToSink } from '../bridge';
import { InMemoryBroadcast } from '../broadcast';
import {
  buildProjectorPipeline,
  buildSchemaRegistry,
  type EntityCacheLike,
  type EntityRegistration,
  FOLDER_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  TEMPLATE_FOLDER_REGISTRATION,
  WORKSPACE_REGISTRY,
} from '../entity-registry';
import { ruleOracleLockAcquirer } from '../lock-adapter';
import { EntityOracle } from '../oracle';
import { createSwContextHandle } from '../sw-context';
import { getSyncPersistenceProvider } from '../sync-persistence-provider';
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

  // Hydrate every cache from `chrome.storage.local` (or BlobStore for
  // files; no-op for caches without a durable projection). Folders seed
  // entries that reference collection parents in the oracle, so
  // collection caches must finish hydrating before folder caches start.
  // Two-phase: non-folder caches in parallel, then folder caches in
  // parallel. The `hydrated` promise resolves after both phases finish.
  //
  // Without this, a freshly materialized non-Active workspace service
  // starts with empty caches even though `wsKeys(workspaceId).<key>` has
  // the data on disk — bridge*SyncEngine seeds only the runtime-Active
  // workspace, leaving cross-workspace gestures (manual refresh on a
  // workspace whose tab is open in per-tab mode but is not Active)
  // unable to find their entities. See § 8.7 Session 20 disposition.
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
    await Promise.all(nonFolderCaches.map((c) => c.hydrateFromStorage()));
    await Promise.all(folderCaches.map((c) => c.hydrateFromStorage()));
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
