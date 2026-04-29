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
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncFolderPostState,
  SyncRequestPostState,
  SyncRulePostState,
  SyncVaultPostState,
  SyncWorkspaceVariablesPostState,
} from '@openheaders/core/protocol';
import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { broadcast as bridgeBroadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { scheduleUpdate } from '@/background/modules/rule-engine';
import { type AwarenessStore, createAwarenessStore } from './awareness';
import { handleAwarenessPublish } from './awareness-bridge';
import { type BroadcastProjector, composeProjectors, handleSyncApply, wireBroadcastToSink } from './bridge';
import {
  type CollectionCache,
  createCollectionCache,
  setActiveCollectionCache,
} from './collection-cache';
import { projectCollectionByUid, projectCollectionPostState } from './collection-post-state';
import { createDnrIntentRunner, type DnrIntentRunner } from './dnr-intent-runner';
import { projectEnvironmentByUid, projectEnvironmentPostState } from './env-post-state';
import { createFolderCache, type FolderCache, setActiveFolderCache } from './folder-cache';
import { projectFolderByUid, projectFolderPostState } from './folder-post-state';
import {
  createEnvironmentCache,
  type EnvironmentCache,
  setActiveEnvironmentCache,
} from './environment-cache';
import {
  createResolverInvalidateRunner,
  type ResolverInvalidateRunner,
} from './resolver-invalidate-runner';
import { projectRuleByUid, projectRulePostState } from './rule-post-state';
import {
  createVaultCache,
  setActiveVaultCache,
  type VaultCache,
} from './vault-cache';
import { projectVaultPostState, projectVaultSingleton } from './vault-post-state';
import {
  createWorkspaceVariablesCache,
  setActiveWorkspaceVariablesCache,
  type WorkspaceVariablesCache,
} from './workspace-variables-cache';
import {
  projectWorkspaceVariablesPostState,
  projectWorkspaceVariablesSingleton,
} from './workspace-variables-post-state';
import { InMemoryBroadcast } from './broadcast';
import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { ruleOracleLockAcquirer } from './lock-adapter';
import { InMemoryMutationLog, type MutationLog } from './mutation-log';
import { type LockAcquirer, EntityOracle } from './oracle';
import { InMemoryPendingIntents, type PendingIntents } from './pending-intents';
import { createRequestCache, type RequestCache, setActiveRequestCache } from './request-cache';
import { projectRequestByUid, projectRequestPostState } from './request-post-state';
import { createRuleCache, type RuleCache, setActiveRuleCache } from './rule-cache';
import { createSwContextHandle, type SwContextHandle } from './sw-context';

interface ServiceState {
  workspaceId: string;
  oracle: EntityOracle;
  broadcast: InMemoryBroadcast;
  ruleCache: RuleCache;
  envCache: EnvironmentCache;
  collectionCache: CollectionCache;
  folderCache: FolderCache;
  workspaceVariablesCache: WorkspaceVariablesCache;
  vaultCache: VaultCache;
  requestCache: RequestCache;
  context: SwContextHandle;
  awareness: AwarenessStore;
  dnrRunner: DnrIntentRunner;
  resolverInvalidateRunner: ResolverInvalidateRunner;
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

  const collectionCache = createCollectionCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveCollectionCache(collectionCache);

  const folderCache = createFolderCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveFolderCache(folderCache);

  const workspaceVariablesCache = createWorkspaceVariablesCache(
    workspaceId,
    oracle,
    broadcast,
    () => context.next(),
  );
  setActiveWorkspaceVariablesCache(workspaceVariablesCache);

  const vaultCache = createVaultCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveVaultCache(vaultCache);

  const requestCache = createRequestCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveRequestCache(requestCache);

  // DNR intent runner — subscribes AFTER the cache so by the time the
  // runner asks rule-engine to recompile, the rule mirror already
  // reflects post-commit state.
  const dnrRunner = createDnrIntentRunner({
    broadcast,
    intents,
    recompile: (reason) => scheduleUpdate(reason, { immediate: false }),
  });

  // Resolver-invalidation runner — fires on any variable-scope envelope
  // (env, collection; workspace + vault join in later sessions).
  // Subscribes AFTER the entity caches so the recompile sees post-commit
  // state via `syncResolverFromStores`.
  const resolverInvalidateRunner = createResolverInvalidateRunner({
    broadcast,
    intents,
    entityTypes: new Set([
      ENVIRONMENT_ENTITY_TYPE,
      COLLECTION_ENTITY_TYPE,
      WORKSPACE_VARIABLES_ENTITY_TYPE,
      VAULT_ENTITY_TYPE,
    ]),
    recompile: (reason) => scheduleUpdate(reason, { immediate: false }),
  });

  const awareness = createAwarenessStore({
    workspaceId,
    emit: (presence) => {
      bridgeBroadcast('awarenessBroadcast', { workspaceId, presence });
    },
    // Vault is §12.1 schema-marked sensitive — entity-level awareness
    // only; per-secret-name presence would leak the secret namespace
    // and access patterns (§14.4).
    sensitiveEntityTypes: new Set<string>([VAULT_ENTITY_TYPE]),
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
  const collectionProjector: BroadcastProjector = (envelope) => {
    const collectionPostState = projectCollectionPostState(oracle, envelope);
    return collectionPostState ? { collectionPostState } : null;
  };
  const workspaceVariablesProjector: BroadcastProjector = (envelope) => {
    const workspaceVariablesPostState = projectWorkspaceVariablesPostState(oracle, envelope);
    return workspaceVariablesPostState ? { workspaceVariablesPostState } : null;
  };
  const vaultProjector: BroadcastProjector = (envelope) => {
    const vaultPostState = projectVaultPostState(oracle, envelope);
    return vaultPostState ? { vaultPostState } : null;
  };
  const folderProjector: BroadcastProjector = (envelope) => {
    const folderPostState = projectFolderPostState(oracle, envelope);
    return folderPostState ? { folderPostState } : null;
  };
  const requestProjector: BroadcastProjector = (envelope) => {
    const requestPostState = projectRequestPostState(oracle, envelope);
    return requestPostState ? { requestPostState } : null;
  };
  const projector = composeProjectors(
    ruleProjector,
    envProjector,
    collectionProjector,
    workspaceVariablesProjector,
    vaultProjector,
    folderProjector,
    requestProjector,
  );
  const unsubscribeBroadcast = wireBroadcastToSink(
    broadcast,
    (event: SyncBroadcastEvent) => {
      bridgeBroadcast('syncBroadcast', {
        envelope: event.envelope,
        outcome: event.outcome,
        batchId: event.batchId,
        ...(event.rulePostState ? { rulePostState: event.rulePostState } : {}),
        ...(event.environmentPostState ? { environmentPostState: event.environmentPostState } : {}),
        ...(event.collectionPostState ? { collectionPostState: event.collectionPostState } : {}),
        ...(event.workspaceVariablesPostState
          ? { workspaceVariablesPostState: event.workspaceVariablesPostState }
          : {}),
        ...(event.vaultPostState ? { vaultPostState: event.vaultPostState } : {}),
        ...(event.folderPostState ? { folderPostState: event.folderPostState } : {}),
        ...(event.requestPostState ? { requestPostState: event.requestPostState } : {}),
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
    collectionCache,
    folderCache,
    workspaceVariablesCache,
    vaultCache,
    requestCache,
    context,
    awareness,
    dnrRunner,
    resolverInvalidateRunner,
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
  state.resolverInvalidateRunner.dispose();
  state.ruleCache.dispose();
  state.envCache.dispose();
  state.collectionCache.dispose();
  state.folderCache.dispose();
  state.workspaceVariablesCache.dispose();
  state.vaultCache.dispose();
  state.requestCache.dispose();
  state.awareness.dispose();
  setActiveRuleCache(null);
  setActiveEnvironmentCache(null);
  setActiveCollectionCache(null);
  setActiveFolderCache(null);
  setActiveWorkspaceVariablesCache(null);
  setActiveVaultCache(null);
  setActiveRequestCache(null);
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
 * Snapshot every Collection the active oracle holds. Same shape the
 * `BroadcastProjector` attaches to live envelopes; consumed by the
 * `oh.sync.snapshotCollections` RPC for renderer mirror bootstrap.
 */
export function snapshotCollectionPostStates(): SyncCollectionPostState[] {
  if (!state) return [];
  const oracle = state.oracle;
  const out: SyncCollectionPostState[] = [];
  for (const materialized of oracle.materializeAll()) {
    if (materialized.type !== COLLECTION_ENTITY_TYPE) continue;
    const projection = projectCollectionByUid(oracle, materialized.id);
    if (projection) out.push(projection);
  }
  return out;
}

/**
 * Snapshot the singleton workspace-variables record. Same shape the
 * `BroadcastProjector` attaches to live envelopes; consumed by the
 * `oh.sync.snapshotWorkspaceVariables` RPC for renderer mirror
 * bootstrap. Returns `[]` when the service isn't initialized or the
 * singleton hasn't been seeded yet.
 */
export function snapshotWorkspaceVariablesPostStates(): SyncWorkspaceVariablesPostState[] {
  if (!state) return [];
  const projection = projectWorkspaceVariablesSingleton(state.oracle);
  return projection ? [projection] : [];
}

/**
 * Snapshot the singleton vault record. Same shape the
 * `BroadcastProjector` attaches to live envelopes; consumed by the
 * `oh.sync.snapshotVault` RPC for renderer mirror bootstrap. Returns
 * `[]` when the service isn't initialized or the singleton hasn't been
 * seeded yet. Local-only by §12.3 — never crosses any sync transport.
 */
export function snapshotVaultPostStates(): SyncVaultPostState[] {
  if (!state) return [];
  const projection = projectVaultSingleton(state.oracle);
  return projection ? [projection] : [];
}

/**
 * Snapshot every Folder the active oracle holds — `(folder)` per uid,
 * the same shape `BroadcastProjector` attaches to live envelopes.
 * Renderer surfaces call this on mount via the `oh.sync.snapshotFolders`
 * RPC. Folders whose parent linkage isn't currently resolvable are
 * skipped — the next folder/parent broadcast republishes them.
 */
export function snapshotFolderPostStates(): SyncFolderPostState[] {
  if (!state) return [];
  const oracle = state.oracle;
  const out: SyncFolderPostState[] = [];
  for (const materialized of oracle.materializeAll()) {
    if (materialized.type !== FOLDER_ENTITY_TYPE) continue;
    const projection = projectFolderByUid(oracle, materialized.id);
    if (projection) out.push(projection);
  }
  return out;
}

/**
 * Snapshot every Request the active oracle holds — `(request, setItemIds)`
 * per uid, the same shape `BroadcastProjector` attaches to live
 * envelopes. Renderer surfaces call this on mount via the
 * `oh.sync.snapshotRequests` RPC.
 */
export function snapshotRequestPostStates(): SyncRequestPostState[] {
  if (!state) return [];
  const oracle = state.oracle;
  const out: SyncRequestPostState[] = [];
  for (const materialized of oracle.materializeAll()) {
    if (materialized.type !== REQUEST_ENTITY_TYPE) continue;
    const projection = projectRequestByUid(oracle, materialized.id);
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
  const collectionCache = createCollectionCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveCollectionCache(collectionCache);
  const folderCache = createFolderCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveFolderCache(folderCache);
  const workspaceVariablesCache = createWorkspaceVariablesCache(
    workspaceId,
    oracle,
    broadcast,
    () => context.next(),
  );
  setActiveWorkspaceVariablesCache(workspaceVariablesCache);
  const vaultCache = createVaultCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveVaultCache(vaultCache);
  const requestCache = createRequestCache(workspaceId, oracle, broadcast, () => context.next());
  setActiveRequestCache(requestCache);

  const dnrRunner = createDnrIntentRunner({
    broadcast,
    intents,
    recompile: deps.recompile ?? (() => {}),
  });
  const resolverInvalidateRunner = createResolverInvalidateRunner({
    broadcast,
    intents,
    entityTypes: new Set([
      ENVIRONMENT_ENTITY_TYPE,
      COLLECTION_ENTITY_TYPE,
      WORKSPACE_VARIABLES_ENTITY_TYPE,
      VAULT_ENTITY_TYPE,
    ]),
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
    collectionCache,
    folderCache,
    workspaceVariablesCache,
    vaultCache,
    requestCache,
    context,
    awareness,
    dnrRunner,
    resolverInvalidateRunner,
    unsubscribeBroadcast: () => {
      // No chrome.runtime sink in tests.
    },
  };
}
