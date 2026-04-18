/**
 * Message Handler — handles non-recording RPCs from every extension
 * surface (popup, sidepanel, workspace.html, devtools panel).
 *
 * Every handler is a pure dispatch: parse the request, delegate to the
 * appropriate per-workspace store, emit the broadcast side-effects
 * through the rule-engine, and return the response. Cross-store
 * orchestration (workspace switching / duplication / deletion) lives
 * in `workspace-orchestrator.ts` — we call it, not inline it.
 */

import type { V5 } from '@openheaders/core/types';
import { doesUrlMatchEntry, getRuleMatchPatterns } from '@openheaders/core/utils';
import { broadcast } from '@utils/bridge';
import { runtime as browserRuntime, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { MessageHandlerContext, SendResponse } from '@/types/browser';
import type { PerfResourceEntry } from '@/types/perf';
import { disableCacheBypassForTab, enableCacheBypassForTab } from './cache-bypass';
import { getActiveRulesForTab, ingestPerfEntries } from './request-tracker';
import { createRuleDraft, takeRuleDraft } from './rule-draft-store';
import {
  addRule,
  addRuleToCollection,
  createCollection,
  createFolder,
  deleteCollection,
  deleteFolder,
  deleteRule,
  ensureDefaultCollection,
  getCollectionTrees,
  getCollections,
  getFolders,
  getRules,
  renameCollection,
  renameFolder,
  toggleRule,
  updateRule,
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
import {
  deleteWorkspaceWithData,
  duplicateWorkspace as duplicateWorkspaceData,
  switchActiveWorkspace,
} from './workspace-orchestrator';
import {
  createWorkspace as createWorkspaceMeta,
  getActiveWorkspace,
  getActiveWorkspaceId,
  listWorkspaces,
  reorderWorkspaces as reorderWorkspacesMeta,
  updateWorkspace as updateWorkspaceMeta,
} from './workspace-store';

// ── Orphan test-run sweep ──────────────────────────────────────────

function pruneOrphanTestRunOwners(): void {
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

const browserAPI = { runtime: browserRuntime };

// ── Helpers ───────────────────────────────────────────────────────

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

// ── Main dispatcher ───────────────────────────────────────────────

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
    // ── Connection / presence ──────────────────────────────────
    if (message.type === 'popupOpen') {
      safeResponse({
        type: 'rulesUpdated',
        rules: getRules(),
        connected: isWebSocketConnected(),
        workspaces: listWorkspaces(),
        activeWorkspaceId: getActiveWorkspaceId(),
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

      // ── Workspaces ──────────────────────────────────────────────
    } else if (message.type === 'listWorkspaces') {
      safeResponse({ workspaces: listWorkspaces(), activeWorkspaceId: getActiveWorkspaceId() });
    } else if (message.type === 'getActiveWorkspace') {
      safeResponse({ workspace: getActiveWorkspace() });
    } else if (message.type === 'createWorkspace') {
      const name = message.name as string;
      const description = message.description as string | undefined;
      const color = message.color as string | undefined;
      createWorkspaceMeta({ name, description, color })
        .then((workspace) => safeResponse({ success: true, workspace }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'renameWorkspace') {
      updateWorkspaceMeta(message.id as string, { name: message.name as string })
        .then((ws) => safeResponse({ success: ws !== null }))
        .catch(() => safeResponse({ success: false }));
      return true;
    } else if (message.type === 'updateWorkspace') {
      updateWorkspaceMeta(message.id as string, message.updates as Record<string, unknown>)
        .then((workspace) => safeResponse({ success: workspace !== null, workspace: workspace ?? undefined }))
        .catch(() => safeResponse({ success: false }));
      return true;
    } else if (message.type === 'deleteWorkspace') {
      deleteWorkspaceWithData(message.id as string)
        .then((newActive) => {
          if (newActive === null) {
            safeResponse({ success: false, error: 'Cannot delete the last workspace' });
          } else {
            safeResponse({ success: true, activeWorkspaceId: newActive });
          }
        })
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'duplicateWorkspace') {
      duplicateWorkspaceData(message.id as string, { name: message.name as string | undefined })
        .then((workspace) => {
          if (!workspace) safeResponse({ success: false, error: 'Source workspace not found' });
          else safeResponse({ success: true, workspace });
        })
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'setActiveWorkspace') {
      switchActiveWorkspace(message.id as string)
        .then((ok) => safeResponse({ success: ok, ...(ok ? {} : { error: 'Unknown workspace id' }) }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'reorderWorkspaces') {
      reorderWorkspacesMeta(message.idOrder as string[])
        .then(() => safeResponse({ success: true }))
        .catch(() => safeResponse({ success: false }));
      return true;

      // ── Tab / app launcher ────────────────────────────────────
    } else if (message.type === 'openTab') {
      tabs.create({ url: message.url as string }, (tab: chrome.tabs.Tab) => {
        if (browserAPI.runtime.lastError) {
          safeResponse({ success: false, error: (browserAPI.runtime.lastError as chrome.runtime.LastError).message });
        } else {
          safeResponse({ success: true, tabId: tab.id });
        }
      });
      return true;
    } else if (message.type === 'sidepanelToPopup') {
      const sidePanelApi = (
        chrome as unknown as {
          sidePanel?: {
            close?: (o: { windowId?: number; tabId?: number }) => Promise<void>;
          };
        }
      ).sidePanel;
      const actionApi = chrome.action as unknown as {
        openPopup?: (o?: { windowId?: number }) => Promise<void>;
      };
      const windowId = message.windowId as number | undefined;
      const tabId = message.tabId as number | undefined;
      const POST_CLOSE_SETTLE_MS = 500;

      (async () => {
        if (sidePanelApi?.close) {
          const closeAttempts: { windowId?: number; tabId?: number }[] = [];
          if (windowId != null) closeAttempts.push({ windowId });
          if (tabId != null) closeAttempts.push({ tabId });
          for (const opts of closeAttempts) {
            try {
              await sidePanelApi.close(opts);
              break;
            } catch (error) {
              logger.info('ViewMode', 'sidePanel.close failed:', (error as Error).message);
            }
          }
          await new Promise((resolve) => setTimeout(resolve, POST_CLOSE_SETTLE_MS));
        }

        if (!actionApi.openPopup) {
          safeResponse({ success: true, opened: false, error: 'action.openPopup unavailable' });
          return;
        }
        try {
          await actionApi.openPopup(windowId != null ? { windowId } : undefined);
          safeResponse({ success: true, opened: true });
        } catch (error) {
          safeResponse({ success: true, opened: false, error: (error as Error).message });
        }
      })();
      return true;
    } else if (message.type === 'focusApp') {
      if (isWebSocketConnected()) {
        const sent = sendViaWebSocket({ type: 'focusApp', navigation: message.navigation as string });
        safeResponse({ success: sent });
      } else {
        safeResponse({ success: false });
      }

      // ── Recording settings (WebSocket passthrough) ────────────
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

      // ── Rule CRUD (active workspace) ──────────────────────────
    } else if (message.type === 'toggleRule') {
      const ruleId = message.ruleId as string;
      const enabled = message.enabled as boolean;
      const success = toggleRule(ruleId, enabled);
      if (success) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
      }
      safeResponse({ success });
    } else if (message.type === 'deleteRule') {
      const ruleId = message.ruleId as string;
      const success = deleteRule(ruleId);
      if (success) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
        pruneOrphanTestRunOwners();
      }
      safeResponse({ success });
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
        created = addRule(ruleData, parentPath);
      } else {
        const collection = collectionUid ? { uid: collectionUid } : ensureDefaultCollection();
        created = addRuleToCollection(ruleData, collection.uid);
      }
      scheduleUpdate('rules', { immediate: true });
      updateBadgeCallback();
      safeResponse({ success: true, rule: created });
    } else if (message.type === 'updateLocalRule') {
      const ruleId = message.ruleId as string;
      const updates = message.updates as Partial<Omit<V5.Rule, 'uid' | 'path'>>;
      const success = updateRule(ruleId, updates);
      if (success) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
      }
      safeResponse({ success });
    } else if (message.type === 'getLocalRules') {
      safeResponse({ rules: getRules() });
    } else if (message.type === 'getLocalCollections') {
      safeResponse({ collections: getCollections() });
    } else if (message.type === 'getLocalCollectionTrees') {
      safeResponse({ collectionTrees: getCollectionTrees() });
    } else if (message.type === 'getLocalFolders') {
      safeResponse({ folders: getFolders() });
    } else if (message.type === 'createLocalFolder') {
      const folder = createFolder(message.name as string, message.parentPath as string);
      safeResponse({ success: true, folder });
    } else if (message.type === 'renameLocalFolder') {
      const success = renameFolder(message.folderUid as string, message.name as string);
      safeResponse({ success });
    } else if (message.type === 'deleteLocalFolder') {
      const success = deleteFolder(message.folderUid as string);
      if (success) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
        pruneOrphanTestRunOwners();
      }
      safeResponse({ success });
    } else if (message.type === 'createLocalCollection') {
      const name = message.name as string;
      const collection = createCollection(name);
      safeResponse({ success: true, collection });
    } else if (message.type === 'renameLocalCollection') {
      const success = renameCollection(message.collectionUid as string, message.name as string);
      safeResponse({ success });
    } else if (message.type === 'deleteLocalCollection') {
      const success = deleteCollection(message.collectionUid as string);
      if (success) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
        pruneOrphanTestRunOwners();
      }
      safeResponse({ success });

      // ── Per-tab telemetry + active rules ──────────────────────
    } else if (message.type === 'getActiveRulesForTab') {
      const result = getActiveRulesForTab(message.tabId as number, message.tabUrl as string);
      safeResponse({ activeRules: result.activeRules });
    } else if (message.type === 'startTestRun') {
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
      const tabId = message.tabId as number;
      const snap = getTabSnapshot(tabId);
      safeResponse(snap);
    } else if (message.type === 'perfResourceEntries') {
      const tabId = _sender.tab?.id;
      const entries = (message.entries as PerfResourceEntry[] | undefined) ?? [];
      if (typeof tabId === 'number' && entries.length > 0) {
        const matched = ingestPerfEntries(tabId, entries);
        if (matched > 0) updateBadgeCallback();
      }
      safeResponse({ success: true });
    } else if (message.type === 'tabFire') {
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

      // ── Test runs ──────────────────────────────────────────────
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
      const ruleIds = message.ruleIds as string[];
      const enabled = message.enabled as boolean;
      let touched = false;
      for (const ruleId of ruleIds) {
        if (toggleRule(ruleId, enabled)) touched = true;
      }
      if (touched) {
        scheduleUpdate('rules', { immediate: true });
        updateBadgeCallback();
      }
      safeResponse({ success: true });

      // ── Template CRUD ──────────────────────────────────────────
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
