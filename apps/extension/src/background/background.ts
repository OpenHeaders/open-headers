/**
 * Background service worker — thin orchestrator.
 *
 * Module-load ordering matters: every `install*` below must run before any
 * code that depends on the surface it wires. Concretely:
 *   - host-install populates the blob backend + sync persistence; every
 *     blob read throws if it runs first.
 *   - oracle-host-hooks must be in place before bootSyncEngine runs so the
 *     first envelope finds the broadcast / recordLog / reportStatus hooks.
 *   - sync-handshake creates the initiator that ws-frame-routing and
 *     status-reporters both reference.
 *
 * The deep wiring lives under `./bootstrap/`. This file sequences it and
 * owns the public lifecycle entry points (`runtime.onStartup`/`onInstalled`).
 */

import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-lifeline-server';
import './modules/live-chain-adapter';

import { getHostStorage, OH } from '@openheaders/core/storage';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import { __setSyncWarmRunner, hydrateLiveCacheMirror } from '@openheaders/oracle/rule-engine/variables-resolver';
import { markBootPhase } from '@openheaders/oracle/sync/boot-telemetry';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { isChrome, isEdge, isFirefox, isSafari, runtime } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { bootstrapSettings } from '@utils/settings-bootstrap';

import { installActivityBroadcasts } from './bootstrap/activity-broadcasts';
import { installAlarmDispatch } from './bootstrap/alarm-dispatch';
import { resolveBackgroundReady } from './bootstrap/background-ready';
import { debouncedUpdateBadge } from './bootstrap/badge-update';
import { setupDelayBypassCleanup } from './bootstrap/delay-bypass-cleanup';
import { bootstrapIdentity } from './bootstrap/identity-init';
import { installHostAdapters } from './bootstrap/host-install';
import { startLifecyclePipeline } from './bootstrap/lifecycle-pipeline';
import { installMessageRouting } from './bootstrap/message-routing';
import { installNetworkEventHandlers } from './bootstrap/network-events';
import { installOracleHostHooks } from './bootstrap/oracle-host-hooks';
import { installStatusReporters } from './bootstrap/status-reporters';
import { installStorageListeners } from './bootstrap/storage-listeners';
import { installStoreBroadcasts } from './bootstrap/store-broadcasts';
import { setupSyncHandshake } from './bootstrap/sync-handshake';
import { installWsFrameRouting } from './bootstrap/ws-frame-routing';

import { setRulesPaused } from './dnr-manager';
import { setupInjectListener } from './inject-manager';
import { updateExtensionBadge } from './modules/badge-manager';
import { rehydrateCacheBypassFromSessionRules } from './modules/cache-bypass';
import {
  kickActiveContextRefresh,
  reconcileLiveSchedules,
  refreshLiveWorkflowSynchronously,
  startLiveScheduler,
} from './modules/live-refresh-scheduler';
import { reconcileOAuthSchedules, startOAuthScheduler } from './modules/oauth-refresh-scheduler';
import { hydrateObservabilityLog, recordLog } from './modules/observability-log';
import { auditHostPermissions } from './modules/permissions-audit';
import { precompileRulePatterns, rehydrateTabTracking, restoreTrackingState } from './modules/request-tracker';
import { scheduleUpdate } from './modules/rule-engine';
import { rehydrateFromStorage as rehydrateObserverFromStorage } from './modules/rule-state-observer';
import { initializeActiveTabTracking, setupPeriodicCleanup, setupTabListeners } from './modules/tab-listeners';
import { setupTestRunnerPorts } from './modules/test-runner';
import { bootstrapTotpScheduler } from './modules/totp-scheduler';
import { initializeViewMode } from './modules/view-mode';
import { hydrateActiveWorkspaceStores } from './modules/workspace-orchestrator';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
} from './modules/workspace-store';
import { setupWorkspaceTabRegistry } from './modules/workspace-tab-registry';
import { connectWebSocket, isWebSocketConnected, shouldAttemptBackendConnection } from './websocket';

// ── Eval-time wiring ──────────────────────────────────────────────

installHostAdapters();
installOracleHostHooks();
const handshake = setupSyncHandshake();
installWsFrameRouting({ handshake });
installStatusReporters({ handshake });
installActivityBroadcasts();

// Workspaces are bootstrapped first because every per-workspace store
// keys its reads off the active workspace id.
const workspacesReady = bootstrapWorkspaces();

// Settings load before the rule engine compiles so persisted knobs
// (`rulesEngine.paused`, `maxActiveRules`, `evaluationStrategy`) are live
// before the first DNR rebuild.
const settingsReady = workspacesReady.then(bootstrapSettings).then(() => {
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
    refreshFanOut: () => handshake.initiator.refreshFanOut(),
    tryAdoptPendingWorkspace: handshake.tryAdoptPendingWorkspace,
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
  // Cold-wake catch-up — reconcile alone schedules the next alarm at the
  // MV3 30 s floor, so anything already-overdue needs an inline refresh
  // to repopulate the cache within one network round-trip of wake-up.
  void kickActiveContextRefresh(getActiveWorkspaceId(), getActiveEnvironmentId()).catch((err: unknown) => {
    logger.warn('Background', 'Live scheduler wake-up catch-up failed', err);
  });
  await hydrateLiveCacheMirror();
  await bootstrapTotpScheduler(() => scheduleUpdate('totp', { immediate: true }));

  const restoredRules = getRules();
  // Observer + cache-bypass + tab-tracking must rehydrate BEFORE the first
  // rebuildAll so diffs see the pre-sleep baseline rather than empty state.
  await rehydrateObserverFromStorage();
  await rehydrateCacheBypassFromSessionRules();
  await rehydrateTabTracking();
  let didInitialApply = false;
  if (restoredRules.length > 0) {
    logger.info('Background', `Restored ${restoredRules.length} rules from storage`);
    precompileRulePatterns();
    scheduleUpdate('init', { immediate: true });
    didInitialApply = true;
  }

  // Reach is live connection state; clear any value left over from a prior
  // SW lifetime so a stale tier never outlives its socket. A WELCOME
  // repopulates it; modes with no socket correctly leave it null.
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
