/**
 * Message Handler — handles non-recording messages from the popup.
 */

import type { V5 } from '@openheaders/core/types';
import { runtime as browserRuntime, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { MessageHandlerContext, SendResponse } from '@/types/browser';
import { getActiveRulesForTab } from './request-tracker';
import {
  addLocalRule,
  addLocalRuleToCollection,
  createLocalCollection,
  createLocalFolder,
  deleteLocalCollection,
  deleteLocalFolder,
  deleteLocalRule,
  ensureDefaultCollection,
  getLocalCollections,
  getLocalCollectionTrees,
  getLocalFolders,
  getLocalRules,
  getRules,
  renameLocalCollection,
  renameLocalFolder,
  toggleLocalRule,
  updateLocalRule,
} from './rule-store';
import { type FireKind, getTabSnapshot, recordScriptFire } from './tab-telemetry';
import {
  addTemplate,
  addTemplateToCollection,
  createTemplateCollection,
  createTemplateFolder,
  deleteTemplate,
  deleteTemplateCollection,
  deleteTemplateFolder,
  ensureDefaultTemplateCollection,
  getTemplateCollections,
  getTemplateCollectionTrees,
  getTemplateFolders,
  getTemplates,
  renameTemplateCollection,
  renameTemplateFolder,
  updateTemplate,
} from './template-store';
import { deleteStoredSession, getStoredSession, listStoredSessions, startSession, type TestScope } from './test-runner';

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

  const { isWebSocketConnected, sendViaWebSocket, scheduleUpdate, revalidateTrackedRequests, updateBadgeCallback } =
    ctx;

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
        const collection = collectionUid ? { uid: collectionUid } : ensureDefaultCollection();
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
    } else if (message.type === 'startTestSession') {
      // Launch a test session and resolve with the final result once the
      // capture window closes. Kept async so the popup can stay open and
      // await the response, or close and rely on stored results.
      const scope = message.scope as TestScope;
      const ruleUids = (message.ruleUids as string[]) ?? [];
      const url = message.url as string;
      const waitSeconds = (message.waitSeconds as number) ?? 5;
      startSession({ scope, ruleUids, url, waitSeconds })
        .then((result) => safeResponse({ success: true, result }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'getTabTelemetry') {
      // Read-path for the popup's live fire counts. Returns fire counters
      // per rule uid for the given tab. Empty snapshot for untracked tabs.
      const tabId = message.tabId as number;
      const snap = getTabSnapshot(tabId);
      safeResponse({ counters: snap.counters });
    } else if (message.type === 'tabFire') {
      // Fire event forwarded from the always-on ISOLATED fire-bridge content
      // script. Routes into tab-telemetry, which drops on the floor for any
      // tab that is not currently being tracked by a consumer.
      const tabId = _sender.tab?.id;
      if (typeof tabId === 'number') {
        logger.info(
          'TabFire',
          `tab ${tabId} ${message.kind as string} ${message.ruleUid as string} ${message.url as string}`,
        );
        recordScriptFire(
          tabId,
          message.ruleUid as string,
          message.url as string,
          message.kind as FireKind,
          message.t as number,
        );
      }
      safeResponse({ success: true });
    } else if (message.type === 'listTestSessions') {
      listStoredSessions()
        .then((sessions) => safeResponse({ success: true, sessions }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'getTestSession') {
      getStoredSession(message.sessionId as string)
        .then((session) => safeResponse({ success: true, session }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'deleteTestSession') {
      deleteStoredSession(message.sessionId as string)
        .then(() => safeResponse({ success: true }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
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
      // ── Template CRUD ──────────────────────────────────────────────
    } else if (message.type === 'getTemplates') {
      safeResponse({ templates: getTemplates() });
    } else if (message.type === 'getTemplateCollections') {
      safeResponse({ collections: getTemplateCollections() });
    } else if (message.type === 'getTemplateCollectionTrees') {
      safeResponse({ collectionTrees: getTemplateCollectionTrees() });
    } else if (message.type === 'getTemplateFolders') {
      safeResponse({ folders: getTemplateFolders() });
    } else if (message.type === 'createTemplate') {
      const templateData = message.template as Omit<V5.Template, 'uid' | 'path'>;
      const parentPath = message.parentPath as string | undefined;
      const collectionUid = message.collectionUid as string | undefined;

      let created: V5.Template;
      if (parentPath) {
        created = addTemplate(templateData, parentPath);
      } else {
        const collection = collectionUid ? { uid: collectionUid } : ensureDefaultTemplateCollection();
        created = addTemplateToCollection(templateData, collection.uid);
      }
      safeResponse({ success: true, template: created });
    } else if (message.type === 'updateTemplate') {
      const success = updateTemplate(
        message.templateUid as string,
        message.updates as Partial<Omit<V5.Template, 'uid' | 'path'>>,
      );
      safeResponse({ success });
    } else if (message.type === 'deleteTemplate') {
      const success = deleteTemplate(message.templateUid as string);
      safeResponse({ success });
    } else if (message.type === 'createTemplateCollection') {
      const collection = createTemplateCollection(message.name as string);
      safeResponse({ success: true, collection });
    } else if (message.type === 'renameTemplateCollection') {
      const success = renameTemplateCollection(message.collectionUid as string, message.name as string);
      safeResponse({ success });
    } else if (message.type === 'deleteTemplateCollection') {
      const success = deleteTemplateCollection(message.collectionUid as string);
      safeResponse({ success });
    } else if (message.type === 'createTemplateFolder') {
      const folder = createTemplateFolder(message.name as string, message.parentPath as string);
      safeResponse({ success: true, folder });
    } else if (message.type === 'renameTemplateFolder') {
      const success = renameTemplateFolder(message.folderUid as string, message.name as string);
      safeResponse({ success });
    } else if (message.type === 'deleteTemplateFolder') {
      const success = deleteTemplateFolder(message.folderUid as string);
      safeResponse({ success });
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
