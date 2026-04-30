/**
 * Sync service — singleton lifecycle around {@link EntityOracle} for the
 * SW background context.
 *
 * Per-workspace responsibilities:
 *   1. Construct the {@link EntityOracle} with production-wired
 *      dependencies — IDB-backed mutation log + pending intents, the
 *      lock adapter that reuses the existing per-entity Web Lock, and
 *      an in-memory broadcast bus.
 *   2. Mint an SW-side HLC sequencer + `MutatorContext` factory
 *      ({@link sw-context.ts}); SW-internal write paths (boot
 *      hydration, alarm dispatch) emit through this factory.
 *   3. Construct one cache per entity registered in
 *      {@link WORKSPACE_REGISTRY} and register it as the per-entity
 *      active singleton so legacy reads (`getActiveXCache`) route to
 *      it.
 *   4. Wire the oracle's broadcast bus to a single composed projector
 *      derived from the registry, then onto the chrome.runtime
 *      `syncBroadcast` channel so renderer surfaces can ack + replay.
 *   5. Run the DNR coalescer + resolver-invalidate runners against
 *      the same broadcast bus.
 *
 * Workspace switch: {@link reinitForWorkspace} disposes the active
 * service (drops every subscription, clears each per-entity active
 * singleton), then re-runs init for the new workspace. The IDB stores
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
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncFilesPostState,
  SyncFolderPostState,
  SyncLayoutStatePostState,
  SyncLiveVariablePostState,
  SyncLiveWorkflowPostState,
  SyncOAuthBundlePostState,
  SyncPauseMarkersPostState,
  SyncRequestCollectionPostState,
  SyncRequestFolderPostState,
  SyncRequestPostState,
  SyncRulePostState,
  SyncTemplateCollectionPostState,
  SyncTemplatePostState,
  SyncTemplateFolderPostState,
  SyncVaultPostState,
  SyncWorkspaceVariablesPostState,
} from '@openheaders/core/protocol';
import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  OAUTH_BUNDLE_ENTITY_TYPE,
  PAUSE_MARKERS_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { broadcast as bridgeBroadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { scheduleUpdate } from '@/background/modules/rule-engine';
import { type AwarenessStore, createAwarenessStore } from './awareness';
import { handleAwarenessPublish } from './awareness-bridge';
import { handleSyncApply, wireBroadcastToSink } from './bridge';
import { createDnrIntentRunner, type DnrIntentRunner } from './dnr-intent-runner';
import {
  attachCaches,
  buildProjectorPipeline,
  COLLECTION_REGISTRATION,
  detachCaches,
  type EntityCacheLike,
  ENVIRONMENT_REGISTRATION,
  FILES_REGISTRATION,
  flatSnapshot,
  FOLDER_REGISTRATION,
  LAYOUT_STATE_REGISTRATION,
  LIVE_VARIABLE_REGISTRATION,
  LIVE_WORKFLOW_REGISTRATION,
  OAUTH_BUNDLE_REGISTRATION,
  PAUSE_MARKERS_REGISTRATION,
  REQUEST_COLLECTION_REGISTRATION,
  REQUEST_FOLDER_REGISTRATION,
  REQUEST_REGISTRATION,
  RULE_REGISTRATION,
  singletonSnapshot,
  TEMPLATE_COLLECTION_REGISTRATION,
  TEMPLATE_FOLDER_REGISTRATION,
  TEMPLATE_REGISTRATION,
  VAULT_REGISTRATION,
  WORKSPACE_REGISTRY,
  WORKSPACE_VARIABLES_REGISTRATION,
} from './entity-registry';
import {
  createResolverInvalidateRunner,
  type ResolverInvalidateRunner,
} from './resolver-invalidate-runner';
import { InMemoryBroadcast } from './broadcast';
import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { ruleOracleLockAcquirer } from './lock-adapter';
import { InMemoryMutationLog, type MutationLog } from './mutation-log';
import { type LockAcquirer, EntityOracle } from './oracle';
import { InMemoryPendingIntents, type PendingIntents } from './pending-intents';
import { createSwContextHandle, type SwContextHandle } from './sw-context';

interface ServiceState {
  workspaceId: string;
  oracle: EntityOracle;
  broadcast: InMemoryBroadcast;
  caches: EntityCacheLike[];
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
  state = wire({
    workspaceId,
    log,
    intents,
    lock: ruleOracleLockAcquirer,
    recompile: (reason) => scheduleUpdate(reason, { immediate: false }),
    sink: (event) => bridgeBroadcast('syncBroadcast', event),
    awarenessSink: (presence) => bridgeBroadcast('awarenessBroadcast', { workspaceId, presence }),
  });
  logger.info(
    'SyncService',
    `Initialized for workspace ${workspaceId} (entity=${RULE_ENTITY_TYPE}, nodeId=${state.context.nodeId})`,
  );
}

/** Tear down the active service — used on workspace switch + on shutdown. */
export function dispose(): void {
  if (!state) return;
  state.unsubscribeBroadcast();
  state.dnrRunner.dispose();
  state.resolverInvalidateRunner.dispose();
  detachCaches(WORKSPACE_REGISTRY, state.caches);
  state.awareness.dispose();
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

// ── Snapshot exports — consumed by `oh.sync.snapshotX` RPC handlers ──
//
// Each export returns the materialized post-state for the entity it
// names; renderer mirrors call these on mount before subscribing to
// the live broadcast. Returns `[]` when the service isn't initialized
// (cold-wake race) — the renderer falls back to broadcast-only seeding.

export function snapshotRulePostStates(): SyncRulePostState[] {
  return state ? flatSnapshot(state.oracle, RULE_REGISTRATION) : [];
}

export function snapshotEnvironmentPostStates(): SyncEnvironmentPostState[] {
  return state ? flatSnapshot(state.oracle, ENVIRONMENT_REGISTRATION) : [];
}

export function snapshotCollectionPostStates(): SyncCollectionPostState[] {
  return state ? flatSnapshot(state.oracle, COLLECTION_REGISTRATION) : [];
}

export function snapshotWorkspaceVariablesPostStates(): SyncWorkspaceVariablesPostState[] {
  return state ? singletonSnapshot(state.oracle, WORKSPACE_VARIABLES_REGISTRATION) : [];
}

export function snapshotVaultPostStates(): SyncVaultPostState[] {
  return state ? singletonSnapshot(state.oracle, VAULT_REGISTRATION) : [];
}

export function snapshotFolderPostStates(): SyncFolderPostState[] {
  return state ? flatSnapshot(state.oracle, FOLDER_REGISTRATION) : [];
}

export function snapshotRequestPostStates(): SyncRequestPostState[] {
  return state ? flatSnapshot(state.oracle, REQUEST_REGISTRATION) : [];
}

export function snapshotRequestCollectionPostStates(): SyncRequestCollectionPostState[] {
  return state ? flatSnapshot(state.oracle, REQUEST_COLLECTION_REGISTRATION) : [];
}

export function snapshotRequestFolderPostStates(): SyncRequestFolderPostState[] {
  return state ? flatSnapshot(state.oracle, REQUEST_FOLDER_REGISTRATION) : [];
}

export function snapshotTemplatePostStates(): SyncTemplatePostState[] {
  return state ? flatSnapshot(state.oracle, TEMPLATE_REGISTRATION) : [];
}

export function snapshotTemplateCollectionPostStates(): SyncTemplateCollectionPostState[] {
  return state ? flatSnapshot(state.oracle, TEMPLATE_COLLECTION_REGISTRATION) : [];
}

export function snapshotTemplateFolderPostStates(): SyncTemplateFolderPostState[] {
  return state ? flatSnapshot(state.oracle, TEMPLATE_FOLDER_REGISTRATION) : [];
}

export function snapshotLiveVariablePostStates(): SyncLiveVariablePostState[] {
  return state ? flatSnapshot(state.oracle, LIVE_VARIABLE_REGISTRATION) : [];
}

export function snapshotLiveWorkflowPostStates(): SyncLiveWorkflowPostState[] {
  return state ? flatSnapshot(state.oracle, LIVE_WORKFLOW_REGISTRATION) : [];
}

export function snapshotOAuthBundlePostStates(): SyncOAuthBundlePostState[] {
  return state ? singletonSnapshot(state.oracle, OAUTH_BUNDLE_REGISTRATION) : [];
}

export function snapshotPauseMarkersPostStates(): SyncPauseMarkersPostState[] {
  return state ? singletonSnapshot(state.oracle, PAUSE_MARKERS_REGISTRATION) : [];
}

export function snapshotLayoutStatePostStates(): SyncLayoutStatePostState[] {
  return state ? singletonSnapshot(state.oracle, LAYOUT_STATE_REGISTRATION) : [];
}

export function snapshotFilesPostStates(): SyncFilesPostState[] {
  return state ? singletonSnapshot(state.oracle, FILES_REGISTRATION) : [];
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
export function nextSwMutatorContext(
  opts?: Parameters<SwContextHandle['next']>[0],
): import('@openheaders/core/sync').MutatorContext | null {
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
export function __initSyncServiceForTests(
  workspaceId: string,
  deps: SyncServiceTestDeps = {},
): void {
  if (state) dispose();
  state = wire({
    workspaceId,
    log: deps.log ?? new InMemoryMutationLog(),
    intents: deps.intents ?? new InMemoryPendingIntents(),
    lock: deps.lock ?? ((_ws, _t, _id, fn) => Promise.resolve().then(fn)),
    recompile: deps.recompile ?? (() => {}),
    // No chrome.runtime sink in tests — the in-memory broadcast +
    // cache subscription cover the SW-side observable surface.
    sink: () => {},
    awarenessSink: () => {},
  });
}

// ── Internals ───────────────────────────────────────────────────────

interface WireDeps {
  workspaceId: string;
  log: MutationLog;
  intents: PendingIntents;
  lock: LockAcquirer;
  recompile: (reason: string) => void;
  sink: (event: import('@openheaders/core/protocol').SyncBroadcastEvent) => void;
  awarenessSink: (presence: AwarenessState[]) => void;
}

/**
 * Build the full service state — production and test paths share this
 * factory so the wiring can never drift between them. Side-effect
 * runners and the awareness store are the only pieces with shape that
 * changes between scopes; everything else is pulled from
 * `WORKSPACE_REGISTRY`.
 */
function wire(deps: WireDeps): ServiceState {
  const broadcast = new InMemoryBroadcast();
  const context = createSwContextHandle(deps.workspaceId);
  const oracle = new EntityOracle({
    workspaceId: deps.workspaceId,
    lock: deps.lock,
    log: deps.log,
    intents: deps.intents,
    broadcast,
  });

  const caches = attachCaches(deps.workspaceId, oracle, broadcast, context, WORKSPACE_REGISTRY);

  // DNR intent runner — subscribes AFTER the rule + pause-markers
  // caches so by the time the runner asks rule-engine to recompile,
  // the relevant mirror already reflects post-commit state.
  const dnrRunner = createDnrIntentRunner({
    broadcast,
    intents: deps.intents,
    entityTypes: new Set([RULE_ENTITY_TYPE, PAUSE_MARKERS_ENTITY_TYPE]),
    recompile: deps.recompile,
  });

  // Resolver-invalidation runner — fires on any variable-scope envelope
  // (env, collection, workspace, vault, live-variable, live-workflow).
  // Subscribes AFTER the entity caches so the recompile sees post-commit
  // state via `syncResolverFromStores`.
  const resolverInvalidateRunner = createResolverInvalidateRunner({
    broadcast,
    intents: deps.intents,
    entityTypes: new Set([
      ENVIRONMENT_ENTITY_TYPE,
      COLLECTION_ENTITY_TYPE,
      WORKSPACE_VARIABLES_ENTITY_TYPE,
      VAULT_ENTITY_TYPE,
      LIVE_VARIABLE_ENTITY_TYPE,
      LIVE_WORKFLOW_ENTITY_TYPE,
    ]),
    recompile: deps.recompile,
  });

  const awareness = createAwarenessStore({
    workspaceId: deps.workspaceId,
    emit: deps.awarenessSink,
    // Vault + OAuth bundles are §12.1 schema-marked sensitive — entity-level
    // awareness only; per-secret-name / per-credentialRef presence would
    // leak the secret namespace and access patterns (§14.4).
    sensitiveEntityTypes: new Set<string>([VAULT_ENTITY_TYPE, OAUTH_BUNDLE_ENTITY_TYPE]),
  });

  const projector = buildProjectorPipeline(oracle, WORKSPACE_REGISTRY);
  const unsubscribeBroadcast = wireBroadcastToSink(broadcast, deps.sink, projector);

  return {
    workspaceId: deps.workspaceId,
    oracle,
    broadcast,
    caches,
    context,
    awareness,
    dnrRunner,
    resolverInvalidateRunner,
    unsubscribeBroadcast,
  };
}
