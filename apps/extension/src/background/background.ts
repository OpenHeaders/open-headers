/**
 * Background service worker — thin orchestrator.
 *
 * Module-load ordering matters: every `install*` below must run before any
 * code that depends on the surface it wires. Concretely:
 *   - host-install populates the blob backend + sync persistence; every
 *     blob read throws if it runs first.
 *   - oracle-host-hooks must be in place before bootSyncEngine runs so the
 *     first envelope finds the broadcast / recordLog / reportStatus hooks.
 *   - ws-frame-routing installs the per-wire sync wiring whose handshake
 *     registry status-reporters and the probes below reference.
 *
 * The deep wiring lives under `./bootstrap/`. This file sequences it and
 * owns the public lifecycle entry points (`runtime.onStartup`/`onInstalled`).
 */

import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-cdp-capability';
import '@/host/install-lifeline-server';
import './modules/live-chain-adapter';
// Adapter installs for the shared backend client plane: websocket.ts
// hands the connection manager its chrome-bound deps; the aggregate
// module installs the sync-status roll-up sink.
import './websocket';
import './sync-status-aggregate';

import {
  getBackends,
  refreshBackendsFromHostStorage,
  resetBackendReach,
  watchBackendsInHostStorage,
} from '@openheaders/core/backends';
import { getIdentitySnapshot } from '@openheaders/core/identity';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import {
  getFallbackPriorityForWorkspace,
  maybeEnlistSelfInFallbackPriority,
} from '@openheaders/oracle/live/fallback-priority-store';
import { __setSyncWarmRunner, hydrateLiveCacheMirror } from '@openheaders/oracle/rule-engine/variables-resolver';
import { markBootPhase } from '@openheaders/oracle/sync/boot-telemetry';
import {
  connectWebSocket,
  isWebSocketConnected,
  shouldAttemptBackendConnection,
  subscribeOnWebSocketClose,
  subscribeOnWebSocketOpen,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { isChrome, isEdge, isFirefox, isSafari, runtime } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { bootstrapSettings } from '@utils/settings-bootstrap';

import { installActivityBroadcasts } from './bootstrap/activity-broadcasts';
import { installAlarmDispatch } from './bootstrap/alarm-dispatch';
import { resolveBackgroundReady } from './bootstrap/background-ready';
import { debouncedUpdateBadge } from './bootstrap/badge-update';
import { installCdpMasterSwitch } from './bootstrap/cdp-master-switch';
import { installCdpScopeMode } from './bootstrap/cdp-scope-mode';
import { setupDelayBypassCleanup } from './bootstrap/delay-bypass-cleanup';
import { installHostAdapters } from './bootstrap/host-install';
import { bootstrapIdentity } from './bootstrap/identity-init';
import { startLifecyclePipeline } from './bootstrap/lifecycle-pipeline';
import { installLifecycleStatusReporters } from './bootstrap/lifecycle-status-reporters';
import { installMessageRouting } from './bootstrap/message-routing';
import { installNetworkEventHandlers } from './bootstrap/network-events';
import { installOracleHostHooks } from './bootstrap/oracle-host-hooks';
import { installProductTelemetrySyncBeacons } from './bootstrap/product-telemetry-beacons';
import { installStatusReporters } from './bootstrap/status-reporters';
import { installStorageListeners } from './bootstrap/storage-listeners';
import { installStoreBroadcasts } from './bootstrap/store-broadcasts';
import { installWsFrameRouting } from './bootstrap/ws-frame-routing';
import { setRulesPaused } from './dnr-manager';
import { installGrpcStreamRelay } from './grpc-stream-relay';
import { setupInjectListener } from './inject-manager';
import { updateExtensionBadge } from './modules/badge-manager';
import {
  kickActiveContextRefresh,
  reconcileLiveSchedules,
  refreshLiveWorkflowSynchronously,
  setBackendConnectionProbe,
  setBackendEvictedProbe,
  setFallbackPriorityProbe,
  startLiveScheduler,
} from './modules/live-refresh-scheduler';
import { resumeOrphanedMigrationPull } from './modules/migration-run/orphan-resume';
import { rehydrateCacheBypassFromSessionRules } from './modules/net/cache-bypass';
import { rehydrateNetworkConditionsFromSession } from './modules/net/network-conditions';
import { reconcileOAuthSchedules, startOAuthScheduler } from './modules/oauth-refresh-scheduler';
import { hydrateObservabilityLog, recordLog } from './modules/observability-log';
import { auditHostPermissions } from './modules/permissions-audit';
import { initProductTelemetry } from './modules/product-telemetry';
import { precompileRulePatterns, rehydrateTabTracking, restoreTrackingState } from './modules/request-tracker';
import { installParityFireReadback } from './modules/rules/parity-fire-readback';
import { installParityRuleImport } from './modules/rules/parity-rule-import';
import { scheduleUpdate } from './modules/rules/rule-engine';
import { rehydrateFromStorage as rehydrateObserverFromStorage } from './modules/rules/rule-state-observer';
import { hydrateSyncInstallId } from './modules/sync-install-id';
import { registerCdpTabPinControls } from './modules/tabs/cdp-tab-pin';
import { initializeActiveTabTracking, setupPeriodicCleanup, setupTabListeners } from './modules/tabs/tab-listeners';
import { rehydrateTabOverridesFromSession } from './modules/tabs/tab-overrides';
import { bootstrapTotpScheduler } from './modules/totp-scheduler';
import { initializeViewMode } from './modules/view-mode';
import { hydrateActiveWorkspaceStores } from './modules/workspace/workspace-orchestrator';
import { bootstrap as bootstrapWorkspaces, getActiveWorkspaceId } from './modules/workspace/workspace-store';
import { setupWorkspaceTabRegistry } from './modules/workspace/workspace-tab-registry';
import { selfHostLabel } from './self-host-label';

// ── Eval-time wiring ──────────────────────────────────────────────

installHostAdapters();
installOracleHostHooks();
const syncWiring = installWsFrameRouting();
installStatusReporters({ syncWiring });
installProductTelemetrySyncBeacons(syncWiring);
installActivityBroadcasts();
// Forwarded gRPC invokes: the companion's live grpcStreamEvent frames
// come back down the backend wire — relay them to the local broadcast.
installGrpcStreamRelay();
// Dev seams for the playground's probes/runners — inert unless the
// driver sets the parity-hook flag (see the module docs).
installParityRuleImport();
installParityFireReadback();

// Workspaces are bootstrapped first because every per-workspace store
// keys its reads off the active workspace id.
const workspacesReady = bootstrapWorkspaces();

// Settings load before the rule engine compiles so persisted knobs
// (`rulesEngine.paused`, `maxActiveRules`, `evaluationStrategy`) are live
// before the first DNR rebuild. The backend registry hydrates in the
// same phase — its mirror must be warm before the connection plane
// (websocket / alarm-dispatch / handshake) evaluates whether a wire is
// wanted, and its watch keeps cross-context settings-pane edits live.
const settingsReady = workspacesReady
  .then(bootstrapSettings)
  // The install id must be warm before the registry can trigger a dial —
  // every HELLO carries it as the peer's stable telemetry identity.
  .then(() => hydrateSyncInstallId())
  .then(() => refreshBackendsFromHostStorage())
  .then(() => {
    watchBackendsInHostStorage();
    markBootPhase('settings-ready');
    setRulesPaused(getSetting('rulesEngine.paused'));
    subscribeKey('rulesEngine.paused', () => {
      setRulesPaused(getSetting('rulesEngine.paused'));
      scheduleUpdate('pause', { immediate: true });
      debouncedUpdateBadge();
    });
    const rebuildOnPrefChange = (): void => scheduleUpdate('prefs', { immediate: true });
    subscribeKey('rulesEngine.maxActiveRules', rebuildOnPrefChange);
    subscribeKey('rulesEngine.evaluationStrategy', rebuildOnPrefChange);
  });

// ── Initialization ────────────────────────────────────────────────

let extensionInitialized = false;

async function initializeExtension(): Promise<void> {
  await settingsReady;
  if (extensionInitialized) {
    if (shouldAttemptBackendConnection()) await connectWebSocket();
    return;
  }
  extensionInitialized = true;

  await bootstrapIdentity();

  // After settingsReady (awaited above): the enabled gate reads the
  // hydrated settings store. Fire-and-forget — nothing awaits telemetry.
  initProductTelemetry();

  await hydrateObservabilityLog();
  recordLog({
    subsystem: 'extension',
    op: 'sw-init',
    level: 'info',
    message: 'Service worker initialized',
    context: {},
  });
  // Permissions audit flips the Status pill but never blocks init.
  void auditHostPermissions();

  await updateExtensionBadge({
    connected: false,
    isPaused: false,
    reconnectAttempts: 0,
    matchedRuleCount: 0,
    configuredRuleCount: 0,
  });

  const { lifecycleStore, setCdpEnabled, setCdpScopeMode, cdpAttach, pinCdpTab, unpinCdpTab } =
    startLifecyclePipeline();
  installCdpMasterSwitch(setCdpEnabled);
  installCdpScopeMode(setCdpScopeMode);
  registerCdpTabPinControls({ pin: pinCdpTab, unpin: unpinCdpTab });
  installLifecycleStatusReporters({ cdpAttach });

  setupTabListeners({ updateBadge: debouncedUpdateBadge, lifecycleStore });
  setupPeriodicCleanup();
  initializeActiveTabTracking();
  setupWorkspaceTabRegistry();
  void initializeViewMode();
  setupInjectListener();
  setupDelayBypassCleanup();

  installStoreBroadcasts({
    refreshFanOut: () => syncWiring.refreshFanOut(),
    tryAdoptPendingWorkspace: () => syncWiring.tryAdoptPendingWorkspaces(),
  });

  // OAuth scheduler reads tokens directly from storage so it can reconcile
  // before workspace hydration. Subscribe before reconcile so a write that
  // races init still triggers rescheduling.
  startOAuthScheduler();
  void reconcileOAuthSchedules().catch((err: unknown) => {
    logger.warn('Background', 'OAuth scheduler reconcile failed', err);
  });

  // Live scheduler subscribes here, but its reconcile is deferred below —
  // `collectEntries` reads in-memory workflow/variable stores populated by
  // hydration, and running reconcile early would wipe every alarm as orphan.
  startLiveScheduler();
  // Cadence ownership (WS-C C8): give the live scheduler a live read of
  // the backend socket so a connected peer defers its own cadence to the
  // backend's runner, and re-reconcile the moment connectivity flips —
  // socket close → drop back to the peer's own (earlier) cadence; socket
  // open → re-defer as synced values land and re-stamp the rows. These
  // callbacks only fire on real socket events (well after hydration), so
  // registering them here doesn't trip the early-reconcile orphan-wipe
  // hazard the deferred `reconcileLiveSchedules` below guards against.
  setBackendConnectionProbe(isWebSocketConnected);
  // Eviction signal (audit X-1): tell the offline-fallback gate when the
  // socket is down because the backend REJECTED this peer (revoked/rotated
  // token), not because it's unreachable. A revoked peer must NOT self-elect
  // an exclusive cred against the still-live backend — it banners + re-pairs
  // instead. Sticky across the reconnect-backoff flap (see `isBackendEvicting`).
  setBackendEvictedProbe(() => syncWiring.isAnyBackendEvicting());
  // Offline fallback (WS-C C14): give the live scheduler a read of the
  // workspace's frozen priority list + this host's identity so an
  // *exclusive* workflow whose configured backend is offline runs on
  // exactly one elected peer instead of racing across the partitioned
  // browsers. Pure Mode-1 (no backend attached) returns null → the gate
  // stays off and the SW remains the self-sufficient sole runner (plan §8).
  // An empty `order` is the safe default (no host elected → "reconnect the
  // desktop" banner, never a race).
  setFallbackPriorityProbe((workspaceId) => {
    if (!getBackends().some((b) => b.enabled)) return null;
    return {
      order: getFallbackPriorityForWorkspace(workspaceId),
      selfPrincipalId: getIdentitySnapshot()?.principal.id ?? null,
    };
  });
  // Auto-seed (WS-C C14): enlist this host in the active workspace's
  // offline-fallback ranking when it holds an exclusive workflow's consumed
  // seed and isn't already listed. Gated on a live, non-in-browser backend
  // so the seed has caught up and the enlist mutation can sync up. The list
  // only has to be correct by the time the backend next goes offline, so
  // running this on every (re)connect is sufficient — the enlist itself is
  // idempotent (a no-op when already listed or ineligible).
  const enlistActiveWorkspaceFallbackPriority = (): void => {
    if (!getBackends().some((b) => b.enabled)) return;
    if (!isWebSocketConnected()) return;
    void maybeEnlistSelfInFallbackPriority(getActiveWorkspaceId(), selfHostLabel()).catch((err: unknown) =>
      logger.warn('Background', 'Fallback-priority enlist failed', err),
    );
  };
  subscribeOnWebSocketOpen(() => {
    void reconcileLiveSchedules().catch((err: unknown) =>
      logger.warn('Background', 'Live reconcile after socket open failed', err),
    );
    enlistActiveWorkspaceFallbackPriority();
  });
  subscribeOnWebSocketClose(() => {
    void reconcileLiveSchedules().catch((err: unknown) =>
      logger.warn('Background', 'Live reconcile after socket close failed', err),
    );
  });
  __setSyncWarmRunner(refreshLiveWorkflowSynchronously);

  setTimeout(() => restoreTrackingState(debouncedUpdateBadge), 1000);

  await hydrateActiveWorkspaceStores();
  markBootPhase('hydration-done');

  await bootSyncEngine();
  markBootPhase('sync-init-done');
  markBootPhase('bridge-done');
  // Release the alarm-dispatch barrier here rather than at end-of-init —
  // the remaining steps either read storage directly or aren't on the
  // alarm dispatch path.
  markBootPhase('interactive');
  resolveBackgroundReady();

  void reconcileLiveSchedules().catch((err: unknown) => {
    logger.warn('Background', 'Live scheduler reconcile failed', err);
  });
  // Cold-wake enlist: an SW that restarts while the backend is already
  // connected won't see a fresh socket-open, so enlist here too (gated on
  // a live connection inside the helper).
  enlistActiveWorkspaceFallbackPriority();
  // Cold-wake catch-up — reconcile alone schedules the next alarm at the
  // MV3 30 s floor, so anything already-overdue needs an inline refresh
  // to repopulate the cache within one network round-trip of wake-up.
  void kickActiveContextRefresh(getActiveWorkspaceId(), getActiveEnvironmentId()).catch((err: unknown) => {
    logger.warn('Background', 'Live scheduler wake-up catch-up failed', err);
  });
  await hydrateLiveCacheMirror();
  await bootstrapTotpScheduler(() => scheduleUpdate('totp', { immediate: true }));

  // Orphaned account-pull detection: an SW that died mid-pull resumes
  // silently with the session key, or surfaces the run as interrupted
  // when a browser restart cleared it. After hydration + sync boot so a
  // resumed run's materialization tail writes through live stores.
  void resumeOrphanedMigrationPull().catch((err: unknown) => {
    logger.warn('Background', 'Migration pull orphan detection failed', err);
  });

  const restoredRules = getRules();
  // Observer + cache-bypass + tab-tracking must rehydrate BEFORE the first
  // rebuildAll so diffs see the pre-sleep baseline rather than empty state.
  await rehydrateObserverFromStorage();
  await rehydrateCacheBypassFromSessionRules();
  await rehydrateNetworkConditionsFromSession();
  await rehydrateTabOverridesFromSession();
  await rehydrateTabTracking();
  let didInitialApply = false;
  if (restoredRules.length > 0) {
    logger.info('Background', `Restored ${restoredRules.length} rules from storage`);
    precompileRulePatterns();
    scheduleUpdate('init', { immediate: true });
    didInitialApply = true;
  }

  // Reach is live connection state; clear any entries left over from a
  // prior SW lifetime so a stale tier never outlives its socket. Each
  // WELCOME repopulates its own entry; no socket correctly leaves none.
  void resetBackendReach().catch(() => {
    /* best-effort */
  });

  if (shouldAttemptBackendConnection()) {
    await connectWebSocket();
  } else if (!getBackends().some((b) => b.enabled)) {
    logger.info('Background', 'no back-end connection configured — service worker is the back-end, no wire to open');
  } else {
    logger.info('Background', 'auto-connect is off — skipping initial connect');
  }

  // Fallback: storage had no rules AND no WebSocket — flush any stale DNR
  // state from a previous run. Skipped when the hydrate path already
  // applied an init snapshot.
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
// Release the barrier even on init failure — better to dispatch alarms
// against partially-hydrated state than to stall them forever.
void initializeExtension()
  .catch((err: unknown) => {
    logger.error('Background', 'Extension initialization failed', err);
  })
  .finally(() => {
    resolveBackgroundReady();
  });
