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
 * Reuses the same primitives as the per-workspace path:
 *   - `IdbMutationLog` + `IdbPendingIntents` — striped by the sentinel
 *     scope id, so the global stripe is disjoint from any user
 *     workspace's stripe.
 *   - `ruleOracleLockAcquirer` — entity locks are keyed by
 *     `(workspaceId, type, id)` already; the sentinel id is just
 *     another input.
 *   - `InMemoryBroadcast` + `wireBroadcastToSink` — broadcasts ride the
 *     same chrome.runtime `syncBroadcast` channel as the per-workspace
 *     oracle. Renderer-side mirrors filter by `envelope.body.type`, so
 *     the source-oracle is transparent to consumers.
 *
 * Out of scope this module (deferred):
 *   - DNR coalescer / resolver-invalidate runner — workspace-meta
 *     changes don't recompile DNR or invalidate the resolver.
 *   - Awareness — workspace-meta presence isn't interesting today;
 *     deferrable until a concrete UX gesture asks for it.
 */

import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { SyncBroadcastEvent, SyncExtensionWorkspacePostState } from '@openheaders/core/protocol';
import { broadcast as bridgeBroadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { type BroadcastProjector, wireBroadcastToSink } from './bridge';
import { InMemoryBroadcast } from './broadcast';
import {
  createExtensionWorkspaceCache,
  type ExtensionWorkspaceCache,
  setActiveExtensionWorkspaceCache,
} from './extension-workspace-cache';
import {
  projectExtensionWorkspacePostState,
  projectExtensionWorkspaceSingleton,
} from './extension-workspace-post-state';
import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { ruleOracleLockAcquirer } from './lock-adapter';
import { InMemoryMutationLog, type MutationLog } from './mutation-log';
import { type LockAcquirer, EntityOracle } from './oracle';
import { InMemoryPendingIntents, type PendingIntents } from './pending-intents';
import { createSwContextHandle, type SwContextHandle } from './sw-context';

interface GlobalServiceState {
  oracle: EntityOracle;
  broadcast: InMemoryBroadcast;
  cache: ExtensionWorkspaceCache;
  context: SwContextHandle;
  unsubscribeBroadcast: () => void;
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

  const log = new IdbMutationLog(EXTENSION_WORKSPACE_GLOBAL_SCOPE);
  const intents = new IdbPendingIntents(EXTENSION_WORKSPACE_GLOBAL_SCOPE);
  const broadcast = new InMemoryBroadcast();
  const context = createSwContextHandle(EXTENSION_WORKSPACE_GLOBAL_SCOPE);

  const oracle = new EntityOracle({
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    lock: ruleOracleLockAcquirer,
    log,
    intents,
    broadcast,
  });

  const cache = createExtensionWorkspaceCache(
    EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    oracle,
    broadcast,
    () => context.next(),
  );
  setActiveExtensionWorkspaceCache(cache);

  const projector: BroadcastProjector = (envelope) => {
    const extensionWorkspacePostState = projectExtensionWorkspacePostState(oracle, envelope);
    return extensionWorkspacePostState ? { extensionWorkspacePostState } : null;
  };

  const unsubscribeBroadcast = wireBroadcastToSink(
    broadcast,
    (event: SyncBroadcastEvent) => {
      bridgeBroadcast('syncBroadcast', {
        envelope: event.envelope,
        outcome: event.outcome,
        batchId: event.batchId,
        ...(event.extensionWorkspacePostState
          ? { extensionWorkspacePostState: event.extensionWorkspacePostState }
          : {}),
      });
    },
    projector,
  );

  state = { oracle, broadcast, cache, context, unsubscribeBroadcast };
  logger.info(
    'GlobalSyncService',
    `Initialized (entity=${EXTENSION_WORKSPACE_ENTITY_TYPE}, nodeId=${context.nodeId})`,
  );
}

/** Tear down the global service — used on SW shutdown + test cleanup. */
export function disposeGlobal(): void {
  if (!state) return;
  state.unsubscribeBroadcast();
  state.cache.dispose();
  setActiveExtensionWorkspaceCache(null);
  logger.info('GlobalSyncService', 'Disposed');
  state = null;
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
  if (!state) return [];
  const projection = projectExtensionWorkspaceSingleton(state.oracle);
  return projection ? [projection] : [];
}

// ── test helpers ───────────────────────────────────────────────────

/**
 * Test-only init helper — swaps the IDB-backed log + intents for the
 * in-memory references and reuses a sequential lock so unit tests
 * don't need fake-indexeddb. Mirrors `service.__initSyncServiceForTests`.
 */
export interface GlobalSyncTestDeps {
  log?: MutationLog;
  intents?: PendingIntents;
  lock?: LockAcquirer;
}

export function __initGlobalSyncServiceForTests(deps: GlobalSyncTestDeps = {}): void {
  if (state) disposeGlobal();
  const broadcast = new InMemoryBroadcast();
  const context = createSwContextHandle(EXTENSION_WORKSPACE_GLOBAL_SCOPE);
  const oracle = new EntityOracle({
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    lock: deps.lock ?? ((_ws, _type, _id, fn) => fn()),
    log: deps.log ?? new InMemoryMutationLog(),
    intents: deps.intents ?? new InMemoryPendingIntents(),
    broadcast,
  });
  const cache = createExtensionWorkspaceCache(
    EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    oracle,
    broadcast,
    () => context.next(),
  );
  setActiveExtensionWorkspaceCache(cache);
  const projector: BroadcastProjector = (envelope) => {
    const extensionWorkspacePostState = projectExtensionWorkspacePostState(oracle, envelope);
    return extensionWorkspacePostState ? { extensionWorkspacePostState } : null;
  };
  const unsubscribeBroadcast = wireBroadcastToSink(
    broadcast,
    () => {
      // Tests don't drive chrome.runtime; the in-memory broadcast +
      // cache subscription cover the SW-side observable surface.
    },
    projector,
  );
  state = { oracle, broadcast, cache, context, unsubscribeBroadcast };
}
