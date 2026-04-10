/**
 * Message Handler — handles non-recording messages from the popup.
 */

import type { V5 } from '@openheaders/core/types';
import { runtime as browserRuntime, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { MessageHandlerContext, SendResponse } from '@/types/browser';
import { clearAllTracking, getActiveRulesForTab } from './request-tracker';
import {
  addLocalRule,
  addLocalRuleToCollection,
  createLocalCollection,
  createLocalFolder,
  deleteLocalCollection,
  deleteLocalFolder,
  deleteLocalRule,
  ensureDefaultCollection,
  getLocalCollectionTrees,
  getLocalCollections,
  getLocalFolders,
  getLocalRules,
  getRules,
  renameLocalCollection,
  renameLocalFolder,
  toggleLocalRule,
  updateLocalRule,
} from './rule-store';

const browserAPI = { runtime: browserRuntime };

function createSafeResponse(sendResponse: SendResponse): SendResponse {
  return (data: unknown) => {
    try {
      sendResponse(data);
    } catch (_error) {
      logger.info('MessageHandler', 'Could not send response, channel closed');
    }
  };
}

export function handleGeneralMessage(
  message: Record<string, unknown>,
  _sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
  ctx: MessageHandlerContext,
): boolean | undefined {
  const safeResponse = createSafeResponse(sendResponse);

  const {
    isWebSocketConnected,
    sendViaWebSocket,
    scheduleUpdate,
    revalidateTrackedRequests,
    updateBadgeCallback,
  } = ctx;

  try {
    if (message.type === 'popupOpen') {
      safeResponse({
        type: 'rulesUpdated',
        rules: getRules(),
        connected: isWebSocketConnected(),
      });
    } else if (message.type === 'checkConnection') {
      safeResponse({ connected: isWebSocketConnected() });
    } else if (message.type === 'getRules') {
      safeResponse({
        rules: getRules(),
        isConnected: isWebSocketConnected(),
      });
    } else if (message.type === 'rulesUpdated') {
      logger.info('MessageHandler', 'Rule update requested');
      revalidateTrackedRequests()
        .then(() => {
          scheduleUpdate('rulesUpdated', { immediate: true });
          updateBadgeCallback();
          safeResponse({ success: true });
        })
        .catch((error: Error) => {
          logger.info('MessageHandler', 'Error updating rules:', error.message);
          safeResponse({ success: false, error: error.message });
        });
      return true;
    } else if (message.type === 'openTab') {
      tabs.create({ url: message.url as string }, (tab: chrome.tabs.Tab) => {
        if (browserAPI.runtime.lastError) {
          safeResponse({ success: false, error: (browserAPI.runtime.lastError as chrome.runtime.LastError).message });
        } else {
          safeResponse({ success: true, tabId: tab.id });
        }
      });
      return true;
    } else if (message.type === 'focusApp') {
      if (isWebSocketConnected()) {
        const sent = sendViaWebSocket({ type: 'focusApp', navigation: message.navigation as string });
        safeResponse({ success: sent });
      } else {
        safeResponse({ success: false });
      }
    } else if (message.type === 'toggleVideoRecording') {
      if (isWebSocketConnected()) {
        safeResponse({ success: sendViaWebSocket({ type: 'toggleVideoRecording', enabled: !!message.enabled }) });
      } else {
        safeResponse({ success: false, error: 'App not connected' });
      }
    } else if (message.type === 'toggleRecordingHotkey') {
      if (isWebSocketConnected()) {
        safeResponse({ success: sendViaWebSocket({ type: 'toggleRecordingHotkey', enabled: !!message.enabled }) });
      } else {
        safeResponse({ success: false, error: 'App not connected' });
      }
    } else if (message.type === 'getVideoRecordingState') {
      if (isWebSocketConnected()) {
        safeResponse({ success: sendViaWebSocket({ type: 'getVideoRecordingState' }) });
      } else {
        safeResponse({ success: true, enabled: false });
      }
    } else if (message.type === 'getRecordingHotkey') {
      if (isWebSocketConnected()) {
        safeResponse({ success: sendViaWebSocket({ type: 'getRecordingHotkey' }) });
      } else {
        safeResponse({ success: true, hotkey: 'CommandOrControl+Shift+E' });
      }
    } else if (message.type === 'toggleRule') {
      const ruleId = message.ruleId as string;
      const enabled = message.enabled as boolean;
      if (ruleId.startsWith('local-')) {
        const success = toggleLocalRule(ruleId, enabled);
        if (success) {
          scheduleUpdate('rules', { immediate: true });
          updateBadgeCallback();
        }
        safeResponse({ success });
      } else if (isWebSocketConnected()) {
        safeResponse({ success: sendViaWebSocket({ type: 'toggleRule', ruleId, enabled }) });
      } else {
        safeResponse({ success: false, error: 'Not connected to desktop app' });
      }
    } else if (message.type === 'deleteRule') {
      const ruleId = message.ruleId as string;
      if (ruleId.startsWith('local-')) {
        const success = deleteLocalRule(ruleId);
        if (success) {
          scheduleUpdate('rules', { immediate: true });
          updateBadgeCallback();
        }
        safeResponse({ success });
      } else if (isWebSocketConnected()) {
        safeResponse({ success: sendViaWebSocket({ type: 'deleteRule', ruleId }) });
      } else {
        safeResponse({ success: false, error: 'Not connected to desktop app' });
      }
    } else if (message.type === 'createLocalRule') {
      const ruleData = message.rule as Omit<V5.Rule, 'uid' | 'path'>;
      const parentPath = message.parentPath as string | undefined;
      const collectionUid = message.collectionUid as string | undefined;

      let created: V5.Rule;
      if (parentPath) {
        created = addLocalRule(ruleData, parentPath);
      } else {
        const collection = collectionUid
          ? { uid: collectionUid }
          : ensureDefaultCollection();
        created = addLocalRuleToCollection(ruleData, collection.uid);
      }
      scheduleUpdate('rules', { immediate: true });
      updateBadgeCallback();
      safeResponse({ success: true, rule: created });
    } else if (message.type === 'updateLocalRule') {
      const ruleId = message.ruleId as string;
      const updates = message.updates as Partial<Omit<V5.Rule, 'uid' | 'path'>>;
      const success = updateLocalRule(ruleId, updates);
      if (success) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
      }
      safeResponse({ success });
    } else if (message.type === 'getLocalRules') {
      safeResponse({ rules: getLocalRules() });
    } else if (message.type === 'getLocalCollections') {
      safeResponse({ collections: getLocalCollections() });
    } else if (message.type === 'getLocalCollectionTrees') {
      safeResponse({ collectionTrees: getLocalCollectionTrees() });
    } else if (message.type === 'getLocalFolders') {
      safeResponse({ folders: getLocalFolders() });
    } else if (message.type === 'createLocalFolder') {
      const folder = createLocalFolder(message.name as string, message.parentPath as string);
      safeResponse({ success: true, folder });
    } else if (message.type === 'renameLocalFolder') {
      const success = renameLocalFolder(message.folderUid as string, message.name as string);
      safeResponse({ success });
    } else if (message.type === 'deleteLocalFolder') {
      const success = deleteLocalFolder(message.folderUid as string);
      if (success) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
      }
      safeResponse({ success });
    } else if (message.type === 'createLocalCollection') {
      const name = message.name as string;
      const collection = createLocalCollection(name);
      safeResponse({ success: true, collection });
    } else if (message.type === 'renameLocalCollection') {
      const success = renameLocalCollection(message.collectionUid as string, message.name as string);
      safeResponse({ success });
    } else if (message.type === 'deleteLocalCollection') {
      const success = deleteLocalCollection(message.collectionUid as string);
      if (success) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
      }
      safeResponse({ success });
    } else if (message.type === 'getActiveRulesForTab') {
      const result = getActiveRulesForTab(message.tabId as number, message.tabUrl as string);
      safeResponse({ activeRules: result.activeRules, uniqueRequestCount: result.uniqueRequestCount });
    } else if (message.type === 'setRulesExecutionPaused') {
      scheduleUpdate('pause', { immediate: true });
      safeResponse({ success: true });
    } else if (message.type === 'toggleAllRules') {
      if (isWebSocketConnected()) {
        safeResponse({
          success: sendViaWebSocket({
            type: 'toggleAllRules',
            ruleIds: message.ruleIds as string[],
            enabled: message.enabled as boolean,
          }),
        });
      } else {
        safeResponse({ success: false, error: 'Not connected to desktop app' });
      }
    } else if (message.type && (message.type as string).startsWith('proxy-')) {
      return false;
    } else {
      logger.info('MessageHandler', 'Unknown message type:', message.type);
      return false;
    }
  } catch (error) {
    logger.info('MessageHandler', 'Error handling message:', (error as Error).message);
    safeResponse({ error: (error as Error).message });
    return true;
  }
}
