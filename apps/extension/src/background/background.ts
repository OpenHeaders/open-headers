/**
 * Main background service worker — minimal orchestrator.
 *
 * Rule update ownership is centralized in rule-engine.ts. Rule / collection
 * / template data is owned entirely by the extension; per-workspace stores
 * in `modules/` are the single source of truth. Team workspaces synced
 * from the desktop app land in v2 through `workspace-orchestrator.ts`.
 */

import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-lifeline-server';
import { consumedOrgIds, getIdentitySnapshot, recordJoinedOrg } from '@openheaders/core/identity';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { setSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import { createIdbSyncPersistenceProvider } from '@openheaders/oracle-host-browser/sync/idb-sync-persistence';
import { report as reportStatus, subscribe as subscribeStatus } from '@openheaders/ui/shared/status';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { broadcast } from '@utils/bridge';
import { isChrome, isEdge, isFirefox, isSafari, runtime } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { bootstrapSettings } from '@utils/settings-bootstrap';
import { installAlarmDispatch } from './bootstrap/alarm-dispatch';
import { resolveBackgroundReady } from './bootstrap/background-ready';
import { debouncedUpdateBadge } from './bootstrap/badge-update';
import { setupDelayBypassCleanup } from './bootstrap/delay-bypass-cleanup';
import { bootstrapIdentity } from './bootstrap/identity-init';
import { startLifecyclePipeline } from './bootstrap/lifecycle-pipeline';
import { installMessageRouting } from './bootstrap/message-routing';
import { installNetworkEventHandlers } from './bootstrap/network-events';
import { installStorageListeners } from './bootstrap/storage-listeners';
import { installStoreBroadcasts } from './bootstrap/store-broadcasts';
import { getRulesPaused, setRulesPaused } from './dnr-manager';
import { setupInjectListener } from './inject-manager';
import { updateExtensionBadge } from './modules/badge-manager';
import { rehydrateCacheBypassFromSessionRules } from './modules/cache-bypass';
// Module-load side effect: registers `liveChainAdapter` with the live
// scheduler via `__setLiveRefreshAdapter`. Import for its side effect
// even though we don't name anything from it here — the scheduler's
// adapter port is filled at eval time so the first alarm fires
// against a real chain runner rather than the Phase-C stub.
import './modules/live-chain-adapter';
import { setLockObserver } from '@openheaders/oracle/coordination';
import { setBlobBackend } from '@openheaders/oracle/files';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import { IdbBlobBackend } from '@openheaders/oracle-host-browser/files/idb-blob-backend';

setBlobBackend(new IdbBlobBackend());
setSyncPersistenceProvider(createIdbSyncPersistenceProvider());

import { disposeResolverStateForWorkspace } from '@openheaders/oracle/rule-engine/variables-resolver';
import {
  applyWorkspaceSnapshot,
  hasRecentlyApplied,
  readWorkspaceStateVector,
  setActivityMuteStore,
  setOracleHostHooks,
  setOutboundEchoGuard,
  subscribeActivityMuteChanges,
} from '@openheaders/oracle/sync';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '@openheaders/oracle/sync/service';
import { getSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import { installActivityPruneScheduler } from './activity-prune-scheduler';
import { installActivityStatusReporter } from './activity-status-reporter';
import { forwardAwarenessToBackend, forwardCurrentAwarenessOnConnect } from './awareness-forwarder';
import { handleIncomingAwarenessFrame } from './awareness-receiver';
import { installBackupWriter } from './install-backup-writer';
import {
  countUnreadActivityEntries,
  observeForActivityFeed,
  setActivityLog,
  subscribeActivityEntries,
} from './sync-activity-installer';
import { createSyncHandshakeInitiator } from './sync-handshake-initiator';
import {
  applyPeerStateVectorToPendingOut,
  flushPendingOutToBackend,
  forwardMutationToBackend,
  setPendingOutQueue,
} from './sync-mutation-forwarder';
import { handleIncomingMutationFrame } from './sync-mutation-receiver';
import { installHandshakeStatusReporter } from './sync-status-reporter';
import { registerInboundFrameHandler, subscribeOnWebSocketClose, subscribeOnWebSocketOpen } from './websocket';

// Don't bounce envelopes that arrived from the backend back to it.
// The inbound bridge records every applied mutationId; the outbound
// gate's echo layer skips re-broadcasting any envelope already in that
// set — together they break the echo loop.
setOutboundEchoGuard(hasRecentlyApplied);

// Persistent pending-out queue (C13) so offline edits survive the
// disconnect window. Drained on WS reconnect (C15) in HLC order;
// wire-side dedup (C11) makes the replay safe even if the backend
// already saw the envelope before the disconnect.
const pendingOutQueue = getSyncPersistenceProvider().createPendingOutQueue?.() ?? null;
setPendingOutQueue(pendingOutQueue);

// Activity Feed (F1/F2): every inbound envelope the bridge applies
// flows through the classifier and lands in the per-workspace
// activity log. Writes are fire-and-forget; apply latency is
// unaffected by IDB latency.
const activityLog = getSyncPersistenceProvider().createActivityLog?.() ?? null;
setActivityLog(activityLog);

// F7 — auto-decay sweep. A single recurring chrome.alarms tick prunes
// every resident workspace down to the 7-day retention window. Alarms
// survive SW eviction so the log can't grow unbounded across long
// idle stretches; the handler iterates `listWorkspaces()` so workspaces
// added or removed after install are picked up by the next tick.
installActivityPruneScheduler({
  getLog: () => activityLog,
  listWorkspaceIds: () => listWorkspaces().map((ws) => ws.id),
});

// F6.b — the per-entity mute store gates the classifier so muted
// entities never reach the log or the unread badge. The cache module
// is the runtime source of truth; the persisted store rehydrates it
// per workspace lazily on first observation.
setActivityMuteStore(getSyncPersistenceProvider().createActivityMuteStore?.() ?? null);

// M5 — mode-switch Discard backup-writer. The orchestrator builds the
// archive and asks the host to put it on disk; the SW writes via
// chrome.downloads. Without this the orchestrator returns
// `backup-writer-unavailable` and the dialog warns the user.
installBackupWriter();

// U5.9 "join → adopt" — the backend's active workspace id from the
// WELCOME, held until that workspace has synced down. The handshake
// fires before the joined Org's workspaces arrive, so adoption is
// deferred to the next `onWorkspaceStoreChange` once the target exists.
let pendingAdoptWorkspaceId: string | null = null;

function tryAdoptPendingWorkspace(): void {
  if (!pendingAdoptWorkspaceId) return;
  if (!getWorkspace(pendingAdoptWorkspaceId)) return; // not synced down yet
  const id = pendingAdoptWorkspaceId;
  pendingAdoptWorkspaceId = null;
  void setActiveWorkspaceById(id).catch((err: unknown) => {
    logger.warn('Background', 'join → adopt: could not promote the backend workspace to active', err);
  });
}

// Sync handshake — Phase C / U6.3. On every WS connect the initiator
// runs the connection handshake (HELLO/WELCOME); once connected it
// catches up the `__global__` workspace-list scope. On each scope's
// SYNCED it prunes pending-out against the peer's post-catch-up vector
// + flushes what remains. The WS-open flush (immediately below) is a
// defensive fallback for the legacy `browserInfo` path where SYNCED
// never fires.
const syncHandshakeInitiator = createSyncHandshakeInitiator({
  send: (frame) => sendViaWebSocket(frame as Record<string, unknown>),
  getActiveWorkspaceId: () => peekActiveWorkspaceId(),
  getExtensionNodeId: (workspaceId) => {
    const svc = getOrCreateWorkspaceService(workspaceId);
    try {
      return svc.context.nodeId;
    } finally {
      releaseWorkspaceService(workspaceId);
    }
  },
  getExtensionAgent: () => `@openheaders/extension@${runtime.getManifest().version}`,
  // U3.2 — send the user-pasted daemon auth token on every HELLO so
  // daemons bound non-loopback can validate the peer. Empty string is
  // treated as "no token configured" so loopback peers (the default)
  // don't carry a useless field.
  getAuthToken: () => {
    const raw = getSetting('backend.authToken');
    return raw && raw.length > 0 ? raw : null;
  },
  readStateVector: (workspaceId) => readWorkspaceStateVector(workspaceId),
  // U6.4 — after the `__global__` scope syncs the backend's workspace
  // list down, enumerate the workspaces under a consumed Org so the
  // coordinator can fan a per-workspace catch-up out for each. The
  // adopted active workspace (U6.6) is sequenced first so a mid-fan-out
  // SW death still leaves the user on a synced workspace.
  listConsumedWorkspaceIds: () => {
    const consumed = consumedOrgIds(getIdentitySnapshot());
    if (consumed.size === 0) return [];
    const ids = listWorkspaces()
      .filter((ws) => consumed.has(ws.orgId))
      .map((ws) => ws.id);
    if (pendingAdoptWorkspaceId && ids.includes(pendingAdoptWorkspaceId)) {
      const adopt = pendingAdoptWorkspaceId;
      return [adopt, ...ids.filter((id) => id !== adopt)];
    }
    return ids;
  },
  applySnapshot: async (snapshot) => {
    const svc = getOrCreateWorkspaceService(snapshot.workspaceId);
    try {
      await svc.hydrated;
      await applyWorkspaceSnapshot(snapshot, { makeContext: () => svc.context.next() });
    } finally {
      releaseWorkspaceService(snapshot.workspaceId);
    }
  },
  onSynced: async (_scope, peerVector) => {
    await applyPeerStateVectorToPendingOut(peerVector);
    await flushPendingOutToBackend();
    // U6.6 — a consumed workspace's data may have just landed via the
    // U6.4 fan-out. Promote the deferred adopt target now that it
    // exists locally; idempotent + no-op until the target syncs down.
    tryAdoptPendingWorkspace();
    // Awareness is ephemeral; only flows on local publish events. On
    // a fresh connect the peer has no view of our presence until the
    // next local surface activity — push the current snapshot now
    // that the handshake is past so the desktop folds extension
    // surfaces into its store immediately.
    forwardCurrentAwarenessOnConnect();
  },
  onRejected: (reason, detail) => {
    logger.warn('Background', `sync handshake rejected: ${reason}${detail ? ` — ${detail}` : ''}`);
  },
  // Persist the backend's advertised reach tier as live connection
  // state. Renderer surfaces read `OH.backendReach` (via `useBackendReach`)
  // to render accurate "extend your reach" guidance. Cleared on
  // disconnect + at SW init so a stale tier never outlives its socket.
  onReach: (reach) => {
    void getHostStorage()
      ?.set(OH.backendReach, reach)
      .catch((err: unknown) => logger.warn('Background', 'backendReach write failed', err));
  },
  // U5.2 — connecting to a backend is consume-first: record the
  // backend's home Org so its workspaces sync down through the existing
  // `authorizedOrgIds` filter. This host's own workspaces are never
  // pushed up — the receiver-side org filter on the backend enforces
  // that structurally.
  onJoinedOrg: async (org, backendActiveWorkspaceId) => {
    const { firstJoin } = await recordJoinedOrg(org);
    // U5.9 — joining is consume-only: on the FIRST join of this backend,
    // adopt it by promoting its active workspace to globally active once
    // it has synced down (see `tryAdoptPendingWorkspace`). The active Org
    // is derived from the active workspace, so adopting the workspace
    // adopts the Org too. A reconnect (`firstJoin` false) must NOT
    // re-adopt — a local active-workspace switch the user made since the
    // first join has to survive the WELCOME that every reconnect re-sends.
    if (firstJoin && backendActiveWorkspaceId) {
      pendingAdoptWorkspaceId = backendActiveWorkspaceId;
      tryAdoptPendingWorkspace();
    }
    logger.info('Background', `joined backend Org ${org.id} — its workspaces will sync down`);
  },
});

// Inbound frame routing — handshake initiator first (claims HELLO-flow
// types), mutation receiver second (claims oh.sync.mutation /
// oh.sync.mutationBatch). Anything unclaimed (e.g. the pre-handshake
// `pong`) drops silently.
registerInboundFrameHandler(async (frame) => {
  if (!syncHandshakeInitiator.handles(frame)) return false;
  await syncHandshakeInitiator.handle(frame);
  return true;
});
registerInboundFrameHandler(handleIncomingMutationFrame);
registerInboundFrameHandler(handleIncomingAwarenessFrame);

subscribeOnWebSocketOpen(() => {
  // A fresh transport socket is a fresh handshake session. Reset the
  // initiator before `start()` so a prior socket's terminal state
  // (e.g. `aborted` from a HELLO that lost a connect race) cannot wedge
  // this one — the close-side reset only fires for a socket that had
  // already connected, so it can't be relied on as the sole boundary.
  syncHandshakeInitiator.reset();
  void syncHandshakeInitiator.start();
});
subscribeOnWebSocketClose(() => {
  syncHandshakeInitiator.reset();
  // The socket is gone — no backend, no reach.
  void getHostStorage()
    ?.set(OH.backendReach, null)
    .catch(() => {
      /* best-effort — the SW-init clear and the next WELCOME both re-converge it */
    });
});

// Status pill — handshake phase overrides the wire-level reporter's
// "Connected to back-end" once HELLO is in flight. Wire-level writes
// stay authoritative for the disconnected / connecting / in-browser
// states (websocket.ts owns those).
installHandshakeStatusReporter({
  initiator: syncHandshakeInitiator,
  report: (entry) =>
    reportStatus({
      subsystem: 'sync',
      state: entry.state,
      message: entry.message,
      context: entry.context,
    }),
});

// Activity Feed pill — F3. Pulses yellow with an unread count whenever
// inbound mutations land for the active workspace; baselines on every
// active-workspace switch so the badge reflects "this workspace's
// pending activity" only.
installActivityStatusReporter({
  report: (entry) =>
    reportStatus({
      subsystem: 'activity',
      state: entry.state,
      message: entry.message,
      context: entry.context,
    }),
  subscribeActivityEntries,
  countUnread: countUnreadActivityEntries,
  getActiveWorkspaceId: () => peekActiveWorkspaceId(),
  subscribeActiveWorkspace: (listener) => onActiveWorkspaceChange(listener),
});

// F5 — live tail for the Activity Feed panel. Each classified entry
// the installer produces is also pushed onto the renderer bridge so
// the panel can prepend without re-fetching. The status reporter
// reads from the same source via its own subscription.
subscribeActivityEntries((entry) => {
  broadcast('activityEntry', entry);
});

// F6.b — every mute/unmute the host cache observes fans out as a
// renderer-side broadcast so open panels keep their muted-state badges
// in lockstep without polling the RPC.
subscribeActivityMuteChanges((change) => {
  broadcast('activityMuteChanged', change);
});

import {
  kickActiveContextRefresh,
  reconcileLiveSchedules,
  refreshLiveWorkflowSynchronously,
  startLiveScheduler,
} from './modules/live-refresh-scheduler';
import { reconcileOAuthSchedules, startOAuthScheduler } from './modules/oauth-refresh-scheduler';
import { hydrateObservabilityLog, recordLog } from './modules/observability-log';
import { scheduleUpdate as scheduleRuleEngineUpdate } from './modules/rule-engine';

// Wire the lock subsystem's observer to the host observability ring.
// Done at module-load so any pre-init `withLock` call still routes
// events to the buffered (pre-hydration) ring.
setLockObserver(recordLog);

// Wire the oracle's host-callbacks (log recorder, rule-engine notifier,
// resolver-state disposer). Module-load so the sync service can fire
// these the moment the first envelope arrives — no init ordering risk.
setOracleHostHooks({
  recordLog,
  scheduleRuleEngineUpdate: (reason, opts) => scheduleRuleEngineUpdate(reason, { immediate: opts?.immediate ?? false }),
  disposeResolverStateForWorkspace,
  broadcastSyncEvent: (event) => {
    broadcast('syncBroadcast', event);
    forwardMutationToBackend(event);
    observeForActivityFeed(event);
  },
  broadcastAwareness: (event) => {
    broadcast('awarenessBroadcast', event);
    forwardAwarenessToBackend(event);
  },
  reportStatus: (entry) =>
    reportStatus({
      subsystem: entry.subsystem as Parameters<typeof reportStatus>[0]['subsystem'],
      state: entry.state,
      message: entry.message,
      context: entry.context,
    }),
  getActiveWorkspaceId,
  peekActiveWorkspaceId,
  getCachedTotpCodes,
  onWorkspaceSwitched: (nextRules, pauseMarkers) => {
    seedFromWorkspaceSwitch(nextRules, pauseMarkers, getRulesPaused());
  },
});

import { getRules } from '@openheaders/oracle/entity/rule-store';
import { __setSyncWarmRunner, hydrateLiveCacheMirror } from '@openheaders/oracle/rule-engine/variables-resolver';
import { markBootPhase } from '@openheaders/oracle/sync/boot-telemetry';
import { auditHostPermissions } from './modules/permissions-audit';
import { precompileRulePatterns, rehydrateTabTracking, restoreTrackingState } from './modules/request-tracker';
import { scheduleUpdate } from './modules/rule-engine';
import {
  rehydrateFromStorage as rehydrateObserverFromStorage,
  seedFromWorkspaceSwitch,
} from './modules/rule-state-observer';
import { initializeActiveTabTracking, setupPeriodicCleanup, setupTabListeners } from './modules/tab-listeners';
import { setupTestRunnerPorts } from './modules/test-runner';
import { bootstrapTotpScheduler, getCachedTotpCodes } from './modules/totp-scheduler';
import { initializeViewMode } from './modules/view-mode';
import { hydrateActiveWorkspaceStores } from './modules/workspace-orchestrator';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  getWorkspace,
  listWorkspaces,
  onActiveWorkspaceChange,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from './modules/workspace-store';
import { setupWorkspaceTabRegistry } from './modules/workspace-tab-registry';
import { connectWebSocket, isWebSocketConnected, sendViaWebSocket, shouldAttemptBackendConnection } from './websocket';

// Workspace list must be bootstrapped first — every per-workspace store
// keys its reads off the active workspace id. Settings + per-workspace
// hydration chain off this promise.
const workspacesReady = bootstrapWorkspaces();

// Settings must be loaded before anything touches the rule engine — the
// first compile reads persisted `rulesEngine.paused`, `maxActiveRules`,
// `evaluationStrategy`, etc., and would otherwise race the async load.
const settingsReady = workspacesReady.then(bootstrapSettings).then(() => {
  markBootPhase('settings-ready');
  setRulesPaused(getSetting('rulesEngine.paused'));
  subscribeKey('rulesEngine.paused', () => {
    setRulesPaused(getSetting('rulesEngine.paused'));
    scheduleUpdate('pause', { immediate: true });
    debouncedUpdateBadge();
  });
  // Engine knobs that affect the DNR compile force a full rebuild so
  // changes go live immediately.
  const rebuildOnPrefChange = (): void => scheduleUpdate('prefs', { immediate: true });
  subscribeKey('rulesEngine.maxActiveRules', rebuildOnPrefChange);
  subscribeKey('rulesEngine.evaluationStrategy', rebuildOnPrefChange);
});

// ── Initialization ────────────────────────────────────────────────

let extensionInitialized = false;

async function initializeExtension(): Promise<void> {
  // All init paths must wait for the settings store so the first DNR
  // compile / websocket connect sees persisted values instead of defaults.
  await settingsReady;
  if (extensionInitialized) {
    if (shouldAttemptBackendConnection()) await connectWebSocket();
    return;
  }
  extensionInitialized = true;

  await bootstrapIdentity();

  // Pull the observability ring back into memory before subsystems
  // record their first post-wake events — a dropped startup window
  // would mean the user's bug report misses the events most likely
  // to have triggered the report.
  await hydrateObservabilityLog();
  recordLog({
    subsystem: 'extension',
    op: 'sw-init',
    level: 'info',
    message: 'Service worker initialized',
    context: {},
  });
  // Audit host permissions once on wake. Doesn't block init — if
  // permissions are narrowed, the Status pill flips red but rules
  // and requests still run on whatever hosts are still granted.
  void auditHostPermissions();

  // Broadcast Status snapshot changes so UI surfaces (workspace footer,
  // popup inline pill) can stay in lockstep with the SW without polling.
  subscribeStatus((snapshot) => {
    broadcast('statusUpdated', snapshot);
  });

  await updateExtensionBadge({
    connected: false,
    isPaused: false,
    reconnectAttempts: 0,
    matchedRuleCount: 0,
    configuredRuleCount: 0,
  });
  const { lifecycleStore } = startLifecyclePipeline();
  setupTabListeners({ updateBadge: debouncedUpdateBadge, lifecycleStore });
  setupPeriodicCleanup();
  initializeActiveTabTracking();
  setupWorkspaceTabRegistry();
  void initializeViewMode();
  setupInjectListener();
  setupDelayBypassCleanup();
  setupTestRunnerPorts({ lifecycleStore });

  installStoreBroadcasts({
    refreshFanOut: () => syncHandshakeInitiator.refreshFanOut(),
    tryAdoptPendingWorkspace,
  });

  // Alarm-driven OAuth refresh (Phase 14 §20). Subscribe to store
  // changes BEFORE the first reconcile so a write that races init
  // doesn't miss rescheduling. Reconcile then walks every workspace's
  // tokens + (re)schedules alarms + clears orphans.
  startOAuthScheduler();
  void reconcileOAuthSchedules().catch((err: unknown) => {
    logger.warn('Background', 'OAuth scheduler reconcile failed', err);
  });

  // Alarm-driven Live Workflow refresh (Phase C — LIVE_VARIABLES_PLAN.md).
  // Same subscribe-then-reconcile pattern as OAuth. The refresh work
  // itself is delegated to an adapter installed by Phase D; until
  // that adapter lands, alarm firings record a `scheduler-not-ready`
  // error against the cache and the backoff widens — no hot-loop.
  startLiveScheduler();
  // Wire the sync-warm entry point into `variables-resolver` so the
  // DNR compile path's `kickSyncWarmRefreshes` blocks on workflow
  // refreshes for LVs with `requireFreshOnRuleBuild`. Kept here (not
  // as a module-load side-effect inside the scheduler) so unit tests
  // that mount the scheduler in isolation don't transitively load the
  // resolver's store subscriptions.
  __setSyncWarmRunner(refreshLiveWorkflowSynchronously);
  // Live scheduler reconcile is intentionally deferred until AFTER
  // `hydrateActiveWorkspaceStores` below — unlike the OAuth scheduler
  // (which reads tokens directly from chrome.storage on every call),
  // the live scheduler's `collectEntries` + `getByAlarm` read the
  // in-memory `live-workflow-store` / `live-variable-store` arrays
  // populated by hydration. Running reconcile before hydration
  // produces an empty desired-set and wipes every `live-refresh:*`
  // alarm as "orphan," silently breaking scheduled refreshes until
  // the user manually hits Refresh.

  setTimeout(() => restoreTrackingState(debouncedUpdateBadge), 1000);

  // Hydrate the active workspace's per-workspace stores from storage.
  await hydrateActiveWorkspaceStores();
  markBootPhase('hydration-done');

  // Host-neutral sync-engine boot sequence — init global service, seed
  // the extensionWorkspace oracle, setRuntimeActive, seed every
  // per-workspace bridge, ensure default template collection, attach the
  // workspace-coord runner + awareness lifeline ports. Same code path on
  // the desktop main process; lives in `@openheaders/oracle/host-runtime`.
  await bootSyncEngine();
  markBootPhase('sync-init-done');
  markBootPhase('bridge-done');
  // Release the hydration barrier — alarm handlers waiting on
  // `backgroundReady` can now safely read the in-memory workflow /
  // variable / rule stores. Fired here (rather than at end-of-init)
  // because every remaining init step (cache mirror, TOTP bootstrap,
  // observer rehydrate) either reads storage directly or isn't on
  // the alarm dispatch path.
  markBootPhase('interactive');
  resolveBackgroundReady();
  // Now that the live workflow / variable stores are populated, run
  // the first reconcile so every eligible workflow has an alarm for
  // its next fire-at. Also re-seeds alarms that were mistakenly
  // cleared by a prior SW boot that hit the pre-hydration race
  // (older builds). Fire-and-forget — failures log but don't stall
  // the rest of init; the store-change subscription installed by
  // `startLiveScheduler` will re-reconcile on the next mutation.
  void reconcileLiveSchedules().catch((err: unknown) => {
    logger.warn('Background', 'Live scheduler reconcile failed', err);
  });
  // Opportunistic catch-up for stale workflows in the active context —
  // on a cold SW wake (laptop open after hours of sleep), reconcile
  // alone schedules the next alarm at `now + 30s` (MV3 alarm floor).
  // That's 30s of requests going out with a stale token. `kickActive
  // ContextRefresh` drives `refreshLiveWorkflowSynchronously` directly
  // for anything already-overdue, so the cache is repopulated within
  // one network round-trip of wake-up instead of waiting for the first
  // alarm tick. No-op when every workflow is still fresh (cadence math
  // inside the kick decides). Fire-and-forget; errors bubble into the
  // scheduler's normal failure log + backoff.
  void kickActiveContextRefresh(getActiveWorkspaceId(), getActiveEnvironmentId()).catch((err: unknown) => {
    logger.warn('Background', 'Live scheduler wake-up catch-up failed', err);
  });
  // Warm the live-cache mirror used by `variables-resolver` so the
  // first DNR compile after wake resolves `{{live.X}}` against real
  // captures rather than an empty registry. The mirror auto-refreshes
  // via `onLiveCacheStoreChange` after this point.
  await hydrateLiveCacheMirror();
  // Bootstrap the TOTP scheduler — keeps a `TotpRegistry` mirror warm
  // so the DNR compile resolves `{{vault.X}}` for kind:'totp' entries
  // against current codes, and ticks the rule engine at each
  // window-flip so baked codes never go stale. Vault edits (add /
  // rotate / delete a TOTP entry) re-trigger refresh + reschedule
  // through the same internal `onEnvironmentStoreChange` listener.
  await bootstrapTotpScheduler(() => scheduleUpdate('totp', { immediate: true }));
  const restoredRules = getRules();
  // Rehydrate the rule-state-observer snapshot BEFORE the first
  // rebuildAll fires, so rule changes that happened while the SW was
  // terminated are diffed against the pre-sleep baseline instead of
  // hitting the first-run seeding skip.
  await rehydrateObserverFromStorage();
  await rehydrateCacheBypassFromSessionRules();
  // Rebuild the per-tab subresource map from the last SW lifetime so the
  // popup's "This Page" view doesn't lose cached-subresource attribution
  // across SW eviction cycles. Runs before `restoreTrackingState` so the
  // main-frame seeding doesn't clobber richer persisted state.
  await rehydrateTabTracking();
  let didInitialApply = false;
  if (restoredRules.length > 0) {
    logger.info('Background', `Restored ${restoredRules.length} rules from storage`);
    precompileRulePatterns();
    scheduleUpdate('init', { immediate: true });
    didInitialApply = true;
  }

  // Reach is live connection state — drop any value left by a prior SW
  // lifetime before (re)connecting; a handshake WELCOME repopulates it,
  // and a mode with no socket (e.g. in-browser) correctly leaves it null.
  void getHostStorage()
    ?.set(OH.backendReach, null)
    .catch(() => {
      /* best-effort */
    });

  if (shouldAttemptBackendConnection()) {
    await connectWebSocket();
  } else if (getSetting('backend.mode') === 'in-browser') {
    logger.info('Background', 'backend.mode = in-browser — service worker is the back-end, no wire to open');
  } else {
    logger.info('Background', 'backend.autoConnect is off — skipping initial connect');
  }

  // Fallback: when storage had no rules AND the WebSocket didn't connect,
  // flush any stale DNR state from a previous run so we don't leak rules
  // across sessions. Skipped if the hydrate path already applied an
  // initial snapshot — otherwise we'd double-log the same "init" update.
  setTimeout(() => {
    if (!didInitialApply && !isWebSocketConnected()) {
      scheduleUpdate('init', { immediate: true });
    }
  }, 1000);
}

installAlarmDispatch();
installNetworkEventHandlers();
installStorageListeners({ isExtensionInitialized: () => extensionInitialized });
installMessageRouting();

// ── Startup ───────────────────────────────────────────────────────

runtime.onStartup.addListener(() => {
  logger.info('Background', 'Browser started up');
  void initializeExtension();
});

runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
  logger.info('Background', 'Extension installed/updated:', details.reason);
  logger.info(
    'Background',
    'Browser:',
    isFirefox ? 'Firefox' : isChrome ? 'Chrome' : isEdge ? 'Edge' : isSafari ? 'Safari' : 'Unknown',
  );
  void initializeExtension();
});

logger.info('Background', 'Background script started');
// Release the hydration barrier even if init fails — we'd rather
// dispatch alarms against a partially-hydrated state than stall
// them forever. Real subsystem errors surface through their own
// catches (see the `recordRefreshError` path on live alarms).
void initializeExtension()
  .catch((err: unknown) => {
    logger.error('Background', 'Extension initialization failed', err);
  })
  .finally(() => {
    resolveBackgroundReady();
  });
