/**
 * Global-scope sync service — singleton lifecycle around an
 * {@link EntityOracle} dedicated to cross-workspace metadata
 * (`extensionWorkspace` entity, §SYNC_ENGINE_DESIGN.md §8).
 *
 * The per-workspace `service.ts` keys all of its IDB stores +
 * in-memory caches by the active workspace id and is reinit'd on
 * workspace switch — the wrong scope for an entity that lives ABOVE
 * any single workspace. This sibling module hosts a parallel oracle
 * whose `workspaceId` parameter is the sentinel
 * `EXTENSION_WORKSPACE_GLOBAL_SCOPE` (`'__global__'`); it boots once at
 * SW eval, persists across workspace switches, and tears down only on
 * SW shutdown (or test cleanup).
 *
 * Reuses the same primitives + the same registry helpers as the
 * per-workspace path. {@link GLOBAL_REGISTRY} declares the single
 * `extensionWorkspace` registration; {@link attachCaches} +
 * {@link buildProjectorPipeline} drive cache + projector wiring so
 * adding a second cross-workspace entity later is one push to the
 * registry, not a new wiring branch here.
 *
 * Out of scope this module (deferred):
 *   - DNR coalescer / resolver-invalidate runner — workspace-meta
 *     changes don't recompile DNR or invalidate the resolver.
 *   - Awareness — workspace-meta presence isn't interesting today;
 *     deferrable until a concrete UX gesture asks for it.
 */

import type { SyncExtensionWorkspacePostState } from '@openheaders/core/protocol';
import { EXTENSION_WORKSPACE_ENTITY_TYPE, EXTENSION_WORKSPACE_GLOBAL_SCOPE } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import { getOracleHostHooks } from '@openheaders/oracle/sync';
import { wireBroadcastToSink } from './bridge';
import { InMemoryBroadcast } from './broadcast';
import {
  buildCaches,
  buildProjectorPipeline,
  buildSchemaRegistry,
  disposeCaches,
  type EntityCacheLike,
  EXTENSION_WORKSPACE_REGISTRATION,
  GLOBAL_REGISTRY,
  singletonSnapshot,
} from './entity-registry';
import { type ExtensionWorkspaceCache, setActiveExtensionWorkspaceCache } from './extension-workspace-cache';
import { ruleOracleLockAcquirer } from './lock-adapter';
import { InMemoryMutationLog, type MutationLog } from './mutation-log';
import { EntityOracle, type LockAcquirer } from './oracle';
import { InMemoryPendingIntents, type PendingIntents } from './pending-intents';
import { createSwContextHandle, type SwContextHandle } from './sw-context';
import { getSyncPersistenceProvider } from './sync-persistence-provider';
import { createWorkspaceCoordRunner, type WorkspaceCoordRunner } from './workspace-coord-runner';

interface GlobalServiceState {
  oracle: EntityOracle;
  broadcast: InMemoryBroadcast;
  intents: PendingIntents;
  caches: EntityCacheLike[];
  context: SwContextHandle;
  unsubscribeBroadcast: () => void;
  workspaceCoordRunner: WorkspaceCoordRunner | null;
}

let state: GlobalServiceState | null = null;

/**
 * Initialize the global-scope sync service. Idempotent — repeat calls
 * are no-ops (unlike the per-workspace `initSyncService`, this one
 * should only ever be init'd once per SW lifetime). Safe to call
 * before any UI surface is open: IDB connections are lazy and the
 * broadcast subscription is a no-op until something publishes.
 */
export function initGlobalSyncService(): void {
  if (state) return;
  const persistence = getSyncPersistenceProvider();
  state = wire({
    log: persistence.createMutationLog(EXTENSION_WORKSPACE_GLOBAL_SCOPE),
    intents: persistence.createPendingIntents(EXTENSION_WORKSPACE_GLOBAL_SCOPE),
    lock: ruleOracleLockAcquirer,
    sink: (event) => getOracleHostHooks().broadcastSyncEvent?.(event),
  });
  logger.info(
    'GlobalSyncService',
    `Initialized (entity=${EXTENSION_WORKSPACE_ENTITY_TYPE}, nodeId=${state.context.nodeId})`,
  );
}

/** Tear down the global service — used on SW shutdown + test cleanup. */
export function disposeGlobal(): void {
  if (!state) return;
  state.workspaceCoordRunner?.dispose();
  state.unsubscribeBroadcast();
  setActiveExtensionWorkspaceCache(null);
  disposeCaches(state.caches);
  logger.info('GlobalSyncService', 'Disposed');
  state = null;
}

/**
 * Attach the workspace coordination runner. Production wires the swap
 * + purge primitives (which depend on per-workspace stores +
 * `reinitForWorkspace` + bridge re-seeds — out of `global-service`'s
 * dependency reach by design) at boot time after every per-workspace
 * sync engine has been initialized for the first time. Idempotent —
 * a previous registration is disposed first.
 */
export function attachGlobalWorkspaceCoordRunner(deps: {
  getActiveWorkspaceId: () => string | null;
  swap: (newId: string) => Promise<void>;
  purge: (workspaceId: string) => Promise<void>;
}): void {
  if (!state) {
    throw new Error('GlobalSyncService.attachGlobalWorkspaceCoordRunner called before init');
  }
  state.workspaceCoordRunner?.dispose();
  state.workspaceCoordRunner = createWorkspaceCoordRunner({
    broadcast: state.broadcast,
    intents: state.intents,
    getActiveWorkspaceId: deps.getActiveWorkspaceId,
    swap: deps.swap,
    purge: deps.purge,
  });
}

/**
 * Direct oracle access for SW-internal consumers (workspace-store's
 * write path emits mutations through this rather than the bridge layer
 * — they're already in-process). Returns null when the service hasn't
 * been initialized so cold-wake races don't crash callers.
 */
export function getGlobalOracle(): EntityOracle | null {
  return state?.oracle ?? null;
}

/** Mint a `MutatorContext` for SW-internal global-scope emissions. */
export function nextGlobalSwContext(opts?: Parameters<SwContextHandle['next']>[0]) {
  if (!state) {
    throw new Error('GlobalSyncService.nextGlobalSwContext called before init');
  }
  return state.context.next(opts);
}

/**
 * Snapshot the global singleton — same shape the broadcast projector
 * attaches to live envelopes. Consumed by the
 * `oh.sync.snapshotExtensionWorkspaces` RPC for renderer mirror
 * bootstrap. Returns `[]` when the service isn't initialized; the
 * renderer treats that as "no snapshot yet" and falls back to
 * broadcast-only seeding.
 */
export function snapshotExtensionWorkspacePostStates(): SyncExtensionWorkspacePostState[] {
  return state ? singletonSnapshot(state.oracle, EXTENSION_WORKSPACE_REGISTRATION) : [];
}

// ── Test helpers ───────────────────────────────────────────────────

export interface GlobalSyncTestDeps {
  log?: MutationLog;
  intents?: PendingIntents;
  lock?: LockAcquirer;
}

/**
 * Test-only init — swaps the IDB-backed log + intents for the
 * in-memory references and reuses a sequential lock so unit tests
 * don't need fake-indexeddb. Mirrors `service.__initSyncServiceForTests`.
 */
export function __initGlobalSyncServiceForTests(deps: GlobalSyncTestDeps = {}): void {
  if (state) disposeGlobal();
  state = wire({
    log: deps.log ?? new InMemoryMutationLog(),
    intents: deps.intents ?? new InMemoryPendingIntents(),
    lock: deps.lock ?? ((_ws, _type, _id, fn) => fn()),
    // Tests don't drive chrome.runtime; the in-memory broadcast +
    // cache subscription cover the SW-side observable surface.
    sink: () => {},
  });
}

// ── Internals ───────────────────────────────────────────────────────

interface WireDeps {
  log: MutationLog;
  intents: PendingIntents;
  lock: LockAcquirer;
  sink: (event: import('@openheaders/core/protocol').SyncBroadcastEvent) => void;
}

function wire(deps: WireDeps): GlobalServiceState {
  const broadcast = new InMemoryBroadcast();
  const context = createSwContextHandle(EXTENSION_WORKSPACE_GLOBAL_SCOPE);
  const oracle = new EntityOracle({
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    lock: deps.lock,
    log: deps.log,
    intents: deps.intents,
    broadcast,
    schemas: buildSchemaRegistry(GLOBAL_REGISTRY),
  });
  const caches = buildCaches(EXTENSION_WORKSPACE_GLOBAL_SCOPE, oracle, broadcast, context, GLOBAL_REGISTRY);
  // GLOBAL_REGISTRY only contains EXTENSION_WORKSPACE_REGISTRATION today;
  // the extension-workspace cache is the one true cross-workspace
  // singleton (workspace-store reads it directly via
  // `getActiveExtensionWorkspaceCache`). Per-workspace caches are no
  // longer module-level singletons (1d) — only this global one is.
  setActiveExtensionWorkspaceCache(caches[0] as ExtensionWorkspaceCache);
  const projector = buildProjectorPipeline(oracle, GLOBAL_REGISTRY);
  const unsubscribeBroadcast = wireBroadcastToSink(broadcast, deps.sink, projector);
  return {
    oracle,
    broadcast,
    intents: deps.intents,
    caches,
    context,
    unsubscribeBroadcast,
    workspaceCoordRunner: null,
  };
}
