/**
 * Main background service worker — minimal orchestrator.
 *
 * Rule update ownership is centralized in rule-engine.ts. Rule / collection
 * / template data is owned entirely by the extension; per-workspace stores
 * in `modules/` are the single source of truth. Team workspaces synced
 * from the desktop app land in v2 through `workspace-orchestrator.ts`.
 */

declare const browser: typeof chrome | undefined;

import { RecordingService } from '@assets/recording/background/recording-service';
import type { V5 } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { isRuleEffective } from '@openheaders/core/utils';
import { broadcast } from '@utils/bridge';
import { alarms, isChrome, isEdge, isFirefox, isSafari, runtime, storage, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { bootstrapSettings } from '@utils/settings-bootstrap';
import { get as getSetting, subscribeKey } from '@/workbench/settings/store';
import { subscribe as subscribeStatus } from '@/shared/status';
import { extensionStorage, UI } from '@/shared/storage';
import type { HotkeyCommand } from '@/types/browser';
import type { IRecordingService } from '@/types/recording';
import { forgetDelayBypassForTab, markTabForDelayBypass, resolveDelayBypass, setRulesPaused } from './dnr-manager';
import { setupInjectListener } from './inject-manager';
import { updateExtensionBadge } from './modules/badge-manager';
import { forgetCacheBypassForTab, rehydrateCacheBypassFromSessionRules } from './modules/cache-bypass';
import { setupDevtoolsInspectorPorts } from './modules/devtools-inspector-port';
import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
  onEnvironmentStoreChange,
} from './modules/environment-store';
import { listFiles, onFilesStoreChange } from './modules/files-store';
// Module-load side effect: registers `liveChainAdapter` with the live
// scheduler via `__setLiveRefreshAdapter`. Import for its side effect
// even though we don't name anything from it here — the scheduler's
// adapter port is filled at eval time so the first alarm fires
// against a real chain runner rather than the Phase-C stub.
import './modules/live-chain-adapter';
import { onLiveCacheStoreChange } from './modules/live-cache-store';
import {
  handleLiveAlarm,
  isLiveRefreshAlarm,
  reconcileLiveSchedules,
  refreshLiveWorkflowSynchronously,
  startLiveScheduler,
} from './modules/live-refresh-scheduler';
import { getLiveVariables, onLiveVariableStoreChange } from './modules/live-variable-store';
import { getLiveWorkflows, onLiveWorkflowStoreChange } from './modules/live-workflow-store';
import { handleGeneralMessage } from './modules/message-handler';
import {
  handleOAuthAlarm,
  isOAuthRefreshAlarm,
  reconcileOAuthSchedules,
  startOAuthScheduler,
} from './modules/oauth-refresh-scheduler';
import { listTokenBundles, onOAuthStoreChange } from './modules/oauth-token-store';
import { hydrateObservabilityLog, recordLog } from './modules/observability-log';
import { setupOnRuleMatchedDebugBridge } from './modules/on-rule-matched-debug';
import { applyExternalSnapshot as applyPauseMarkersSnapshot, getPauseMarkers } from './modules/pause-markers-store';
import { auditHostPermissions } from './modules/permissions-audit';
import { handleRecordingMessage } from './modules/recording-handler';
import { initRecordingSync } from './modules/recording-sync';
import { setupRequestMonitoring } from './modules/request-monitor';
import { getRequests, onRequestStoreChange } from './modules/request-store';
import {
  getActiveRulesForTab,
  precompileRulePatterns,
  rehydrateTabTracking,
  restoreTrackingState,
  revalidateTrackedRequests,
} from './modules/request-tracker';
import { scheduleUpdate } from './modules/rule-engine';
import { rehydrateFromStorage as rehydrateObserverFromStorage } from './modules/rule-state-observer';
import { getCollectionTrees, getRules, onStoreChange } from './modules/rule-store';
import { initializeActiveTabTracking, setupPeriodicCleanup, setupTabListeners } from './modules/tab-listeners';
import { getTemplates, onTemplateStoreChange } from './modules/template-store';
import { pruneOrphanOwners } from './modules/test-run-store';
import { setupTestRunnerPorts } from './modules/test-runner';
import { __setSyncWarmRunner, getUnresolvableRuleUids, hydrateLiveCacheMirror } from './modules/variables-resolver';
import { initializeViewMode } from './modules/view-mode';
import { hydrateActiveWorkspaceStores } from './modules/workspace-orchestrator';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  listWorkspaces,
  onWorkspaceStoreChange,
} from './modules/workspace-store';
import { setupWorkspaceTabRegistry } from './modules/workspace-tab-registry';
import {
  connectWebSocket,
  getReconnectAttempts,
  isWebSocketConnected,
  isWebSocketConnecting,
  sendRecordingViaWebSocket,
  sendViaWebSocket,
} from './websocket';

// Workspace list must be bootstrapped first — every per-workspace store
// keys its reads off the active workspace id. Settings + per-workspace
// hydration chain off this promise.
const workspacesReady = bootstrapWorkspaces();

// Settings must be loaded before anything touches the rule engine — the
// first compile reads persisted `rulesEngine.paused`, `maxActiveRules`,
// `evaluationStrategy`, etc., and would otherwise race the async load.
const settingsReady = workspacesReady.then(bootstrapSettings).then(() => {
  setRulesPaused(getSetting('rulesEngine.paused'));
  subscribeKey('rulesEngine.paused', () => {
    setRulesPaused(getSetting('rulesEngine.paused'));
    scheduleUpdate('pause', { immediate: true });
    debouncedUpdateBadge();
  });
  initRecordingSync();
  // Engine knobs that affect the DNR compile force a full rebuild so
  // changes go live immediately.
  const rebuildOnPrefChange = (): void => scheduleUpdate('prefs', { immediate: true });
  subscribeKey('rulesEngine.maxActiveRules', rebuildOnPrefChange);
  subscribeKey('rulesEngine.evaluationStrategy', rebuildOnPrefChange);
});

/**
 * Compute the live rule + entity (folder/collection) id sets and ask the
 * test-run store to drop any owner bucket whose target is gone. Called
 * after every rule-store change so deletions cascade-clean orphan
 * test-run buckets.
 */
function pruneOrphanTestRunOwnersFromStore(): void {
  const liveRules = new Set<string>();
  const liveEntities = new Set<string>();
  for (const r of getRules()) liveRules.add(r.uid);
  for (const c of getCollectionTrees()) {
    liveEntities.add(c.uid);
    const walk = (nodes: V5.TreeNode[]): void => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          liveEntities.add(n.uid);
          walk(n.children);
        }
      }
    };
    walk(c.tree);
  }
  void pruneOrphanOwners(liveRules, liveEntities);
}

const recordingService: IRecordingService = new RecordingService();

// ── Badge update ──────────────────────────────────────────────────

async function updateBadgeForCurrentTab(): Promise<void> {
  const isConnected = isWebSocketConnected();
  const attempts = getReconnectAttempts();
  const isPaused = getSetting('rulesEngine.paused');

  tabs.query({ active: true, currentWindow: true }, async (tabList: chrome.tabs.Tab[]) => {
    const currentTab = tabList[0];

    if (currentTab?.id && recordingService.isRecording(currentTab.id)) return;

    const markers = getPauseMarkers();
    // Currently-effective workbench: enabled + complete + not paused at any
    // level + engine not paused + refs resolve — the single canonical
    // filter that every consumer (DNR compile loop, rule-state
    // observer, this badge filter) must share. NOT filtered by tab
    // URL: a rule targeting a subresource domain (e.g.
    // api.example.com) still counts when the tab is on example.com —
    // its counter increments via the subresource request.
    //
    // `getUnresolvableRuleUids` mirrors the DNR compile's hard gate:
    // workbench with unresolved `{{ref}}`s aren't shipped to Chrome, so
    // they shouldn't inflate the badge either.
    const unresolvable = getUnresolvableRuleUids();
    const effectiveRules = getRules().filter((r) => isRuleEffective(r, markers, isPaused) && !unresolvable.has(r.uid));
    const effectiveUids = new Set(effectiveRules.map((r) => r.uid));

    // Badge count = workbench pointed at this tab with a concrete signal.
    // Delegates to the verdict engine for consistency with the popup:
    // anything the engine labels `firing`, `silent`, or `page` counts
    // (firing = action ran; silent = matched but cache-suppressed;
    // page = pattern matches the tab URL, will fire on next request).
    // `related` (sibling-domain heuristic) is excluded — it's too weak
    // a signal to turn into a badge number that reads "N workbench active
    // on this page."
    let matchedRuleCount = 0;
    if (currentTab?.id != null && currentTab.url) {
      const { activeRules } = getActiveRulesForTab(currentTab.id, currentTab.url);
      for (const rule of activeRules) {
        if (!effectiveUids.has(rule.id)) continue;
        if (rule.verdict === 'firing' || rule.verdict === 'silent' || rule.verdict === 'page') {
          matchedRuleCount++;
        }
      }
    }
    await updateExtensionBadge({
      connected: isConnected,
      isPaused,
      recordingService,
      reconnectAttempts: attempts,
      matchedRuleCount,
      configuredRuleCount: effectiveRules.length,
    });
  });
}

const debouncedUpdateBadge = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void updateBadgeForCurrentTab();
    }, 100);
  };
})();

// ── Initialization ────────────────────────────────────────────────

let extensionInitialized = false;
async function initializeExtension(): Promise<void> {
  // All init paths must wait for the settings store so the first DNR
  // compile / websocket connect sees persisted values instead of defaults.
  await settingsReady;
  if (extensionInitialized) {
    if (getSetting('desktop.connection.autoConnect')) await connectWebSocket();
    return;
  }
  extensionInitialized = true;

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
  // permissions are narrowed, the Status pill flips red but workbench
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
    recordingService,
    reconnectAttempts: 0,
    matchedRuleCount: 0,
    configuredRuleCount: 0,
  });
  setupRequestMonitoring(debouncedUpdateBadge);
  setupTabListeners(debouncedUpdateBadge, recordingService);
  setupPeriodicCleanup();
  initializeActiveTabTracking();
  // Workspace tab ordinals must be live before the first intent
  // dispatch so the navigator's cold/warm logs can stamp `#<n>`.
  // The setup also runs a one-shot bootstrap against existing tabs
  // so ordinals repopulate after SW wake.
  setupWorkspaceTabRegistry();
  void initializeViewMode();
  setupInjectListener();
  setupDelayBypassCleanup();
  setupTestRunnerPorts();
  setupDevtoolsInspectorPorts();
  setupOnRuleMatchedDebugBridge();

  // Broadcast rule changes to all open extension pages (popup, workspace)
  // and prune any orphaned test-run owner buckets. The prune covers the
  // WebSocket-driven path where the desktop deletes workbench/folders without
  // going through message-handler's local CRUD handlers.
  onStoreChange(() => {
    broadcast('rulesUpdated', { rules: getRules() });
    pruneOrphanTestRunOwnersFromStore();
  });

  // Broadcast template changes to all open extension pages
  onTemplateStoreChange(() => {
    broadcast('templatesUpdated', { templates: getTemplates() });
  });

  // Broadcast request changes — request-store doesn't feed DNR (requests
  // are executed ad-hoc via the runner), so no scheduleUpdate here.
  onRequestStoreChange(() => {
    broadcast('requestsUpdated', { requests: getRequests() });
  });

  // Broadcast workspace list changes (create/rename/delete/reorder).
  // Active-workspace switches fire `workspaceChanged` explicitly from
  // the orchestrator; this covers metadata mutations.
  onWorkspaceStoreChange(() => {
    broadcast('workspaceChanged', {
      workspaces: listWorkspaces(),
      activeWorkspaceId: getActiveWorkspaceId(),
    });
  });

  // Env / workspace vars / vault / active-env mutations drive DNR
  // recompilation — resolved rule values depend on every scope above.
  // One listener covers all four because environment-store fires
  // `onEnvironmentStoreChange` after every mutation. The broadcast lets
  // UI surfaces (TopBar selector, Inspector Variables panel, sidebar
  // Environments section) refresh without each subscribing to four
  // separate channels.
  onEnvironmentStoreChange(() => {
    scheduleUpdate('vars', { immediate: true });
    broadcast('environmentsChanged', {
      environments: getEnvironments(),
      activeEnvironmentId: getActiveEnvironmentId(),
      defaultEnvironmentId: getDefaultEnvironmentId(),
      workspaceVariables: getWorkspaceVariables(),
      vault: getVault(),
    });
  });

  // Files (Phase 12.4b) — broadcast after every put / delete / purge
  // so sibling workspace tabs and the multipart body editor's file
  // picker see the new list immediately. `listFiles` reads IDB
  // (async) so we await before firing; the listener callback is
  // sync-void, so we kick a fire-and-forget async task here.
  onFilesStoreChange(() => {
    void (async () => {
      const files = await listFiles().catch(() => []);
      broadcast('filesChanged', { files });
    })();
  });

  // OAuth tokens (Phase 13) — broadcast after every authorize /
  // refresh / revoke so the AuthEditor's "Connected" badge updates
  // live across surfaces.
  onOAuthStoreChange(() => {
    void (async () => {
      const tokens = await listTokenBundles().catch(() => ({}));
      broadcast('oauthTokensChanged', { tokens });
    })();
  });

  // Live Variables + Workflows (Phase B) — broadcast after every
  // definition mutation so the sidebar + editors + rule-editor variable
  // picker stay in sync. Cache broadcasts carry the workflowUid so
  // consumers can filter to a single workflow's countdown without
  // re-reading every cached run.
  onLiveWorkflowStoreChange(() => {
    broadcast('liveWorkflowsChanged', { workflows: getLiveWorkflows() });
  });
  onLiveVariableStoreChange(() => {
    // LV name / enable / manualOverride changes flip what
    // `{{live.X}}` resolves to, so recompile DNR. The batch-by-hash
    // guard in `scheduleUpdate` no-ops when the emitted rule set is
    // unchanged — cheap on the no-referrers common case.
    scheduleUpdate('live-vars', { immediate: true });
    broadcast('liveVariablesChanged', { variables: getLiveVariables() });
  });
  onLiveCacheStoreChange((_workspaceId, workflowUid) => {
    // New cached captures land in the LiveRegistry on the next
    // compile. Rebuild now so DNR values follow the workflow's
    // refresh cadence (Phase C fires the alarm → Phase D adapter
    // writes captures → this listener rebuilds DNR → the user's
    // `Authorization: {{live.token}}` rule picks up the new token
    // within one debounce cycle).
    scheduleUpdate('live-cache', { immediate: true });
    broadcast('liveCacheChanged', { workflowUid });
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
  void reconcileLiveSchedules().catch((err: unknown) => {
    logger.warn('Background', 'Live scheduler reconcile failed', err);
  });

  setTimeout(() => restoreTrackingState(debouncedUpdateBadge), 1000);

  // Hydrate the active workspace's per-workspace stores from storage.
  await hydrateActiveWorkspaceStores();
  // Warm the live-cache mirror used by `variables-resolver` so the
  // first DNR compile after wake resolves `{{live.X}}` against real
  // captures rather than an empty registry. The mirror auto-refreshes
  // via `onLiveCacheStoreChange` after this point.
  await hydrateLiveCacheMirror();
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

  if (getSetting('desktop.connection.autoConnect')) {
    await connectWebSocket();
  } else {
    logger.info('Background', 'desktop.connection.autoConnect is off — skipping initial connect');
  }

  // Fallback: when storage had no workbench AND the WebSocket didn't connect,
  // flush any stale DNR state from a previous run so we don't leak workbench
  // across sessions. Skipped if the hydrate path already applied an
  // initial snapshot — otherwise we'd double-log the same "init" update.
  setTimeout(() => {
    if (!didInitialApply && !isWebSocketConnected()) {
      scheduleUpdate('init', { immediate: true });
    }
  }, 1000);
}

// ── Alarms ────────────────────────────────────────────────────────
//
// `updateBadge` is always-on — the icon badge is a core UX surface.
// `wsReconnect` is conditional on `desktop.connection.autoConnect`
// because its *only* job is to retry the websocket to the desktop
// companion; when the feature is off it's pure wake-up noise (every
// 30 s the SW would spin up just to log "skipping" and bail). We
// register/unregister the alarm when the setting flips so users who
// don't use desktop sync get a quiet, battery-friendly SW.
const WS_RECONNECT_ALARM = 'wsReconnect';

function applyWsReconnectAlarm(enabled: boolean): void {
  if (enabled) {
    alarms!.create(WS_RECONNECT_ALARM, { periodInMinutes: 0.5 });
  } else {
    alarms!.clear(WS_RECONNECT_ALARM);
  }
}

applyWsReconnectAlarm(getSetting('desktop.connection.autoConnect'));
alarms!.create('updateBadge', { delayInMinutes: 0.01, periodInMinutes: 0.033 });

subscribeKey('desktop.connection.autoConnect', () => {
  // Listener is a bare signal; read the fresh value via `getSetting`.
  const enabled = Boolean(getSetting('desktop.connection.autoConnect'));
  applyWsReconnectAlarm(enabled);
  // Flipping the setting on shouldn't leave the user waiting up to
  // 30 s for the first reconnect-alarm tick. `connectWebSocket` is
  // idempotent (bails if already connected / connecting) so calling
  // unconditionally is safe — the function itself re-checks the
  // `autoConnect` guard before actually opening a socket.
  if (enabled) void connectWebSocket();
});

alarms!.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === WS_RECONNECT_ALARM) {
    // Guard against a stale alarm firing after autoConnect flipped off
    // between `onAlarm` scheduling and this handler running.
    if (!getSetting('desktop.connection.autoConnect')) return;
    if (!isWebSocketConnected() && !isWebSocketConnecting()) {
      const attempts = getReconnectAttempts();
      const log = attempts <= 1 ? logger.info : logger.debug;
      log.call(logger, 'Background', 'WebSocket disconnected, reconnecting...');
      try {
        await connectWebSocket();
      } catch (error) {
        logger.debug('Background', 'Failed to reconnect:', (error as Error).message);
      }
    }
  } else if (alarm.name === 'updateBadge') {
    void updateBadgeForCurrentTab();
  } else if (isOAuthRefreshAlarm(alarm)) {
    await handleOAuthAlarm(alarm);
  } else if (isLiveRefreshAlarm(alarm)) {
    await handleLiveAlarm(alarm);
  }
});

// ── Storage listeners ─────────────────────────────────────────────

storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
  // Collection/folder pause markers — workspace-scoped key. Only react
  // to changes for the currently active workspace; other workspaces'
  // markers don't drive the DNR engine until they become active.
  if (area === 'local' && extensionInitialized) {
    const activeKey = `oh.ws.${getActiveWorkspaceId()}.pauseMarkers`;
    if (changes[activeKey]) {
      const record = (changes[activeKey].newValue as Record<string, PauseMarker>) || {};
      logger.info('Background', 'Pause markers changed:', record);
      applyPauseMarkersSnapshot(record);
      scheduleUpdate('pauseMarkers', { immediate: true });
      debouncedUpdateBadge();
    }
  }

  // Hotkey commands
  if (area === 'local' && changes.hotkeyCommand) {
    const command = changes.hotkeyCommand.newValue as HotkeyCommand | undefined;
    if (!command || command.type !== 'TOGGLE_RECORDING') return;

    tabs.query({ active: true, currentWindow: true }, (tabList: chrome.tabs.Tab[]) => {
      if (!tabList?.[0]) return;
      const tabId = tabList[0].id!;

      if (recordingService.isRecording(tabId)) {
        recordingService
          .stopRecording(tabId)
          .catch((e: Error) => logger.error('Background', 'Stop recording failed:', e));
      } else {
        tabs.query({}, (allTabs: chrome.tabs.Tab[]) => {
          for (const tab of allTabs) {
            if (tab.id && recordingService.isRecording(tab.id)) {
              recordingService
                .stopRecording(tab.id)
                .catch((e: Error) => logger.error('Background', 'Stop recording failed:', e));
              return;
            }
          }
          recordingService
            .startRecording(tabId, { useWidget: true })
            .catch((e: Error) => logger.error('Background', 'Start recording failed:', e));
        });
      }
    });

    void extensionStorage.remove(UI.hotkeyCommand);
  }
});

// ── Message listener ──────────────────────────────────────────────

runtime.onMessage.addListener(
  (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    const msg = message as Record<string, unknown>;

    // Delay-page bypass: the delay page finished its countdown and is about
    // to navigate to the real target. Mark the tab so the delay DNR rule is
    // suppressed for it, then respond only AFTER Chrome has committed the
    // updated DNR workbench so the follow-up navigation cannot race the rule
    // update and re-enter the delay loop. The target URL is stashed so the
    // bypass only clears when THAT specific navigation commits — not on an
    // unrelated Back-button or sibling navigation in the same tab.
    if (msg.type === 'oh-delay-bypass') {
      const tabId = sender.tab?.id;
      const target = typeof msg.target === 'string' ? msg.target : null;
      if (typeof tabId === 'number' && tabId >= 0 && target) {
        markTabForDelayBypass(tabId, target)
          .then(() => {
            try {
              sendResponse({ ok: true });
            } catch {
              /* channel closed — nothing to do */
            }
          })
          .catch((e: Error) => {
            logger.error('Background', 'Delay bypass failed:', e.message);
            try {
              sendResponse({ ok: false });
            } catch {
              /* channel closed */
            }
          });
        return true; // keep the message channel open for the async response
      }
      try {
        sendResponse({ ok: false });
      } catch {
        /* channel closed */
      }
      return false;
    }

    const recordingHandled = handleRecordingMessage(
      msg,
      sender,
      sendResponse,
      recordingService,
      sendRecordingViaWebSocket,
    );
    if (recordingHandled) return recordingHandled;

    return handleGeneralMessage(msg, sender, sendResponse, {
      isWebSocketConnected,
      sendViaWebSocket,
      scheduleUpdate,
      revalidateTrackedRequests,
      updateBadgeCallback: debouncedUpdateBadge,
    });
  },
);

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

/**
 * Clear a tab's delay-bypass entry once the specific navigation we stashed
 * for it actually lands. Matching on (tabId, committedUrl) means an unrelated
 * Back-button or sibling navigation in the same tab leaves the bypass alone
 * until the real target commits (or errors out, or the tab is closed, or the
 * 30-second TTL expires).
 */
function setupDelayBypassCleanup(): void {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  if (api.webNavigation?.onCommitted) {
    api.webNavigation.onCommitted.addListener(
      (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
        if (details.frameId !== 0) return;
        // Ignore commits of delay.html itself — we only care about the
        // follow-up navigation to the real target.
        if (details.url.startsWith(api.runtime.getURL('delay.html'))) return;
        resolveDelayBypass(details.tabId, details.url);
      },
    );
  }

  // Navigation failed (DNS error, aborted, network offline, etc.) — clear
  // the bypass so the tab isn't stuck exempt until TTL.
  if (api.webNavigation?.onErrorOccurred) {
    api.webNavigation.onErrorOccurred.addListener((details: { tabId: number; frameId: number; url: string }) => {
      if (details.frameId !== 0) return;
      resolveDelayBypass(details.tabId, details.url);
    });
  }

  // Tab closed — drop any stashed entry.
  if (api.tabs?.onRemoved) {
    api.tabs.onRemoved.addListener((tabId: number) => {
      forgetDelayBypassForTab(tabId);
      void forgetCacheBypassForTab(tabId);
    });
  }
}

logger.info('Background', 'Background script started');
void initializeExtension();
