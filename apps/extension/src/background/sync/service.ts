/**
 * Sync service — per-workspace `WorkspaceServiceState` map.
 *
 * Foundation for MWPT-FULL: every resident workspace has its own
 * oracle, IDB log, broadcast bus, caches, HLC sequencer, and awareness
 * store. Services are created lazily on first reference, kept alive by
 * a refcount, and disposed after a grace period when refcount reaches
 * zero. `applySyncRequest` routes batches by `batch.workspaceId` so
 * cross-workspace concurrent writes stay structurally partitioned.
 *
 * One workspace at a time is the *Active* workspace — its caches are
 * registered as the per-entity singletons (legacy `getActiveXCache`
 * accessor surface) and its broadcast feeds DNR + outgoing-WS. Other
 * resident workspaces hold caches scoped to their own service state
 * but do not register them as singletons. The Active flip detaches the
 * old singletons + attaches the new in `initSyncService`.
 *
 * Lifecycle helpers (1a-scope):
 *   - `getOrCreateWorkspaceService(id)` — lazy + refcount++; returns slot.
 *   - `releaseWorkspaceService(id)` — refcount--; schedules disposal
 *     after `graceMs` if refcount reaches 0; cancellable on re-acquire.
 *   - `disposeWorkspace(id)` — forced disposal (workspace deletion).
 *
 * Refcount sources in 1a:
 *   - Active pointer holds one ref while pointing at the workspace.
 *   - In-flight `applySyncRequest` brackets a ref via `try/finally`.
 *   Lifeline-driven refs and per-workspace runners arrive in later
 *   foundation commits.
 *
 * Hydration gate. Each service exposes a `hydrated: Promise<void>` that
 * `applySyncRequest` awaits before calling `oracle.apply`. Today the
 * oracle is constructed synchronously, so the promise resolves
 * immediately; the contract is in place so a future async seed-from-
 * storage step can extend it without callers changing.
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
  SyncTemplateFolderPostState,
  SyncTemplatePostState,
  SyncVaultPostState,
  SyncWorkspaceVariablesPostState,
} from '@openheaders/core/protocol';
import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  OAUTH_BUNDLE_ENTITY_TYPE,
  PAUSE_MARKERS_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { broadcast as bridgeBroadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { scheduleUpdate } from '@/background/modules/rule-engine';
import { type AwarenessStore, createAwarenessStore } from './awareness';
import { handleAwarenessPublish } from './awareness-bridge';
import { handleSyncApply, wireBroadcastToSink } from './bridge';
import { InMemoryBroadcast } from './broadcast';
import { createDnrIntentRunner, type DnrIntentRunner } from './dnr-intent-runner';
import {
  buildProjectorPipeline,
  buildSchemaRegistry,
  COLLECTION_REGISTRATION,
  detachCaches,
  ENVIRONMENT_REGISTRATION,
  type EntityCacheLike,
  FILES_REGISTRATION,
  FOLDER_REGISTRATION,
  flatSnapshot,
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
import { getGlobalOracle } from './global-service';
import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { ruleOracleLockAcquirer } from './lock-adapter';
import { InMemoryMutationLog, type MutationLog } from './mutation-log';
import { EntityOracle, type LockAcquirer } from './oracle';
import { InMemoryPendingIntents, type PendingIntents } from './pending-intents';
import { createResolverInvalidateRunner, type ResolverInvalidateRunner } from './resolver-invalidate-runner';
import { createSwContextHandle, type SwContextHandle } from './sw-context';

// ── Types ────────────────────────────────────────────────────────────

/**
 * Per-workspace service state. Each resident workspace has exactly one
 * of these in {@link services}; non-resident workspaces have none.
 */
export interface WorkspaceServiceState {
  workspaceId: string;
  /**
   * Resolves once the service is ready to accept `oracle.apply` calls.
   * Awaited by {@link applySyncRequest} before routing to the oracle —
   * closes the cold-oracle race without eager pre-create. Today the
   * oracle is synchronously ready; the promise contract is in place
   * for a future async seed-from-storage step.
   */
  hydrated: Promise<void>;
  oracle: EntityOracle;
  log: MutationLog;
  intents: PendingIntents;
  broadcast: InMemoryBroadcast;
  caches: EntityCacheLike[];
  context: SwContextHandle;
  awareness: AwarenessStore;
  dnrRunner: DnrIntentRunner;
  resolverInvalidateRunner: ResolverInvalidateRunner;
  unsubscribeBroadcast: () => void;
  /** Number of live references — Active pointer + in-flight applies + (later) lifelines. */
  refcount: number;
  /** Pending grace-period disposal timer; cancelled if refcount returns to ≥1 within grace. */
  disposalTimer: ReturnType<typeof setTimeout> | null;
  /** Set true once teardown begins; new acquires must rebuild a fresh service. */
  disposing: boolean;
  /** True while this is the runtime-Active workspace (caches registered as singletons). */
  isActive: boolean;
}

interface WireDeps {
  workspaceId: string;
  log: MutationLog;
  intents: PendingIntents;
  lock: LockAcquirer;
  recompile: (reason: string) => void;
  sink: (event: import('@openheaders/core/protocol').SyncBroadcastEvent) => void;
  awarenessSink: (presence: AwarenessState[]) => void;
}

type WireDepsFactory = (workspaceId: string) => WireDeps;

// ── Module state ─────────────────────────────────────────────────────

const services = new Map<string, WorkspaceServiceState>();

/** Workspace whose caches are currently registered as the per-entity singletons. */
let currentActive: string | null = null;

/**
 * Disposal grace period for {@link releaseWorkspaceService}. Production
 * default mirrors the design's 30s window; tests set this to 0 via
 * {@link __initSyncServiceForTests} so disposal is synchronous and
 * teardown assertions remain straightforward. Surfaced to users as the
 * `general.workspaceServiceGracePeriodMs` setting (registered in the
 * workbench schema; SW reads through a future settings-bridge step).
 */
let graceMs = 30_000;

/**
 * Active dependency factory. Production initializes at module load;
 * {@link __initSyncServiceForTests} swaps it for in-memory deps.
 */
let depsFactory: WireDepsFactory = productionDepsFactory;

// ── Public API: legacy active-flip shims ─────────────────────────────

/**
 * Structured outcome of {@link setRuntimeActive}. The five `ok: false`
 * reasons let callers respond differently — silent retry on
 * `workspace-disposed`, "rate-limited" toast on `runner-attach-failed`,
 * workspace-list refresh on `workspace-not-found`, etc.
 */
export type SetActiveResult =
  | { ok: true }
  | { ok: false; reason: 'workspace-disposed' }
  | { ok: false; reason: 'workspace-not-found' }
  | { ok: false; reason: 'hydration-failed'; error: unknown }
  | { ok: false; reason: 'runner-attach-failed'; error: unknown }
  | { ok: false; reason: 'storage-failed'; error: unknown };

/**
 * Single-flight chain for {@link setRuntimeActive}. Each call queues
 * onto the previous one's settle (success OR failure — chained via
 * `.catch(() => undefined)` so a transient failure does not poison
 * subsequent flips). Rapid `setRuntimeActive(W2) → setRuntimeActive(W3)`
 * preserves arrival order; W3 is never observable before W2's flip
 * settles.
 */
let activeFlipChain: Promise<unknown> = Promise.resolve();

/**
 * Make `workspaceId` the Active workspace. Single-flight: serializes
 * with prior calls to avoid split-brain (two flips interleaving their
 * detach/attach steps). Returns a {@link SetActiveResult} so callers
 * can distinguish transient failures (hydration / attach / storage)
 * from terminal ones (workspace deleted mid-flight).
 *
 * Boot is the atomicity backstop. `bootSyncSubsystem` calls
 * `setRuntimeActive(persistedActive)` — same code path. Eviction
 * recovery is structurally identical to cold boot. Rigorous mid-flip
 * rollback is NOT specified — torn flips heal at next SW eviction.
 */
export function setRuntimeActive(workspaceId: string): Promise<SetActiveResult> {
  const next = activeFlipChain.catch(() => undefined).then(() => doSetActive(workspaceId));
  activeFlipChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * Make `workspaceId` the Active workspace synchronously. Legacy entry
 * point — fire-and-forget; bypasses the single-flight queue's structured
 * result. Prefer {@link setRuntimeActive} for new call sites.
 *
 * Today this delegates to {@link setRuntimeActive} (which executes
 * synchronously when no flip is in flight). Kept on the public surface
 * because background.ts boot + workspace-coord callers already invoke
 * it; sub-commit 1b doesn't sweep those call sites.
 */
export function initSyncService(workspaceId: string): void {
  void setRuntimeActive(workspaceId);
}

async function doSetActive(workspaceId: string): Promise<SetActiveResult> {
  // 1. Lazy-acquire (refcount++). Today this never throws — the slot
  //    is always synthesizable. Future commits may surface
  //    `workspace-not-found` from a registry check before the acquire.
  let newSvc: WorkspaceServiceState;
  try {
    newSvc = getOrCreateWorkspaceService(workspaceId);
  } catch (error) {
    logger.warn('SyncService', `setRuntimeActive(${workspaceId}): workspace-not-found`, error);
    return { ok: false, reason: 'workspace-not-found' };
  }

  // 2. Hydration gate. Resolves synchronously today; the contract is in
  //    place for a future async seed-from-storage step.
  try {
    await newSvc.hydrated;
  } catch (error) {
    releaseWorkspaceService(workspaceId);
    logger.warn('SyncService', `setRuntimeActive(${workspaceId}): hydration-failed`, error);
    return { ok: false, reason: 'hydration-failed', error };
  }

  // 3. Disposed mid-flight (forced disposal happened between acquire
  //    and hydrate)? Release the ref we got and report the structured
  //    failure so the caller can refresh its workspace list.
  if (newSvc.disposing) {
    releaseWorkspaceService(workspaceId);
    return { ok: false, reason: 'workspace-disposed' };
  }

  // 4. Same-as-current short-circuit. Release the extra ref the
  //    acquire above gave us; the existing Active pointer ref is the
  //    one that stays.
  if (currentActive === workspaceId) {
    releaseWorkspaceService(workspaceId);
    return { ok: true };
  }

  const oldActive = currentActive;

  // 5. Detach old singletons before attaching new. Single-active
  //    invariant on cache singletons is structural — module-level slots
  //    can hold exactly one cache at a time.
  if (oldActive !== null) {
    const oldSvc = services.get(oldActive);
    if (oldSvc?.isActive) {
      detachCaches(WORKSPACE_REGISTRY, oldSvc.caches);
      oldSvc.isActive = false;
    }
  }

  // 6. Attach new singletons. Active-bound runner attach (dnr-manager
  //    + outgoing-WS subscription swap) lands in sub-commit 1c on top
  //    of this hook.
  try {
    for (let i = 0; i < WORKSPACE_REGISTRY.length; i++) {
      const reg = WORKSPACE_REGISTRY[i];
      const cache = newSvc.caches[i];
      // Cast is sound: caches[i] was produced by reg.createCache in
      // `buildService`; setActive accepts the cache type it owns.
      reg.setActive(cache as never);
    }
    newSvc.isActive = true;
  } catch (error) {
    releaseWorkspaceService(workspaceId);
    logger.warn('SyncService', `setRuntimeActive(${workspaceId}): runner-attach-failed`, error);
    return { ok: false, reason: 'runner-attach-failed', error };
  }

  // 7. Update Active pointer; release old's Active ref (may schedule
  //    grace-period disposal if no other refs hold it).
  currentActive = workspaceId;
  if (oldActive !== null) {
    releaseWorkspaceService(oldActive);
  }

  logger.info(
    'SyncService',
    `Active workspace = ${workspaceId} (entity=${RULE_ENTITY_TYPE}, nodeId=${newSvc.context.nodeId})`,
  );
  return { ok: true };
}

/**
 * Drop the Active pointer. The Active workspace's cache singletons are
 * detached; its service may be torn down after grace if no other refs
 * hold it. Used at SW shutdown and by the test harness.
 */
export function dispose(): void {
  if (currentActive === null) return;
  const svc = services.get(currentActive);
  if (svc?.isActive) {
    detachCaches(WORKSPACE_REGISTRY, svc.caches);
    svc.isActive = false;
  }
  const oldActive = currentActive;
  currentActive = null;
  releaseWorkspaceService(oldActive);
}

/** Re-initialize for a new workspace in one call. */
export function reinitForWorkspace(workspaceId: string): void {
  initSyncService(workspaceId);
}

// ── Public API: per-workspace lifecycle (foundation for later commits) ──

/**
 * Lazy + refcount-incrementing accessor for a workspace's service
 * state. Idempotent: subsequent calls return the same slot and bump
 * its refcount. Cancels any pending grace-period disposal timer so
 * a service with refcount=0 inside its grace window can be re-acquired
 * cleanly.
 *
 * The caller MUST pair every successful acquisition with exactly one
 * {@link releaseWorkspaceService} call (or {@link disposeWorkspace} if
 * the workspace is being deleted).
 */
export function getOrCreateWorkspaceService(workspaceId: string): WorkspaceServiceState {
  let svc = services.get(workspaceId);
  if (svc?.disposing) {
    // A teardown is mid-flight; rebuild a fresh service. Should be
    // unreachable today (teardown is synchronous) but the contract
    // matters once seed-from-storage becomes async in later commits.
    svc = undefined;
  }
  if (!svc) {
    svc = buildService(depsFactory(workspaceId));
    services.set(workspaceId, svc);
  }
  if (svc.disposalTimer !== null) {
    clearTimeout(svc.disposalTimer);
    svc.disposalTimer = null;
  }
  svc.refcount++;
  return svc;
}

/**
 * Decrement a workspace service's refcount. When refcount reaches 0 the
 * service is scheduled for disposal after `graceMs`; the timer is
 * cancellable by a subsequent {@link getOrCreateWorkspaceService}
 * within the window. Already-disposing services are ignored.
 */
export function releaseWorkspaceService(workspaceId: string): void {
  const svc = services.get(workspaceId);
  if (!svc || svc.disposing) return;
  svc.refcount = Math.max(0, svc.refcount - 1);
  if (svc.refcount > 0) return;
  if (svc.disposalTimer !== null) return; // already scheduled
  if (graceMs <= 0) {
    finalizeDisposal(svc);
    return;
  }
  svc.disposalTimer = setTimeout(() => {
    svc.disposalTimer = null;
    if (svc.refcount === 0 && !svc.disposing) finalizeDisposal(svc);
  }, graceMs);
}

/**
 * Forced disposal — used on workspace deletion. Tears down the service
 * regardless of refcount and removes it from the map immediately.
 * In-flight applies that hold a refcount will see the next operation
 * fail because the oracle's underlying resources are released; future
 * commits add an explicit `disposing` short-circuit on the apply path.
 */
export function disposeWorkspace(workspaceId: string): void {
  const svc = services.get(workspaceId);
  if (!svc) return;
  if (svc.disposalTimer !== null) {
    clearTimeout(svc.disposalTimer);
    svc.disposalTimer = null;
  }
  finalizeDisposal(svc);
}

/**
 * Apply a `SyncApplyRequest` against the oracle indicated by
 * `request.batch.workspaceId`. Lazily materializes the workspace's
 * service if it isn't resident, brackets a refcount around the apply,
 * and awaits `service.hydrated` before touching the oracle.
 *
 * Routing rules:
 *   - Empty batches use the runtime-Active oracle (no workspaceId in
 *     payload to dispatch on; legacy invariant preserved).
 *   - Mixed-scope batches (global + per-workspace) are rejected — the
 *     all-or-nothing per-batch contract requires a single lock domain.
 *   - `extensionWorkspace` envelopes target the GLOBAL oracle.
 *   - Every other entity type routes to the per-workspace oracle named
 *     by `batch.workspaceId`.
 */
export function applySyncRequest(request: SyncApplyRequest): Promise<SyncApplyResponse> {
  if (request.batch.mutations.length === 0) {
    if (currentActive === null) {
      throw new Error('SyncService.applySyncRequest called before init');
    }
    const svc = services.get(currentActive);
    if (!svc) {
      throw new Error('SyncService.applySyncRequest: Active workspace has no resident service');
    }
    return svc.hydrated.then(() => handleSyncApply(svc.oracle, request));
  }

  const isGlobal = request.batch.mutations[0].body.type === EXTENSION_WORKSPACE_ENTITY_TYPE;
  for (const env of request.batch.mutations) {
    const envIsGlobal = env.body.type === EXTENSION_WORKSPACE_ENTITY_TYPE;
    if (envIsGlobal !== isGlobal) {
      throw new Error(
        'SyncService.applySyncRequest: mixed-scope batch (global + per-workspace) — split into separate batches',
      );
    }
  }

  if (isGlobal) {
    const globalOracle = getGlobalOracle();
    if (!globalOracle) {
      throw new Error('SyncService.applySyncRequest: global service not initialized');
    }
    return handleSyncApply(globalOracle, request);
  }

  // Per-workspace path: dispatch on the first mutation's workspaceId.
  // The all-or-nothing per-batch contract requires a single lock domain;
  // mixed-workspace batches are rejected for the same reason mixed-scope
  // ones are.
  const wsId = request.batch.mutations[0].workspaceId;
  for (const env of request.batch.mutations) {
    if (env.workspaceId !== wsId) {
      throw new Error(
        'SyncService.applySyncRequest: mixed-workspace batch — split into separate batches per workspace',
      );
    }
  }
  const svc = getOrCreateWorkspaceService(wsId);
  return svc.hydrated.then(() => handleSyncApply(svc.oracle, request)).finally(() => releaseWorkspaceService(wsId));
}

/**
 * Direct oracle access for SW-internal consumers (rule-store's write
 * path emits mutations through this rather than the bridge layer —
 * they're already in-process). Returns null when no Active workspace
 * is set so alarm dispatch paths don't crash on cold-wake races.
 */
export function getOracleForCurrentWorkspace(): EntityOracle | null {
  if (currentActive === null) return null;
  return services.get(currentActive)?.oracle ?? null;
}

// ── Snapshot exports — consumed by `oh.sync.snapshotX` RPC handlers ──
//
// Each export returns the materialized post-state for the entity it
// names; renderer mirrors call these on mount before subscribing to
// the live broadcast. Returns `[]` when no Active workspace is set —
// the renderer falls back to broadcast-only seeding.

function activeOracle(): EntityOracle | null {
  if (currentActive === null) return null;
  return services.get(currentActive)?.oracle ?? null;
}

export function snapshotRulePostStates(): SyncRulePostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, RULE_REGISTRATION) : [];
}

export function snapshotEnvironmentPostStates(): SyncEnvironmentPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, ENVIRONMENT_REGISTRATION) : [];
}

export function snapshotCollectionPostStates(): SyncCollectionPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, COLLECTION_REGISTRATION) : [];
}

export function snapshotWorkspaceVariablesPostStates(): SyncWorkspaceVariablesPostState[] {
  const o = activeOracle();
  return o ? singletonSnapshot(o, WORKSPACE_VARIABLES_REGISTRATION) : [];
}

export function snapshotVaultPostStates(): SyncVaultPostState[] {
  const o = activeOracle();
  return o ? singletonSnapshot(o, VAULT_REGISTRATION) : [];
}

export function snapshotFolderPostStates(): SyncFolderPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, FOLDER_REGISTRATION) : [];
}

export function snapshotRequestPostStates(): SyncRequestPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, REQUEST_REGISTRATION) : [];
}

export function snapshotRequestCollectionPostStates(): SyncRequestCollectionPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, REQUEST_COLLECTION_REGISTRATION) : [];
}

export function snapshotRequestFolderPostStates(): SyncRequestFolderPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, REQUEST_FOLDER_REGISTRATION) : [];
}

export function snapshotTemplatePostStates(): SyncTemplatePostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, TEMPLATE_REGISTRATION) : [];
}

export function snapshotTemplateCollectionPostStates(): SyncTemplateCollectionPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, TEMPLATE_COLLECTION_REGISTRATION) : [];
}

export function snapshotTemplateFolderPostStates(): SyncTemplateFolderPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, TEMPLATE_FOLDER_REGISTRATION) : [];
}

export function snapshotLiveVariablePostStates(): SyncLiveVariablePostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, LIVE_VARIABLE_REGISTRATION) : [];
}

export function snapshotLiveWorkflowPostStates(): SyncLiveWorkflowPostState[] {
  const o = activeOracle();
  return o ? flatSnapshot(o, LIVE_WORKFLOW_REGISTRATION) : [];
}

export function snapshotOAuthBundlePostStates(): SyncOAuthBundlePostState[] {
  const o = activeOracle();
  return o ? singletonSnapshot(o, OAUTH_BUNDLE_REGISTRATION) : [];
}

export function snapshotPauseMarkersPostStates(): SyncPauseMarkersPostState[] {
  const o = activeOracle();
  return o ? singletonSnapshot(o, PAUSE_MARKERS_REGISTRATION) : [];
}

export function snapshotLayoutStatePostStates(): SyncLayoutStatePostState[] {
  const o = activeOracle();
  return o ? singletonSnapshot(o, LAYOUT_STATE_REGISTRATION) : [];
}

export function snapshotFilesPostStates(): SyncFilesPostState[] {
  const o = activeOracle();
  return o ? singletonSnapshot(o, FILES_REGISTRATION) : [];
}

// ── Awareness ────────────────────────────────────────────────────────

/**
 * Apply an awareness publish from a renderer surface. Returns the
 * post-GC presence so the caller's local mirror has an immediate
 * synchronous answer; the subsequent `awarenessBroadcast` carries the
 * same shape to every other surface. Cross-workspace publishes (a
 * renderer that hasn't observed an Active workspace switch yet) drop
 * to an empty presence list rather than throwing — the renderer's
 * mirror clears the entry.
 */
export function publishAwareness(request: AwarenessPublishRequest): AwarenessPublishResponse {
  return handleAwarenessPublish((workspaceId) => services.get(workspaceId)?.awareness ?? null, request);
}

/**
 * Direct accessor for SW-internal consumers (e.g. tests). Returns the
 * Active workspace's awareness store, or null when no Active workspace
 * is set.
 */
export function getAwarenessStoreForCurrentWorkspace(): AwarenessStore | null {
  if (currentActive === null) return null;
  return services.get(currentActive)?.awareness ?? null;
}

/**
 * Snapshot the canonical presence list for the Active workspace — used
 * by renderer surfaces on mount so they have a starting view before
 * the next publish/broadcast.
 */
export function snapshotAwarenessPresence(): AwarenessState[] {
  if (currentActive === null) return [];
  return services.get(currentActive)?.awareness.list() ?? [];
}

/**
 * Drop a presence row by `instanceId` across every resident workspace.
 * Called by the lifeline port handler on `onDisconnect`, which fires
 * whenever a surface unmounts or the tab closes — connection-bound
 * liveness instead of polling. The lifeline doesn't know which
 * workspace the surface was attached to (a surface may have rebound
 * during its lifetime), so the sweep clears the row from every
 * resident workspace; missing rows are silent no-ops.
 */
export function removeAwarenessByInstanceId(instanceId: string): void {
  for (const svc of services.values()) {
    svc.awareness.remove(instanceId);
  }
}

/**
 * Mint a fresh `MutatorContext` from the Active workspace's HLC
 * sequencer. Used by SW-internal callers (rule-store, hydration) —
 * surfaces hosted in a renderer mint their own contexts with their
 * own nodeId.
 */
export function nextSwMutatorContext(
  opts?: Parameters<SwContextHandle['next']>[0],
): import('@openheaders/core/sync').MutatorContext | null {
  if (currentActive === null) return null;
  return services.get(currentActive)?.context.next(opts) ?? null;
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
 * Initialize the service with in-memory dependencies. Disposes any
 * resident services synchronously (`graceMs = 0` for the duration of
 * the test) so each test starts from a clean slate. The cache + oracle
 * + broadcast bus are the real production classes — only persistence
 * + lock adapters are swapped.
 */
export function __initSyncServiceForTests(workspaceId: string, deps: SyncServiceTestDeps = {}): void {
  graceMs = 0;
  // Reset Active + tear down every resident service synchronously.
  if (currentActive !== null) {
    const svc = services.get(currentActive);
    if (svc?.isActive) {
      detachCaches(WORKSPACE_REGISTRY, svc.caches);
      svc.isActive = false;
    }
    currentActive = null;
  }
  for (const id of Array.from(services.keys())) {
    disposeWorkspace(id);
  }

  // Swap the deps factory so subsequent lazy materializations use the
  // injected log/intents/lock/recompile. The factory captures the deps
  // closure once; every workspace built in this test session reuses
  // the same instances. Tests that assert cross-workspace behavior
  // override the factory directly via {@link __setWireDepsFactoryForTests}.
  depsFactory = (id) => ({
    workspaceId: id,
    log: deps.log ?? new InMemoryMutationLog(),
    intents: deps.intents ?? new InMemoryPendingIntents(),
    lock: deps.lock ?? ((_ws, _t, _id, fn) => Promise.resolve().then(fn)),
    recompile: deps.recompile ?? (() => {}),
    sink: () => {},
    awarenessSink: () => {},
  });

  initSyncService(workspaceId);
}

/**
 * Override the dependency factory directly. Used by integration tests
 * that need each per-workspace service to receive its own log/intents
 * (cross-workspace isolation tests in commit 3). Callers should call
 * this BEFORE any `getOrCreateWorkspaceService` so the factory is in
 * place when materialization fires.
 */
export function __setWireDepsFactoryForTests(factory: WireDepsFactory): void {
  depsFactory = factory;
}

/** Override the disposal grace window — used by tests that exercise
 *  the grace + cancellation lifecycle directly. */
export function __setGracePeriodMsForTests(ms: number): void {
  graceMs = ms;
}

// ── Internals ───────────────────────────────────────────────────────

function productionDepsFactory(workspaceId: string): WireDeps {
  return {
    workspaceId,
    log: new IdbMutationLog(workspaceId),
    intents: new IdbPendingIntents(workspaceId),
    lock: ruleOracleLockAcquirer,
    recompile: (reason) => scheduleUpdate(reason, { immediate: false }),
    sink: (event) => bridgeBroadcast('syncBroadcast', event),
    awarenessSink: (presence) => bridgeBroadcast('awarenessBroadcast', { workspaceId, presence }),
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
 * bus, but NOT yet registered as the per-entity active singletons —
 * that happens in {@link initSyncService} when this workspace becomes
 * Active. Non-Active resident workspaces hold caches scoped to their
 * own service state without affecting `getActiveXCache` consumers.
 */
function buildService(deps: WireDeps): WorkspaceServiceState {
  const broadcast = new InMemoryBroadcast();
  const context = createSwContextHandle(deps.workspaceId);
  const oracle = new EntityOracle({
    workspaceId: deps.workspaceId,
    lock: deps.lock,
    log: deps.log,
    intents: deps.intents,
    broadcast,
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
  });

  // Build caches via the registry's createCache; do NOT register as
  // singletons here. The Active flip in `initSyncService` registers
  // the singletons for the Active workspace and detaches the previous
  // owner.
  const caches: EntityCacheLike[] = WORKSPACE_REGISTRY.map((reg) =>
    reg.createCache(deps.workspaceId, oracle, broadcast, () => context.next()),
  );

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
      REQUEST_COLLECTION_ENTITY_TYPE,
      TEMPLATE_COLLECTION_ENTITY_TYPE,
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
    hydrated: Promise.resolve(),
    oracle,
    log: deps.log,
    intents: deps.intents,
    broadcast,
    caches,
    context,
    awareness,
    dnrRunner,
    resolverInvalidateRunner,
    unsubscribeBroadcast,
    refcount: 0,
    disposalTimer: null,
    disposing: false,
    isActive: false,
  };
}

/**
 * Tear down a workspace service unconditionally and remove it from
 * the map. Idempotent — repeat calls on an already-disposed service
 * are no-ops.
 */
function finalizeDisposal(svc: WorkspaceServiceState): void {
  if (svc.disposing) return;
  svc.disposing = true;
  if (svc.disposalTimer !== null) {
    clearTimeout(svc.disposalTimer);
    svc.disposalTimer = null;
  }
  svc.unsubscribeBroadcast();
  svc.dnrRunner.dispose();
  svc.resolverInvalidateRunner.dispose();
  if (svc.isActive) {
    detachCaches(WORKSPACE_REGISTRY, svc.caches);
    svc.isActive = false;
  } else {
    for (const cache of svc.caches) cache.dispose();
  }
  svc.awareness.dispose();
  services.delete(svc.workspaceId);
  logger.info('SyncService', `Disposed workspace ${svc.workspaceId}`);
}
