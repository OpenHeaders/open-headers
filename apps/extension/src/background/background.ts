/**
 * Main background service worker — minimal orchestrator.
 *
 * Rule update ownership is centralized in rule-engine.ts.
 * Rules arrive pre-resolved from the desktop app via WebSocket.
 */

declare const browser: typeof chrome | undefined;

import { RecordingService } from '@assets/recording/background/recording-service';
import { alarms, isChrome, isEdge, isFirefox, isSafari, runtime, storage, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { HotkeyCommand } from '@/types/browser';
import type { IRecordingService } from '@/types/recording';
import { getDisabledTagGroups, initPauseState, setDisabledTagGroups, setRulesPaused } from './dnr-manager';
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
import { getRules, hydrateFromStorage, onStoreChange } from './modules/rule-store';
import { setupPeriodicCleanup, setupTabListeners } from './modules/tab-listeners';
import { generateRulesHash } from './modules/utils';
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
      const disabledGroups = new Set(getDisabledTagGroups());
      const activeRules = allMatchingRules.filter(
        (r) => r.isEnabled !== false && !disabledGroups.has((r.tags as string[])?.[0] || '__no_tag__'),
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
  setupInjectListener();

  // Broadcast rule changes to all open extension pages (popup, workspace)
  onStoreChange(() => {
    try {
      runtime.sendMessage({ type: 'rulesUpdated', rules: getRules() });
    } catch {
      // No listeners — popup/workspace not open
    }
  });

  setTimeout(() => restoreTrackingState(debouncedUpdateBadge), 1000);

  // Hydrate rules from storage (offline start before WebSocket connects)
  const restoredRules = await hydrateFromStorage();
  if (restoredRules.length > 0) {
    logger.info('Background', `Restored ${restoredRules.length} rules from storage`);
    precompileRulePatterns();
    scheduleUpdate('init', { immediate: true });
  }

  await connectWebSocket();

  // Fallback: if WebSocket didn't provide rules, apply whatever we have
  setTimeout(() => {
    if (!isWebSocketConnected()) {
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

  // Tag groups
  if (area === 'local' && changes.disabledTagGroups) {
    const groups = (changes.disabledTagGroups.newValue as string[]) || [];
    logger.info('Background', 'Disabled tag groups changed:', groups);
    setDisabledTagGroups(groups);
    scheduleUpdate('tagGroups', { immediate: true });
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
        recordingService.stopRecording(tabId).catch((e: Error) => logger.error('Background', 'Stop recording failed:', e));
      } else {
        tabs.query({}, (allTabs: chrome.tabs.Tab[]) => {
          for (const tab of allTabs) {
            if (tab.id && recordingService.isRecording(tab.id)) {
              recordingService.stopRecording(tab.id).catch((e: Error) => logger.error('Background', 'Stop recording failed:', e));
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
    const recordingHandled = handleRecordingMessage(msg, sender, sendResponse, recordingService, sendRecordingViaWebSocket);
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

logger.info('Background', 'Background script started');
void initializeExtension();
