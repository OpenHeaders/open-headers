/**
 * Main background service worker — minimal orchestrator.
 *
 * Rule update ownership is centralized in rule-engine.ts.
 * Rules arrive pre-resolved from the desktop app via WebSocket.
 */

declare const browser: typeof chrome | undefined;

import { RecordingService } from '@assets/recording/background/recording-service';
import type { V5 } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { resolvePauseState } from '@openheaders/core/utils';
import { alarms, isChrome, isEdge, isFirefox, isSafari, runtime, storage, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { HotkeyCommand } from '@/types/browser';
import type { IRecordingService } from '@/types/recording';
import {
  forgetDelayBypassForTab,
  getPauseMarkers,
  initPauseState,
  markTabForDelayBypass,
  resolveDelayBypass,
  setPauseMarkers,
  setRulesPaused,
} from './dnr-manager';
import { setupInjectListener } from './inject-manager';
import { updateExtensionBadge } from './modules/badge-manager';
import { handleGeneralMessage } from './modules/message-handler';
import { handleRecordingMessage } from './modules/recording-handler';
import { setupRequestMonitoring } from './modules/request-monitor';
import {
  getActiveRulesForTab,
  precompileRulePatterns,
  restoreTrackingState,
  revalidateTrackedRequests,
} from './modules/request-tracker';
import { scheduleUpdate } from './modules/rule-engine';
import { getLocalCollectionTrees, getRules, hydrateFromStorage, onStoreChange } from './modules/rule-store';
import { initializeActiveTabTracking, setupPeriodicCleanup, setupTabListeners } from './modules/tab-listeners';
import { getTemplates, hydrateTemplatesFromStorage, onTemplateStoreChange } from './modules/template-store';
import { pruneOrphanOwners } from './modules/test-run-store';
import { setupTestRunnerPorts } from './modules/test-runner';
import {
  connectWebSocket,
  getReconnectAttempts,
  isWebSocketConnected,
  isWebSocketConnecting,
  sendRecordingViaWebSocket,
  sendViaWebSocket,
} from './websocket';

void logger.initialize();
initPauseState();

/**
 * Compute the live rule + entity (folder/collection) id sets and ask the
 * test-run store to drop any owner bucket whose target is gone. Called
 * after every rule-store change so deletions driven by the WebSocket also
 * cascade-clean orphan test-run buckets.
 */
function pruneOrphanTestRunOwnersFromStore(): void {
  const liveRules = new Set<string>();
  const liveEntities = new Set<string>();
  for (const r of getRules()) liveRules.add(r.uid);
  for (const c of getLocalCollectionTrees()) {
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

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  browserAPI.storage.sync.get(['isRulesExecutionPaused'], async (result: { [key: string]: unknown }) => {
    const isPaused = (result.isRulesExecutionPaused as boolean) || false;

    tabs.query({ active: true, currentWindow: true }, async (tabList: chrome.tabs.Tab[]) => {
      const currentTab = tabList[0];
      const currentUrl = currentTab?.url || '';

      if (currentTab?.id && recordingService.isRecording(currentTab.id)) return;

      const { activeRules: allMatchingRules } = getActiveRulesForTab(currentTab?.id, currentUrl);
      const markers = getPauseMarkers();
      const activeRules = allMatchingRules.filter(
        (r) => r.isEnabled !== false && !resolvePauseState(r.path, markers),
      );
      await updateExtensionBadge(isConnected, activeRules, isPaused, recordingService, attempts);
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
  if (extensionInitialized) {
    await connectWebSocket();
    return;
  }
  extensionInitialized = true;

  await updateExtensionBadge(false, [], false, recordingService, 0);
  setupRequestMonitoring(debouncedUpdateBadge);
  setupTabListeners(debouncedUpdateBadge, recordingService);
  setupPeriodicCleanup();
  initializeActiveTabTracking();
  setupInjectListener();
  setupDelayBypassCleanup();
  setupTestRunnerPorts();

  // Broadcast rule changes to all open extension pages (popup, workspace)
  // and prune any orphaned test-run owner buckets. The prune covers the
  // WebSocket-driven path where the desktop deletes rules/folders without
  // going through message-handler's local CRUD handlers.
  onStoreChange(() => {
    try {
      runtime.sendMessage({ type: 'rulesUpdated', rules: getRules() });
    } catch {
      // No listeners — popup/workspace not open
    }
    pruneOrphanTestRunOwnersFromStore();
  });

  // Broadcast template changes to all open extension pages
  onTemplateStoreChange(() => {
    try {
      runtime.sendMessage({ type: 'templatesUpdated', templates: getTemplates() });
    } catch {
      // No listeners — popup/workspace not open
    }
  });

  setTimeout(() => restoreTrackingState(debouncedUpdateBadge), 1000);

  // Hydrate rules + templates from storage (offline start before WebSocket connects)
  await hydrateTemplatesFromStorage();
  const restoredRules = await hydrateFromStorage();
  let didInitialApply = false;
  if (restoredRules.length > 0) {
    logger.info('Background', `Restored ${restoredRules.length} rules from storage`);
    precompileRulePatterns();
    scheduleUpdate('init', { immediate: true });
    didInitialApply = true;
  }

  await connectWebSocket();

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

// ── Alarms ────────────────────────────────────────────────────────

alarms!.create('keepAlive', { periodInMinutes: 0.5 });
alarms!.create('updateBadge', { delayInMinutes: 0.01, periodInMinutes: 0.033 });

alarms!.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === 'keepAlive') {
    logger.debug('Background', 'Keep alive ping');
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
  }
});

// ── Storage listeners ─────────────────────────────────────────────

storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
  // Pause state
  if (area === 'sync' && changes.isRulesExecutionPaused) {
    const paused = (changes.isRulesExecutionPaused.newValue as boolean) || false;
    logger.info('Background', 'Pause state changed to:', paused);
    setRulesPaused(paused);
    scheduleUpdate('pause', { immediate: true });
    debouncedUpdateBadge();
  }

  // Collection/folder pause markers
  if (area === 'local' && changes.pauseMarkers) {
    const record = (changes.pauseMarkers.newValue as Record<string, PauseMarker>) || {};
    logger.info('Background', 'Pause markers changed:', record);
    setPauseMarkers(record);
    scheduleUpdate('pauseMarkers', { immediate: true });
    debouncedUpdateBadge();
  }

  // Log level
  if (area === 'sync' && changes.logLevel) {
    const newLevel = changes.logLevel.newValue as string;
    if (newLevel) logger.setLevel(newLevel as 'error' | 'warn' | 'info' | 'debug');
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

    storage.local.remove('hotkeyCommand');
  }
});

// ── Message listener ──────────────────────────────────────────────

runtime.onMessage.addListener(
  (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    const msg = message as Record<string, unknown>;

    // Delay-page bypass: the delay page finished its countdown and is about
    // to navigate to the real target. Mark the tab so the delay DNR rule is
    // suppressed for it, then respond only AFTER Chrome has committed the
    // updated DNR rules so the follow-up navigation cannot race the rule
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
    api.tabs.onRemoved.addListener((tabId: number) => forgetDelayBypassForTab(tabId));
  }
}

logger.info('Background', 'Background script started');
void initializeExtension();
