/**
 * Message Handler — handles non-recording messages from the popup.
 */

import type { V5 } from '@openheaders/core/types';
import { doesUrlMatchEntry, getRuleMatchPatterns } from '@openheaders/core/utils';
import { broadcast } from '@utils/bridge';
import { runtime as browserRuntime, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { MessageHandlerContext, SendResponse } from '@/types/browser';
import { disableCacheBypassForTab, enableCacheBypassForTab } from './cache-bypass';
import { getActiveRulesForTab } from './request-tracker';
import { createRuleDraft, takeRuleDraft } from './rule-draft-store';
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
import { getTabSnapshot, recordScriptableFire } from './tab-telemetry';
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
import {
  deleteAllTestRunsForOwner,
  deleteTestRunById,
  getTestRunById,
  listAllTestRuns,
  listTestRunsForOwner,
  pruneOrphanOwners,
  type TestRunOwner,
  type TestRunOwnerType,
} from './test-run-store';
import { startRun } from './test-runner';

/**
 * Compute the set of currently live rule/folder/collection ids and ask
 * the test-run store to drop any bucket whose owner is gone. Called
 * after any tree mutation that could orphan a run bucket — adding one
 * sweep is simpler than threading deletion calls into every CRUD path.
 * Fire-and-forget; storage failures are non-fatal.
 */
function pruneOrphanTestRunOwners(): void {
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

const browserAPI = { runtime: browserRuntime };

/**
 * Find the first URL-condition pattern on `ruleUid` that matches `url`.
 * Used to enrich scriptable fire events with the specific pattern that
 * matched, so the popup's expand panel can highlight it. Returns undefined
 * if the rule is gone or no pattern matches — the caller should fall back
 * to a wildcard display value.
 */
function findMatchingPattern(ruleUid: string, url: string): string | undefined {
  const rule = getRules().find((r) => r.uid === ruleUid);
  if (!rule) return undefined;
  for (const entry of getRuleMatchPatterns(rule)) {
    if (doesUrlMatchEntry(url, entry)) return entry.pattern;
  }
  return undefined;
}

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
          pruneOrphanTestRunOwners();
        }
        safeResponse({ success });
      } else if (isWebSocketConnected()) {
        safeResponse({ success: sendViaWebSocket({ type: 'deleteRule', ruleId }) });
      } else {
        safeResponse({ success: false, error: 'Not connected to desktop app' });
      }
    } else if (message.type === 'createRuleDraft') {
      try {
        const nonce = createRuleDraft(message.draft);
        safeResponse({ success: true, nonce });
      } catch (err) {
        safeResponse({ success: false, error: (err as Error).message });
      }
    } else if (message.type === 'takeRuleDraft') {
      const nonce = message.nonce as string;
      const draft = takeRuleDraft(nonce);
      safeResponse({ success: true, draft });
    } else if (message.type === 'setCacheBypass') {
      // Inspector panel → background: "Disable Cache" toggle for an
      // inspected tab. Installs / removes a tab-scoped DNR rule that
      // adds `Cache-Control: no-cache` + `Pragma: no-cache` to outgoing
      // requests. See `modules/cache-bypass.ts` for the full contract.
      const tabId = message.tabId as number;
      const enabled = !!message.enabled;
      const handler = enabled ? enableCacheBypassForTab : disableCacheBypassForTab;
      handler(tabId)
        .then(() => safeResponse({ success: true }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
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
        pruneOrphanTestRunOwners();
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
        pruneOrphanTestRunOwners();
      }
      safeResponse({ success });
    } else if (message.type === 'getActiveRulesForTab') {
      const result = getActiveRulesForTab(message.tabId as number, message.tabUrl as string);
      safeResponse({ activeRules: result.activeRules });
    } else if (message.type === 'startTestRun') {
      // Launch a test run and resolve with the final result once the
      // capture window closes. Popup callers fire-and-forget — the in-page
      // widget on the test tab is the primary feedback surface, so the
      // response only matters for callers that explicitly await it (e.g.
      // automated tests).
      const ownerType = message.ownerType as TestRunOwnerType;
      const ownerId = message.ownerId as string;
      const owner: TestRunOwner = { type: ownerType, id: ownerId };
      const scopeLabel = (message.scopeLabel as string | undefined) ?? '';
      const ruleUids = (message.ruleUids as string[]) ?? [];
      const url = message.url as string;
      const waitSeconds = (message.waitSeconds as number) ?? 5;
      startRun({ owner, scopeLabel, ruleUids, url, waitSeconds })
        .then((result) => safeResponse({ success: true, result }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'getTabTelemetry') {
      // Read-path for the popup's live fire data. Returns the full telemetry
      // snapshot for the given tab — counters, chronological fires, per-rule
      // unique URL records, and a cross-rule unique request count. The popup
      // composes this with `getActiveRulesForTab` (applicable rules) to
      // render the This Page tab. Empty snapshot for untracked tabs.
      const tabId = message.tabId as number;
      const snap = getTabSnapshot(tabId);
      safeResponse(snap);
    } else if (message.type === 'tabFire') {
      // Fire event forwarded from the always-on ISOLATED fire-bridge content
      // script. Always a scriptable fire — the in-page injection reported
      // the match itself. Routes into tab-telemetry with enriched metadata
      // (pattern + resource type) so the popup's expand panel can highlight
      // which condition matched. The in-page wrapper only fires for
      // fetch/XHR calls, so resource type is hardcoded to 'xmlhttprequest'.
      // tab-telemetry drops fires for any tab that is not currently tracked.
      const tabId = _sender.tab?.id;
      if (typeof tabId === 'number') {
        const ruleUid = message.ruleUid as string;
        const url = message.url as string;
        const t = message.t as number;
        logger.info('TabFire', `tab ${tabId} scriptable ${ruleUid} ${url}`);
        const pattern = findMatchingPattern(ruleUid, url) ?? '*';
        recordScriptableFire(tabId, ruleUid, url, t, { pattern, resourceType: 'xmlhttprequest' });
      }
      safeResponse({ success: true });
    } else if (message.type === 'listTestRunsForOwner') {
      const owner: TestRunOwner = {
        type: message.ownerType as TestRunOwnerType,
        id: message.ownerId as string,
      };
      listTestRunsForOwner(owner)
        .then((runs) => safeResponse({ success: true, runs }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'listAllTestRuns') {
      // Workspace-wide Test Runs panel (left ActivityBar launcher). Returns
      // every persisted run across every owner bucket, newest-first.
      listAllTestRuns()
        .then((runs) => safeResponse({ success: true, runs }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'getTestRun') {
      getTestRunById(message.runId as string)
        .then((run) => safeResponse({ success: true, run }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'deleteTestRun') {
      deleteTestRunById(message.runId as string)
        .then(() => {
          // Notify any open listeners so the bottom panel list refreshes.
          broadcast('testRunDeleted', { runId: message.runId as string });
          safeResponse({ success: true });
        })
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'deleteAllTestRunsForOwner') {
      const owner: TestRunOwner = {
        type: message.ownerType as TestRunOwnerType,
        id: message.ownerId as string,
      };
      deleteAllTestRunsForOwner(owner)
        .then(() => {
          broadcast('testRunsClearedForOwner', {
            ownerType: owner.type,
            ownerId: owner.id,
          });
          safeResponse({ success: true });
        })
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
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
