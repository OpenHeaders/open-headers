/**
 * Message Handler — handles non-rule-CRUD RPCs from every extension
 * surface (popup, sidepanel, workbench.html, devtools panel).
 *
 * Every handler is a pure dispatch: parse the request, delegate to the
 * appropriate per-workspace store, emit the broadcast side-effects
 * through the rule-engine, and return the response. Cross-store
 * orchestration (workspace switching / duplication / deletion) lives
 * in `workspace-orchestrator.ts` — we call it, not inline it.
 */

import type { LiveVariable, LiveVariableOverride, LiveWorkflow, OAuth2Auth, RefreshPolicy, Request, Template, TreeNode, Variable, WorkflowStep } from '@openheaders/core/types';
import { doesUrlMatchEntry, getRuleMatchPatterns } from '@openheaders/core/utils';
import { buildWorkspaceExport, serializeWorkspaceExport } from '@openheaders/core/workspace-export';
import { broadcast } from '@utils/bridge';
import { runtime as browserRuntime, isChrome, isEdge, isFirefox, isSafari, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { snapshotExtensionWorkspacePostStates } from '@openheaders/oracle/sync/global-service';
import {
  applySyncRequest,
  publishAwareness,
  snapshotAwarenessPresence,
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotFilesPostStates,
  snapshotFolderPostStates,
  snapshotLayoutStatePostStates,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
  snapshotOAuthBundlePostStates,
  snapshotPauseMarkersPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestFolderPostStates,
  snapshotRequestPostStates,
  snapshotRulePostStates,
  snapshotTemplateCollectionPostStates,
  snapshotTemplateFolderPostStates,
  snapshotTemplatePostStates,
  snapshotVaultPostStates,
  snapshotWorkspaceVariablesPostStates,
} from '@openheaders/oracle/sync/service';
import { getStatusSnapshot } from '@openheaders/ui/shared/status';
import type { MessageHandlerContext, SendResponse } from '@/types/browser';
import type { PerfResourceEntry } from '@/types/perf';
import { disableCacheBypassForTab, enableCacheBypassForTab } from './cache-bypass';
import {
  createEnvironment,
  deleteEnvironment,
  getActiveEnvironmentId,
  getCollectionEnvOverrides,
  getDefaultEnvironmentId,
  getEnvironments,
  getManualEnvId,
  getVault,
  getWorkspaceVariables,
  renameEnvironment,
  updateEnvironmentVariables,
} from '@openheaders/oracle/entity/environment-store';
import { deleteFile, getFileBlob, listFiles, putFile, renameFile } from '@openheaders/oracle/entity/files-store';
import {
  clearImportReports,
  findImportReportBySourceHash,
  listImportReports,
  recordImportReport,
} from '@openheaders/oracle/entity/import-reports-store';
import {
  clearWorkflowRunCache,
  getWorkflowRunCache,
  listCachesForWorkflow as listLiveCacheForWorkflow,
} from '@openheaders/oracle/live/live-cache-store';
import { refreshLiveWorkflowByUser, resetCircuitForWorkflow } from './live-refresh-scheduler';
import {
  createLiveVariable,
  deleteLiveVariable,
  getLiveVariable,
  getLiveVariables,
  setLiveVariableOverride,
  updateLiveVariable,
} from '@openheaders/oracle/live/live-variable-store';
import {
  createLiveWorkflow,
  deleteLiveWorkflow,
  getLiveWorkflow,
  getLiveWorkflows,
  updateLiveWorkflow,
} from '@openheaders/oracle/live/live-workflow-store';
import {
  getOAuthRedirectUri,
  launchAuthorizationCodeFlow,
  OAuth2FlowError,
  performClientCredentialsFlow,
  performRefresh,
} from './oauth-flow';
import { deleteTokenBundle } from '@openheaders/oracle/entity/oauth-token-store';
import { clearObservabilityLog, getObservabilityLog } from './observability-log';
import { handleScriptHostRequest } from './offscreen-host';
import { executeRequest, executeRequestDraft } from './request-executor';
import { clearPendingScriptsReview, getPendingScriptsReview } from '@openheaders/oracle/entity/request-scripts-review-store';
import {
  addRequest,
  addRequestToCollection,
  createRequestCollection,
  createRequestFolder,
  deleteRequest,
  deleteRequestCollection,
  deleteRequestFolder,
  ensureDefaultRequestCollection,
  getRequest as getRequestById,
  getRequestCollections,
  getRequestCollectionTrees,
  getRequestFolders,
  getRequests,
  renameRequestCollection,
  renameRequestFolder,
  updateRequest,
} from '@openheaders/oracle/entity/request-store';
import { getActiveRulesForTab, ingestPerfEntries } from './request-tracker';
import { createRuleDraft, takeRuleDraft } from '@openheaders/oracle/entity/rule-draft-store';
import {
  createCollection,
  createFolder,
  deleteCollection,
  deleteFolder,
  deleteRule,
  getCollections,
  getCollectionTrees,
  getFolders,
  getRules,
  renameCollection,
  renameFolder,
  updateCollectionPinnedEnvs,
  updateCollectionVariables,
} from '@openheaders/oracle/entity/rule-store';
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
} from '@openheaders/oracle/entity/template-store';
import {
  deleteAllTestRunsForOwner,
  deleteTestRunById,
  getTestRunById,
  listAllTestRuns,
  listTestRunsForOwner,
  pruneOrphanOwners,
  type TestRunOwner,
  type TestRunOwnerType,
} from '@openheaders/oracle/test-run/test-run-store';
import { startRun } from './test-runner';
import { getResolvedRules } from '@openheaders/oracle/rule-engine/variables-resolver';
import { gatherWorkspaceExport } from './workspace-export-gatherer';
import { consumeImportHandoff, registerImportHandoff } from './workspace-export-handoff-store';
import { findExportImportMatches } from './workspace-import-dedup';
import { importWorkspace as importWorkspaceFromExport, previewWorkspaceImport } from './workspace-import-orchestrator';
import { openWorkspaceIntent } from './workspace-navigator';
import { duplicateWorkspace as duplicateWorkspaceData } from './workspace-orchestrator';
import { getActiveWorkspace, getActiveWorkspaceId, listWorkspaces } from './workspace-store';
import { ordinalForTab, workspaceTabCount } from './workspace-tab-registry';

// ── Orphan test-run sweep ──────────────────────────────────────────

function pruneOrphanTestRunOwners(): void {
  const liveRules = new Set<string>();
  const liveEntities = new Set<string>();
  for (const r of getRules()) liveRules.add(r.uid);
  for (const c of getCollectionTrees()) {
    liveEntities.add(c.uid);
    const walk = (nodes: TreeNode[]): void => {
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
  // Match against the resolved rule — raw `{{VAR}}` tokens in URL
  // conditions would never match a real request URL. Fall through to
  // the raw rule-store view if the resolver snapshot hasn't been
  // populated yet (pre-first-compile edge case).
  const resolved = getResolvedRules();
  const pool = resolved.length > 0 ? resolved : getRules();
  const rule = pool.find((r) => r.uid === ruleUid);
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
    // ── Script sandbox host RPC (from offscreen doc) ───────────
    // Tagged with `target: 'background'` so we route them here instead
    // of letting the offscreen doc's broker handle its own messages.
    if (message.target === 'background' && message.type === 'script.host-request') {
      const request = message.request as import('@openheaders/core/scripts').ScriptHostRequest;
      handleScriptHostRequest(request)
        .then((response) => safeResponse(response))
        .catch((err: Error) =>
          safeResponse({
            executionId: request.executionId,
            rpcId: request.rpcId,
            ok: false,
            error: err.message,
          }),
        );
      return true;
    }

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
    } else if (message.type === 'duplicateWorkspace') {
      duplicateWorkspaceData(message.id as string, { name: message.name as string | undefined })
        .then((workspace) => {
          if (!workspace) safeResponse({ success: false, error: 'Source workspace not found' });
          else safeResponse({ success: true, workspace });
        })
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'exportWorkspace') {
      // scope = 'workspace' (full workspace) or 'selection' (per-type uid lists,
      // collections/folders auto-expanded by the gatherer).
      // PR 4: vaultMode = 'omitted' (default) | 'encrypted' | 'plaintext'.
      const wsId = (message.workspaceId as string | undefined) ?? getActiveWorkspaceId();
      const scope = message.scope as Parameters<typeof gatherWorkspaceExport>[1];
      const vaultMode = (message.vaultMode as 'omitted' | 'encrypted' | 'plaintext' | undefined) ?? 'omitted';
      const passphrase = message.passphrase as string | undefined;
      const passphraseHint = message.passphraseHint as string | undefined;
      const destination = message.destination as 'file' | 'clipboard' | 'deep-link' | undefined;
      const platform: 'chrome' | 'firefox' | 'edge' | 'safari' = isFirefox
        ? 'firefox'
        : isEdge
          ? 'edge'
          : isSafari
            ? 'safari'
            : isChrome
              ? 'chrome'
              : 'chrome';
      (async () => {
        try {
          const res = await gatherWorkspaceExport(wsId, scope, {
            app: 'extension',
            appVersion: browserRuntime.getManifest()?.version ?? '0.0.0',
            platform,
          });
          if (!res) {
            safeResponse({ success: false, error: 'Workspace or rule not found' });
            return;
          }
          let secretsBlock: import('@openheaders/core/workspace-export').EncryptVaultBlockResult | undefined;
          if (vaultMode === 'encrypted') {
            if (!passphrase) {
              safeResponse({ success: false, error: 'Encrypted vault export requires a passphrase' });
              return;
            }
            const vaultSecrets = res.input.entities.vault?.secrets ?? [];
            const { encryptVaultBlock } = await import('@openheaders/core/workspace-export');
            secretsBlock = await encryptVaultBlock(vaultSecrets, passphrase, {
              ...(passphraseHint ? { hint: passphraseHint } : {}),
            });
          }
          const envelope = buildWorkspaceExport(res.input, {
            vaultMode,
            ...(secretsBlock ? { secretsBlock: secretsBlock.block } : {}),
            ...(destination ? { destination } : {}),
          });
          const yaml = serializeWorkspaceExport(envelope);
          safeResponse({
            success: true,
            yaml,
            exportId: envelope.exportId,
            scope: envelope.scope,
            ...(secretsBlock
              ? {
                  ciphertextFingerprint: secretsBlock.ciphertextFingerprint,
                  keyFingerprint: secretsBlock.keyFingerprint,
                }
              : {}),
          });
        } catch (error) {
          safeResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return true;
    } else if (message.type === 'previewWorkspaceImport') {
      previewWorkspaceImport({
        incoming: message.incoming as Parameters<typeof previewWorkspaceImport>[0]['incoming'],
        target: message.target as Parameters<typeof previewWorkspaceImport>[0]['target'],
        backupRestore: message.backupRestore as boolean | undefined,
      })
        .then((res) =>
          safeResponse({
            success: true,
            diff: res.diff,
            missingDeps: res.missingDeps,
            snapshotHash: res.snapshotHash,
            targetWorkspaceId: res.targetWorkspaceId,
          }),
        )
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'findWorkspaceExportImportMatches') {
      findExportImportMatches({
        exportId: message.exportId as string,
        workspaceUid: message.workspaceUid as string,
        currentTargetWorkspaceId: message.currentTargetWorkspaceId as string | null,
      })
        .then((res) => safeResponse(res))
        .catch(() => safeResponse({ exportIdSameTarget: [], exportIdOtherTargets: [], workspaceUidMatches: [] }));
      return true;
    } else if (message.type === 'registerImportHandoff') {
      registerImportHandoff(message.yaml as string)
        .then((handoffId) => safeResponse({ success: true, handoffId }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'consumeImportHandoff') {
      consumeImportHandoff(message.handoffId as string)
        .then((yaml) => safeResponse({ yaml }))
        .catch(() => safeResponse({ yaml: null }));
      return true;
    } else if (message.type === 'fetchWorkspaceExportYaml') {
      import('./workspace-export-fetch')
        .then(({ fetchWorkspaceExportYaml }) => fetchWorkspaceExportYaml(message.url as string))
        .then((res) => safeResponse(res))
        .catch((error: Error) => safeResponse({ ok: false, reason: 'network-error' as const, message: error.message }));
      return true;
    } else if (message.type === 'getAllowedFetchHosts') {
      import('./workspace-export-fetch')
        .then(({ getAllowedFetchHosts }) => getAllowedFetchHosts())
        .then((hosts) => safeResponse({ hosts }))
        .catch(() => safeResponse({ hosts: [] }));
      return true;
    } else if (message.type === 'getRequestScriptsReviewPending') {
      try {
        safeResponse({ uids: Array.from(getPendingScriptsReview()) });
      } catch {
        safeResponse({ uids: [] });
      }
      return true;
    } else if (message.type === 'clearRequestScriptsReviewPending') {
      clearPendingScriptsReview(message.uid as string)
        .then(() => safeResponse({ success: true }))
        .catch(() => safeResponse({ success: false }));
      return true;
    } else if (message.type === 'getLastImportedSnapshots') {
      const workspaceId = message.workspaceId as string;
      void (async () => {
        try {
          const { hostStorage, wsKeys } = await import('@openheaders/oracle/storage');
          const snapshots =
            ((await hostStorage.get(wsKeys(workspaceId).lastImportedSnapshots)) as
              | Record<string, string>
              | undefined) ?? {};
          safeResponse({ snapshots });
        } catch {
          safeResponse({ snapshots: {} });
        }
      })();
      return true;
    } else if (message.type === 'importWorkspace') {
      // Drive the import orchestrator. SW reads target state, runs a
      // fresh diff under the workspace-import lock, applies the plan,
      // and persists the report. See `workspace-import-orchestrator.ts`.
      importWorkspaceFromExport({
        incoming: message.incoming as Parameters<typeof importWorkspaceFromExport>[0]['incoming'],
        strategies: message.strategies as Parameters<typeof importWorkspaceFromExport>[0]['strategies'],
        backupRestore: message.backupRestore as boolean | undefined,
        trustExport: message.trustExport as boolean | undefined,
        stripScripts: message.stripScripts as boolean | undefined,
        omitOAuthConfigs: message.omitOAuthConfigs as boolean | undefined,
        keepTargetCollectionOrder: message.keepTargetCollectionOrder as boolean | undefined,
        refuseUidCollision: message.refuseUidCollision as boolean | undefined,
        target: message.target as Parameters<typeof importWorkspaceFromExport>[0]['target'],
        sourceHash: message.sourceHash as string,
      })
        .then((res) => safeResponse({ success: true, report: res.report, targetWorkspaceId: res.targetWorkspaceId }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
      // ── Environments / Variables / Vault ─────────────────────────
    } else if (message.type === 'listEnvironments') {
      safeResponse({
        environments: getEnvironments(),
        activeEnvironmentId: getActiveEnvironmentId(),
        defaultEnvironmentId: getDefaultEnvironmentId(),
        collectionEnvOverrides: getCollectionEnvOverrides(),
        manualEnvId: getManualEnvId(),
      });
    } else if (message.type === 'createEnvironment') {
      const name = message.name as string;
      const variables = (message.variables as Variable[] | undefined) ?? [];
      const environment = createEnvironment(name, variables);
      safeResponse({ success: true, environment });
    } else if (message.type === 'renameEnvironment') {
      renameEnvironment(message.uid as string, message.name as string)
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'updateEnvironmentVariables') {
      updateEnvironmentVariables(message.uid as string, message.variables as Variable[])
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'deleteEnvironment') {
      deleteEnvironment(message.uid as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'setCollectionPinnedEnvs') {
      const collectionUid = message.collectionUid as string;
      const pinnedEnvironmentIds = message.pinnedEnvironmentIds as string[];
      const defaultEnvironmentId = message.defaultEnvironmentId as string | null;
      updateCollectionPinnedEnvs(collectionUid, pinnedEnvironmentIds, defaultEnvironmentId)
        .then((ok) => safeResponse({ success: ok }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'getWorkspaceVariables') {
      safeResponse({ workspaceVariables: getWorkspaceVariables() });
    } else if (message.type === 'getVault') {
      safeResponse({ vault: getVault() });
    } else if (message.type === 'updateCollectionVariables') {
      updateCollectionVariables(message.collectionUid as string, message.variables as Variable[])
        .then((result) => {
          if (result.ok) {
            // Collection-scoped variable edits change resolved DNR output;
            // the resolver-invalidate runner consumes the same intent
            // emitted by the catalog factory, so the recompile fires
            // through the broadcast path. The legacy `scheduleUpdate`
            // call here was the pre-Phase-B route — retained as a
            // belt-and-braces guarantee that the bridge dispatch path
            // doesn't depend on broadcast ordering.
            scheduleUpdate('vars', { immediate: true });
          }
          safeResponse(result);
        })
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;

      // ── API Requests (active workspace) ───────────────────────
    } else if (message.type === 'getLocalRequests') {
      safeResponse({ requests: getRequests() });
    } else if (message.type === 'getLocalRequest') {
      const request = getRequestById(message.requestUid as string);
      safeResponse({ success: request !== null, request: request ?? undefined });
    } else if (message.type === 'getLocalRequestCollections') {
      safeResponse({ collections: getRequestCollections() });
    } else if (message.type === 'getLocalRequestCollectionTrees') {
      safeResponse({ collectionTrees: getRequestCollectionTrees() });
    } else if (message.type === 'getLocalRequestFolders') {
      safeResponse({ folders: getRequestFolders() });
    } else if (message.type === 'createLocalRequest') {
      const name = (message.name as string | undefined) ?? 'New Request';
      const collectionUid = message.collectionUid as string | undefined;
      const parentPath = message.parentPath as string | undefined;
      const seed = message.seed as Partial<Request> | undefined;

      // Resolve the target collection, falling back to the default if
      // the caller's preferred collection was deleted between when the
      // draft opened and when the user clicked Save. Without the
      // existence check, `addRequestToCollection` would fabricate a
      // `requests/<deleted-uid>/...` path and orphan the request —
      // stored but not rendered by any tree.
      const knownCollections = getRequestCollections();
      const resolveTargetUid = async (): Promise<string> => {
        if (collectionUid && knownCollections.some((c) => c.uid === collectionUid)) {
          return collectionUid;
        }
        const fallback = await ensureDefaultRequestCollection();
        return fallback.uid;
      };

      // Folder parent takes precedence over collection root — if the
      // caller gave us an explicit `parentPath`, drop the request
      // directly there; otherwise use the collection's root path.
      (async () => {
        const targetCollectionUid = parentPath ? '' : await resolveTargetUid();
        const created = parentPath
          ? await addRequest(name, parentPath, seed)
          : await addRequestToCollection(name, targetCollectionUid, seed);
        return created;
      })()
        .then((created) => safeResponse({ success: true, request: created }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'updateLocalRequest') {
      updateRequest(
        message.requestUid as string,
        message.updates as Partial<Omit<Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
      )
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'deleteLocalRequest') {
      deleteRequest(message.requestUid as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'createLocalRequestCollection') {
      createRequestCollection(message.name as string)
        .then((collection) => safeResponse({ success: true, collection }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'renameLocalRequestCollection') {
      renameRequestCollection(message.collectionUid as string, message.name as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'deleteLocalRequestCollection') {
      deleteRequestCollection(message.collectionUid as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'createLocalRequestFolder') {
      createRequestFolder(message.name as string, message.parentPath as string)
        .then((folder) =>
          folder
            ? safeResponse({ success: true, folder })
            : safeResponse({ success: false, error: 'parent path not resolvable' }),
        )
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'renameLocalRequestFolder') {
      renameRequestFolder(message.folderUid as string, message.name as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'deleteLocalRequestFolder') {
      deleteRequestFolder(message.folderUid as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'executeRequest') {
      const requestUid = message.requestUid as string | undefined;
      const draft = message.draft as Request | undefined;
      const environmentId = message.environmentId as string | undefined;
      const exec = requestUid
        ? executeRequest(requestUid, { environmentId })
        : draft
          ? executeRequestDraft(draft, { environmentId })
          : Promise.resolve(null);
      exec
        .then((snapshot) => {
          if (!snapshot) {
            safeResponse({ success: false, error: 'No request or draft provided' });
          } else {
            safeResponse({ success: true, snapshot });
          }
        })
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
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
    } else if (message.type === 'getWorkspaceTabOrdinal') {
      const tabId = _sender.tab?.id;
      const ordinal = typeof tabId === 'number' ? ordinalForTab(tabId) : null;
      safeResponse({ ordinal, count: workspaceTabCount() });
    } else if (message.type === 'openWorkspaceIntent') {
      // Focus-or-create dispatch for cross-surface workspace navigation.
      // Payload is intentionally validated inside the navigator (schema
      // at the boundary); we just forward the raw fields here.
      const payload = message as unknown as {
        intent?: unknown;
        callerContext?: {
          surface?: 'popup' | 'sidepanel' | 'devpanel' | 'workspace';
          callerWindowId?: number;
          callerWorkspaceId?: string;
        };
      };
      openWorkspaceIntent(payload.intent, payload.callerContext ?? {})
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: err.message }));
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

      // ── Rule CRUD (active workspace) ──────────────────────────
    } else if (message.type === 'deleteRule') {
      const ruleId = message.ruleId as string;
      deleteRule(ruleId)
        .then((success) => {
          if (success) {
            // DNR recompile is handled by the sync DNR intent runner
            // (`background/sync/dnr-intent-runner.ts`) — every Rule
            // mutator emits a `RECOMPILE_DNR` intent that the runner
            // drains on the post-commit broadcast. Legacy
            // `scheduleUpdate('rules', { immediate: true })` removed.
            updateBadgeCallback();
            pruneOrphanTestRunOwners();
          }
          safeResponse({ success });
        })
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
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
    } else if (message.type === 'getLocalRules') {
      safeResponse({ rules: getRules() });
    } else if (message.type === 'getLocalCollections') {
      safeResponse({ collections: getCollections() });
    } else if (message.type === 'getLocalCollectionTrees') {
      safeResponse({ collectionTrees: getCollectionTrees() });
    } else if (message.type === 'getLocalFolders') {
      safeResponse({ folders: getFolders() });
    } else if (message.type === 'createLocalFolder') {
      createFolder(message.name as string, message.parentPath as string)
        .then((folder) => safeResponse({ success: Boolean(folder), folder: folder ?? undefined }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'renameLocalFolder') {
      renameFolder(message.folderUid as string, message.name as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'deleteLocalFolder') {
      deleteFolder(message.folderUid as string)
        .then((success) => {
          if (success) {
            // Cascade per-rule deletes flow through the oracle (see
            // rule-store.ts `deleteFolder`) and emit RECOMPILE_DNR
            // intents the runner drains. Legacy scheduleUpdate dropped.
            updateBadgeCallback();
            pruneOrphanTestRunOwners();
          }
          safeResponse({ success });
        })
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'createLocalCollection') {
      const name = message.name as string;
      const collection = createCollection(name);
      safeResponse({ success: true, collection });
    } else if (message.type === 'renameLocalCollection') {
      renameCollection(message.collectionUid as string, message.name as string)
        .then((result) => safeResponse({ success: result.ok }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'deleteLocalCollection') {
      deleteCollection(message.collectionUid as string)
        .then((success) => {
          if (success) {
            // Cascade rule deletes route through the oracle; runner
            // covers the DNR recompile. Legacy scheduleUpdate dropped.
            updateBadgeCallback();
            pruneOrphanTestRunOwners();
          }
          safeResponse({ success });
        })
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;

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
      const templateData = message.template as Omit<Template, 'uid' | 'path'>;
      const parentPath = message.parentPath as string | undefined;
      const collectionUid = message.collectionUid as string | undefined;

      const create = async (): Promise<Template> => {
        if (parentPath) return addTemplate(templateData, parentPath);
        const collection = collectionUid ? { uid: collectionUid } : await ensureDefaultTemplateCollection();
        return addTemplateToCollection(templateData, collection.uid);
      };
      create()
        .then((created) => safeResponse({ success: true, template: created }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'updateTemplate') {
      updateTemplate(
        message.templateUid as string,
        message.updates as Partial<Omit<Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
      )
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'deleteTemplate') {
      deleteTemplate(message.templateUid as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'createTemplateCollection') {
      createTemplateCollection(message.name as string)
        .then((collection) => safeResponse({ success: true, collection }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'renameTemplateCollection') {
      renameTemplateCollection(message.collectionUid as string, message.name as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'deleteTemplateCollection') {
      deleteTemplateCollection(message.collectionUid as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'createTemplateFolder') {
      createTemplateFolder(message.name as string, message.parentPath as string)
        .then((folder) => safeResponse(folder ? { success: true, folder } : { success: false }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'renameTemplateFolder') {
      renameTemplateFolder(message.folderUid as string, message.name as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'deleteTemplateFolder') {
      deleteTemplateFolder(message.folderUid as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;

      // ── Observability log ────────────────────────────────────────
    } else if (message.type === 'getObservabilityLog') {
      safeResponse({ entries: [...getObservabilityLog()] });
    } else if (message.type === 'clearObservabilityLog') {
      clearObservabilityLog();
      safeResponse({ success: true });

      // ── Import reports ───────────────────────────────────────────
    } else if (message.type === 'recordImportReport') {
      const report = message.report as import('@openheaders/core/import').ImportReport;
      recordImportReport(report)
        .then(() => safeResponse({ success: true }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'listImportReports') {
      listImportReports()
        .then((reports) => safeResponse({ reports }))
        .catch((err: Error) => safeResponse({ reports: [], error: err.message }));
      return true;
    } else if (message.type === 'clearImportReports') {
      clearImportReports()
        .then(() => safeResponse({ success: true }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'findImportReportBySourceHash') {
      const hash = (message.sourceHash as string | undefined) ?? '';
      findImportReportBySourceHash(hash)
        .then((report) => safeResponse({ report }))
        .catch((err: Error) => safeResponse({ report: null, error: err.message }));
      return true;

      // ── Files (Phase 12 — content-addressed blobs) ──────────────
    } else if (message.type === 'listFiles') {
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      listFiles(workspaceId)
        .then((files) => safeResponse({ files }))
        .catch((err: Error) => safeResponse({ files: [], error: err.message }));
      return true;
    } else if (message.type === 'putFile') {
      const filename = message.filename as string;
      const mimeType = message.mimeType as string | undefined;
      const bytesBase64 = message.bytesBase64 as string;
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      const blob = base64ToBlob(bytesBase64, mimeType);
      putFile({ blob, filename, mimeType, workspaceId })
        .then((fileRef) => safeResponse({ success: true, fileRef }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'getFile') {
      const fileId = message.fileId as string;
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      getFileBlob(fileId, workspaceId)
        .then(async (blob) => {
          if (!blob) {
            safeResponse({ found: false });
            return;
          }
          const bytesBase64 = await blobToBase64(blob);
          safeResponse({ found: true, bytesBase64, mimeType: blob.type });
        })
        .catch((err: Error) => safeResponse({ found: false, error: err.message } as unknown as { found: false }));
      return true;
    } else if (message.type === 'deleteFile') {
      const fileId = message.fileId as string;
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      deleteFile(fileId, workspaceId)
        .then((removed) => safeResponse({ success: true, removed }))
        .catch((err: Error) => safeResponse({ success: false, removed: false, error: err.message }));
      return true;
    } else if (message.type === 'renameFile') {
      const fileId = message.fileId as string;
      const filename = message.filename as string;
      const mimeType = message.mimeType as string | undefined;
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      renameFile({ fileId, filename, mimeType, workspaceId })
        .then((fileRef) =>
          safeResponse(fileRef ? { success: true, found: true, fileRef } : { success: true, found: false }),
        )
        .catch((err: Error) => safeResponse({ success: false, found: false, error: err.message }));
      return true;

      // ── OAuth 2.0 / OIDC (Phase 13) ──────────────────────────────
      // Renderer reads via `hostStorage.subscribe(wsKeys(ws).oauth)` (MWPT-FULL § 8.3.10);
      // the former `listOAuthTokens` RPC + `oauthTokensChanged` broadcast were deleted.
    } else if (message.type === 'oauthAuthorize') {
      const config = message.config as import('@openheaders/core/types').OAuth2Auth;
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      launchAuthorizationCodeFlow(config, workspaceId)
        .then((result) => safeResponse({ success: true, bundle: result.bundle, redirectUri: result.redirectUri }))
        .catch((err: Error) => {
          const msg = err instanceof OAuth2FlowError ? `${err.step}: ${err.message}` : err.message;
          safeResponse({ success: false, error: msg });
        });
      return true;
    } else if (message.type === 'oauthClientCredentials') {
      const config = message.config as import('@openheaders/core/types').OAuth2Auth;
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      performClientCredentialsFlow(config, workspaceId)
        .then((bundle) => safeResponse({ success: true, bundle }))
        .catch((err: Error) => {
          const msg = err instanceof OAuth2FlowError ? `${err.step}: ${err.message}` : err.message;
          safeResponse({ success: false, error: msg });
        });
      return true;
    } else if (message.type === 'oauthRefresh') {
      const config = message.config as import('@openheaders/core/types').OAuth2Auth;
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      performRefresh(config, workspaceId)
        .then((bundle) => safeResponse({ success: true, bundle }))
        .catch((err: Error) => {
          const msg = err instanceof OAuth2FlowError ? `${err.step}: ${err.message}` : err.message;
          safeResponse({ success: false, error: msg });
        });
      return true;
    } else if (message.type === 'oauthRevoke') {
      const credentialRef = message.credentialRef as string;
      const workspaceId = typeof message.workspaceId === 'string' ? (message.workspaceId as string) : undefined;
      deleteTokenBundle(credentialRef, workspaceId)
        .then((removed) => safeResponse({ success: true, removed }))
        .catch((err: Error) => safeResponse({ success: false, removed: false, error: err.message }));
      return true;
    } else if (message.type === 'oauthGetRedirectUri') {
      safeResponse({ redirectUri: getOAuthRedirectUri() });
      return true;

      // ── Live Variables + Workflows (Phase B) ─────────────────────
    } else if (message.type === 'listLiveWorkflows') {
      safeResponse({ workflows: getLiveWorkflows() });
      return true;
    } else if (message.type === 'getLiveWorkflow') {
      safeResponse({ workflow: getLiveWorkflow(message.uid as string) });
      return true;
    } else if (message.type === 'createLiveWorkflow') {
      void (async () => {
        try {
          const workflow = await createLiveWorkflow({
            name: message.name as string,
            description: message.description as string | undefined,
            steps: message.steps as import('@openheaders/core/types').WorkflowStep[] | undefined,
            refresh: message.refresh as import('@openheaders/core/types').RefreshPolicy | undefined,
            enabled: message.enabled as boolean | undefined,
          });
          safeResponse({ success: true, workflow });
        } catch (err) {
          safeResponse({ success: false, error: (err as Error).message });
        }
      })();
      return true;
    } else if (message.type === 'updateLiveWorkflow') {
      const req = message as {
        uid: string;
        updates: Partial<Omit<import('@openheaders/core/types').LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>;
      };
      updateLiveWorkflow(req.uid, req.updates)
        .then((result) => {
          if (result.ok) {
            safeResponse({ success: true, workflow: result.workflow });
          } else if (result.reason === 'not-found') {
            safeResponse({ success: false, reason: 'not-found' });
          } else {
            safeResponse({ success: false, reason: 'other', error: result.message });
          }
        })
        .catch((err: Error) => safeResponse({ success: false, reason: 'other', error: err.message }));
      return true;
    } else if (message.type === 'deleteLiveWorkflow') {
      deleteLiveWorkflow(message.uid as string)
        .then((removed) => {
          if (removed) {
            // Cache entries for the deleted workflow are now orphaned — purge
            // them so the scheduler + resolver never serve values from a
            // workflow that no longer exists.
            void clearWorkflowRunCache(message.uid as string);
          }
          safeResponse({ success: removed });
        })
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'listLiveVariables') {
      safeResponse({ variables: getLiveVariables() });
      return true;
    } else if (message.type === 'getLiveVariable') {
      safeResponse({ variable: getLiveVariable(message.uid as string) });
      return true;
    } else if (message.type === 'createLiveVariable') {
      void (async () => {
        try {
          const variable = await createLiveVariable({
            name: message.name as string,
            workflowUid: message.workflowUid as string,
            stepId: message.stepId as string,
            captureName: message.captureName as string,
            description: message.description as string | undefined,
            requireFreshOnRuleBuild: message.requireFreshOnRuleBuild as boolean | undefined,
            enabled: message.enabled as boolean | undefined,
          });
          safeResponse({ success: true, variable });
        } catch (err) {
          safeResponse({ success: false, error: (err as Error).message });
        }
      })();
      return true;
    } else if (message.type === 'updateLiveVariable') {
      const req = message as {
        uid: string;
        updates: Partial<Omit<import('@openheaders/core/types').LiveVariable, 'uid' | 'path' | 'schemaVersion'>>;
      };
      updateLiveVariable(req.uid, req.updates)
        .then((result) => {
          if (result.ok) {
            safeResponse({ success: true, variable: result.variable });
          } else if (result.reason === 'not-found') {
            safeResponse({ success: false, reason: 'not-found' });
          } else {
            safeResponse({ success: false, reason: 'other', error: result.message });
          }
        })
        .catch((err: Error) => safeResponse({ success: false, reason: 'other', error: err.message }));
      return true;
    } else if (message.type === 'deleteLiveVariable') {
      deleteLiveVariable(message.uid as string)
        .then((removed) => safeResponse({ success: removed }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'setLiveVariableOverride') {
      const req = message as {
        uid: string;
        override: import('@openheaders/core/types').LiveVariableOverride | null;
      };
      setLiveVariableOverride(req.uid, req.override)
        .then((result) => {
          if (result.ok) {
            safeResponse({ success: true, variable: result.variable });
          } else if (result.reason === 'not-found') {
            safeResponse({ success: false, reason: 'not-found' });
          } else {
            safeResponse({ success: false, reason: 'other', error: result.message });
          }
        })
        .catch((err: Error) => safeResponse({ success: false, reason: 'other', error: err.message }));
      return true;
    } else if (message.type === 'getLiveCacheForWorkflow') {
      // Workbench tab editing W2 reads W2's cache; system surfaces +
      // legacy callers omit workspaceId and fall back to runtime-Active
      // inside `listCachesForWorkflow` (MWPT-FULL session #11).
      const wsArg = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
      listLiveCacheForWorkflow(message.workflowUid as string, wsArg)
        .then((runs) => safeResponse({ runs }))
        .catch((err: Error) => safeResponse({ runs: [], error: err.message }));
      return true;
    } else if (message.type === 'resetLiveWorkflowCircuit') {
      // "Reset circuit" action from the Workflow Status sidebar.
      // Clears consecutiveFailures + consecutiveOpenings + nextAttemptAt
      // on the target (workflow, env) pair so the next scheduled or
      // manual refresh starts from a clean slate. Does NOT run a probe
      // — the user may want to reset + then navigate elsewhere.
      const req = message as { workflowUid: string; environmentId?: string | null; workspaceId?: string };
      void (async () => {
        // Workbench tab editing W2 resets W2's circuit; system surfaces
        // omit workspaceId and fall back to runtime-Active (MWPT-FULL
        // session #11 — closes the same-class bug for the Workflow
        // Status sidebar's per-row reset action).
        const wsId = req.workspaceId ?? getActiveWorkspaceId();
        const envId = req.environmentId ?? null;
        try {
          await resetCircuitForWorkflow(wsId, req.workflowUid, envId);
          safeResponse({ success: true });
        } catch (err) {
          const thrownMessage = err instanceof Error ? err.message : String(err);
          safeResponse({ success: false, error: thrownMessage });
        }
      })();
      return true;
    } else if (message.type === 'refreshLiveWorkflowNow') {
      // Manual refresh from the "Refresh now" button — route through
      // `refreshLiveWorkflowByUser` which bypasses the canSchedule
      // binding gate (the alarm path keeps the gate to avoid burning
      // quota on orphan workflows, but a user-initiated refresh should
      // work even before any LV is bound — common diagnostic flow).
      // Thrown errors are the source of truth for success/failure;
      // the cache row carries extra context (step uid on chain
      // failures) when available.
      const req = message as { workflowUid: string; environmentId?: string | null; workspaceId?: string };
      void (async () => {
        // Same threading contract as `resetLiveWorkflowCircuit` —
        // workbench gestures from a diverged tab pass the editing-scope
        // workspaceId; system surfaces fall back to runtime-Active.
        const wsId = req.workspaceId ?? getActiveWorkspaceId();
        const envId = req.environmentId ?? null;
        try {
          await refreshLiveWorkflowByUser(wsId, req.workflowUid, envId);
          const run = await getWorkflowRunCache(req.workflowUid, envId, wsId);
          safeResponse({ success: true, run });
        } catch (err) {
          const run = await getWorkflowRunCache(req.workflowUid, envId, wsId);
          const thrownMessage = err instanceof Error ? err.message : String(err);
          safeResponse({ success: false, error: run?.lastErrorMessage ?? thrownMessage });
        }
      })();
      return true;

      // ── Status snapshot ──────────────────────────────────────────
    } else if (message.type === 'getStatusSnapshot') {
      safeResponse({ snapshot: getStatusSnapshot() });

      // ── Awareness (Phase A A1) ─────────────────────────────────
    } else if (message.type === 'oh.awareness.publish') {
      const request = message as unknown as import('@openheaders/core/protocol').AwarenessPublishRequest;
      try {
        safeResponse(publishAwareness(request));
      } catch (err) {
        logger.info('MessageHandler', 'oh.awareness.publish rejected:', (err as Error).message);
        safeResponse({ ok: true, presence: [] });
      }
    } else if (message.type === 'oh.awareness.snapshot') {
      safeResponse({
        workspaceId: getActiveWorkspaceId(),
        presence: snapshotAwarenessPresence(),
      });
      // ── Sync engine (Phase A) ──────────────────────────────────
      // The renderer passes `workspaceId` on every per-workspace
      // snapshot RPC (commit 2 — renderer mirror plane). Legacy /
      // unbounded callers omit it; the SW falls back to the runtime-
      // Active workspace inside `oracleForWorkspace(workspaceId)`.
    } else if (
      typeof message.type === 'string' &&
      message.type.startsWith('oh.sync.snapshot') &&
      message.type !== 'oh.sync.snapshotExtensionWorkspaces'
    ) {
      const wsArg = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
      if (message.type === 'oh.sync.snapshotRules') {
        safeResponse({ entries: snapshotRulePostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotEnvironments') {
        safeResponse({ entries: snapshotEnvironmentPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotCollections') {
        safeResponse({ entries: snapshotCollectionPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotWorkspaceVariables') {
        safeResponse({ entries: snapshotWorkspaceVariablesPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotVault') {
        safeResponse({ entries: snapshotVaultPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotFolders') {
        safeResponse({ entries: snapshotFolderPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotRequests') {
        safeResponse({ entries: snapshotRequestPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotRequestCollections') {
        safeResponse({ entries: snapshotRequestCollectionPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotRequestFolders') {
        safeResponse({ entries: snapshotRequestFolderPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotTemplates') {
        safeResponse({ entries: snapshotTemplatePostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotTemplateCollections') {
        safeResponse({ entries: snapshotTemplateCollectionPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotTemplateFolders') {
        safeResponse({ entries: snapshotTemplateFolderPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotLiveVariables') {
        safeResponse({ entries: snapshotLiveVariablePostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotLiveWorkflows') {
        safeResponse({ entries: snapshotLiveWorkflowPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotOAuthBundle') {
        safeResponse({ entries: snapshotOAuthBundlePostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotPauseMarkers') {
        safeResponse({ entries: snapshotPauseMarkersPostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotLayoutState') {
        safeResponse({ entries: snapshotLayoutStatePostStates(wsArg) });
      } else if (message.type === 'oh.sync.snapshotFiles') {
        safeResponse({ entries: snapshotFilesPostStates(wsArg) });
      }
    } else if (message.type === 'oh.sync.snapshotExtensionWorkspaces') {
      safeResponse({ entries: snapshotExtensionWorkspacePostStates() });
    } else if (message.type === 'oh.sync.apply') {
      // Wire shape: SyncApplyRequest from @openheaders/core/protocol.
      // The bridge layer flattens `{ type, ...payload }` onto the
      // envelope, so we cast the whole envelope back to the request
      // type and let the service do the actual apply under the
      // oracle's per-entity lock.
      const request = message as unknown as import('@openheaders/core/protocol').SyncApplyRequest;
      applySyncRequest(request)
        .then((response) => safeResponse(response))
        .catch((err: Error) => {
          logger.info('MessageHandler', 'oh.sync.apply rejected:', err.message);
          // Surface a structured ack so callers don't need a
          // separate "transport-level error" branch — the oracle
          // failure path uses the same shape.
          // Transport-level errors (IDB unavailable, lock timeout)
          // surface through the same SyncApplyResponse shape — caller
          // doesn't need a parallel error branch. `schema-rejected` is
          // the broadest "couldn't apply" status; `detail` carries the
          // human-readable cause.
          safeResponse({
            ok: false,
            outcomes: [],
            failure: { mutationId: '', status: 'schema-rejected', detail: err.message },
          });
        });
      return true;
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

/**
 * Base64 helpers for file-blob transport. `chrome.runtime.sendMessage`
 * JSON-serializes its payload so ArrayBuffer / Blob are not directly
 * usable on the wire; encoding to base64 is the cross-browser-safe
 * bridge for the putFile / getFile RPCs. Chunked conversion below
 * avoids `btoa(String.fromCharCode(...bigArray))`'s stack overflow
 * on files larger than a few hundred KB.
 */
function base64ToBlob(b64: string, mimeType: string | undefined): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], mimeType ? { type: mimeType } : undefined);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    // String.fromCharCode spread is bounded at ~65535 args in some engines;
    // the explicit CHUNK cap above keeps us safe.
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
