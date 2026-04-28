/**
 * Message Handler — handles non-recording RPCs from every extension
 * surface (popup, sidepanel, workbench.html, devtools panel).
 *
 * Every handler is a pure dispatch: parse the request, delegate to the
 * appropriate per-workspace store, emit the broadcast side-effects
 * through the rule-engine, and return the response. Cross-store
 * orchestration (workspace switching / duplication / deletion) lives
 * in `workspace-orchestrator.ts` — we call it, not inline it.
 */

import type { V5 } from '@openheaders/core/types';
import { doesUrlMatchEntry, getRuleMatchPatterns } from '@openheaders/core/utils';
import { buildWorkspaceExport, serializeWorkspaceExport } from '@openheaders/core/workspace-export';
import { broadcast } from '@utils/bridge';
import { runtime as browserRuntime, isChrome, isEdge, isFirefox, isSafari, tabs } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { applySyncRequest, snapshotRulePostStates } from '@/background/sync/service';
import { getStatusSnapshot } from '@/shared/status';
import type { MessageHandlerContext, SendResponse } from '@/types/browser';
import type { PerfResourceEntry } from '@/types/perf';
import { disableCacheBypassForTab, enableCacheBypassForTab } from './cache-bypass';
import {
  createEnvironment,
  deleteEnvironment,
  deleteVaultSecret,
  getActiveEnvironmentId,
  getCollectionEnvOverrides,
  getDefaultEnvironmentId,
  getEnvironments,
  getManualEnvId,
  getVault,
  getVaultSecret,
  getWorkspaceVariables,
  listVaultSecretNames,
  putVaultSecret,
  renameEnvironment,
  setActiveEnvironment,
  setCollectionEnvOverride,
  setDefaultEnvironment,
  setManualEnv,
  setVault,
  setWorkspaceVariables,
  updateEnvironmentVariables,
} from './environment-store';
import { deleteFile, getFileBlob, listFiles, putFile } from './files-store';
import {
  clearImportReports,
  findImportReportBySourceHash,
  listImportReports,
  recordImportReport,
} from './import-reports-store';
import { setPanelLayout } from './layout-store';
import {
  clearWorkflowRunCache,
  getWorkflowRunCache,
  listCachesForWorkflow as listLiveCacheForWorkflow,
} from './live-cache-store';
import { refreshLiveWorkflowByUser, resetCircuitForWorkflow } from './live-refresh-scheduler';
import {
  createLiveVariable,
  deleteLiveVariable,
  getLiveVariable,
  getLiveVariables,
  setLiveVariableOverride,
  updateLiveVariable,
} from './live-variable-store';
import {
  createLiveWorkflow,
  deleteLiveWorkflow,
  getLiveWorkflow,
  getLiveWorkflows,
  updateLiveWorkflow,
} from './live-workflow-store';
import {
  getOAuthRedirectUri,
  launchAuthorizationCodeFlow,
  OAuth2FlowError,
  performClientCredentialsFlow,
  performRefresh,
} from './oauth-flow';
import { deleteTokenBundle, listTokenBundles } from './oauth-token-store';
import { clearObservabilityLog, getObservabilityLog } from './observability-log';
import { handleScriptHostRequest } from './offscreen-host';
import { replaceMarkers as replacePauseMarkers } from './pause-markers-store';
import { executeRequest, executeRequestDraft } from './request-executor';
import { clearPendingScriptsReview, getPendingScriptsReview } from './request-scripts-review-store';
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
} from './request-store';
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
  getCollections,
  getCollectionTrees,
  getFolders,
  getRules,
  renameCollection,
  renameFolder,
  toggleRule,
  updateCollectionPinnedEnvs,
  updateCollectionVariables,
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
import { getResolvedRules } from './variables-resolver';
import { gatherWorkspaceExport } from './workspace-export-gatherer';
import { consumeImportHandoff, registerImportHandoff } from './workspace-export-handoff-store';
import { findExportImportMatches } from './workspace-import-dedup';
import { importWorkspace as importWorkspaceFromExport, previewWorkspaceImport } from './workspace-import-orchestrator';
import { openWorkspaceIntent } from './workspace-navigator';
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
import { ordinalForTab, workspaceTabCount } from './workspace-tab-registry';

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
        .then((result) => safeResponse({ success: result.ok }))
        .catch(() => safeResponse({ success: false }));
      return true;
    } else if (message.type === 'updateWorkspace') {
      const expectedVersion = message.expectedVersion as number | undefined;
      updateWorkspaceMeta(message.id as string, message.updates as Record<string, unknown>, { expectedVersion })
        .then((result) => {
          if (result.ok) {
            safeResponse({ success: true, workspace: result.workspace, version: result.version });
          } else if (result.reason === 'stale-draft') {
            safeResponse({
              success: false,
              reason: 'stale-draft',
              serverVersion: result.serverVersion,
              serverWorkspace: result.serverWorkspace,
            });
          } else {
            safeResponse({ success: false, reason: 'not-found' });
          }
        })
        .catch((err: Error) => safeResponse({ success: false, reason: 'other', message: err.message }));
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
      const variables = (message.variables as V5.Variable[] | undefined) ?? [];
      const environment = createEnvironment(name, variables);
      safeResponse({ success: true, environment });
    } else if (message.type === 'renameEnvironment') {
      // Rename-only writes don't flow through a stateful editor, so
      // no `expectedVersion` is enforced here — it's a
      // fire-and-forget sidebar action. The store still bumps the
      // counter so subsequent editor saves notice the bump.
      renameEnvironment(message.uid as string, message.name as string)
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'updateEnvironmentVariables') {
      const expectedVersion = message.expectedVersion as number | undefined;
      updateEnvironmentVariables(message.uid as string, message.variables as V5.Variable[], { expectedVersion })
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'deleteEnvironment') {
      deleteEnvironment(message.uid as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'setActiveEnvironment') {
      const uid = message.uid as string | null;
      setActiveEnvironment(uid)
        .then((ok) => safeResponse({ success: ok }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'setDefaultEnvironment') {
      const uid = message.uid as string | null;
      setDefaultEnvironment(uid)
        .then((ok) => safeResponse({ success: ok }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'setManualEnv') {
      const uid = message.uid as string | null;
      setManualEnv(uid)
        .then((ok) => safeResponse({ success: ok }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === 'setCollectionEnvOverride') {
      const collectionId = message.collectionId as string;
      const envId = message.envId as string | null | undefined;
      setCollectionEnvOverride(collectionId, envId)
        .then(() => safeResponse({ success: true }))
        .catch((error: Error) => safeResponse({ success: false, error: error.message }));
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
    } else if (message.type === 'setWorkspaceVariables') {
      const expectedVersion = message.expectedVersion as number | undefined;
      const payload = message.workspaceVariables as V5.WorkspaceVariables;
      setWorkspaceVariables({ variables: payload.variables }, { expectedVersion })
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'getVault') {
      safeResponse({ vault: getVault() });
    } else if (message.type === 'setVault') {
      const expectedVersion = message.expectedVersion as number | undefined;
      const payload = message.vault as V5.Vault;
      setVault({ secrets: payload.secrets }, { expectedVersion })
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'vaultPutSecret') {
      putVaultSecret(message.key as string, message.value as string)
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'vaultDeleteSecret') {
      deleteVaultSecret(message.key as string)
        .then((result) => safeResponse(result))
        .catch((err: Error) => safeResponse({ ok: false, reason: 'other', message: err.message }));
      return true;
    } else if (message.type === 'vaultGetSecret') {
      safeResponse({ value: getVaultSecret(message.key as string) });
    } else if (message.type === 'vaultListSecretNames') {
      safeResponse({ names: listVaultSecretNames() });
    } else if (message.type === 'setPauseMarkers') {
      const payload = message.markers as Record<string, 'paused' | 'unpaused'>;
      replacePauseMarkers(payload)
        .then(() => {
          scheduleUpdate('pause-markers', { immediate: true });
          updateBadgeCallback();
          safeResponse({ success: true });
        })
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'updateCollectionVariables') {
      const expectedVersion = message.expectedVersion as number | undefined;
      updateCollectionVariables(message.collectionUid as string, message.variables as V5.Variable[], {
        expectedVersion,
      })
        .then((result) => {
          if (result.ok) {
            // Collection-scoped variable edits change resolved DNR output —
            // force a recompile so the effect is immediate.
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
      const seed = message.seed as Partial<V5.Request> | undefined;

      // Resolve the target collection, falling back to the default if
      // the caller's preferred collection was deleted between when the
      // draft opened and when the user clicked Save. Without the
      // existence check, `addRequestToCollection` would fabricate a
      // `requests/<deleted-uid>/...` path and orphan the request —
      // stored but not rendered by any tree.
      const knownCollections = getRequestCollections();
      const targetCollectionUid =
        collectionUid && knownCollections.some((c) => c.uid === collectionUid)
          ? collectionUid
          : ensureDefaultRequestCollection().uid;

      // Folder parent takes precedence over collection root — if the
      // caller gave us an explicit `parentPath`, drop the request
      // directly there; otherwise use the collection's root path.
      const created = parentPath
        ? addRequest(name, parentPath, seed)
        : addRequestToCollection(name, targetCollectionUid, seed);
      safeResponse({ success: true, request: created });
    } else if (message.type === 'updateLocalRequest') {
      const expectedVersion = message.expectedVersion as number | undefined;
      updateRequest(
        message.requestUid as string,
        message.updates as Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
        { expectedVersion },
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
      const collection = createRequestCollection(message.name as string);
      safeResponse({ success: true, collection });
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
      const folder = createRequestFolder(message.name as string, message.parentPath as string);
      safeResponse({ success: true, folder });
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
      const draft = message.draft as V5.Request | undefined;
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
        callerContext?: { surface?: 'popup' | 'sidepanel' | 'devpanel' | 'workspace'; callerWindowId?: number };
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
    } else if (message.type === 'deleteRule') {
      const ruleId = message.ruleId as string;
      deleteRule(ruleId)
        .then((success) => {
          if (success) {
            scheduleUpdate('rules', { immediate: true });
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
    } else if (message.type === 'createLocalRule') {
      const ruleData = message.rule as Omit<V5.Rule, 'uid' | 'path'>;
      const parentPath = message.parentPath as string | undefined;
      const collectionUid = message.collectionUid as string | undefined;

      const createPromise: Promise<V5.Rule> = parentPath
        ? addRule(ruleData, parentPath)
        : addRuleToCollection(ruleData, (collectionUid ? { uid: collectionUid } : ensureDefaultCollection()).uid);
      createPromise
        .then((created) => {
          scheduleUpdate('rules', { immediate: true });
          updateBadgeCallback();
          safeResponse({ success: true, rule: created });
        })
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
      const folder = createFolder(message.name as string, message.parentPath as string);
      safeResponse({ success: true, folder });
    } else if (message.type === 'renameLocalFolder') {
      renameFolder(message.folderUid as string, message.name as string)
        .then((success) => safeResponse({ success }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'deleteLocalFolder') {
      deleteFolder(message.folderUid as string)
        .then((success) => {
          if (success) {
            scheduleUpdate('rules', { immediate: true });
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
            scheduleUpdate('rules', { immediate: true });
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
    } else if (message.type === 'toggleAllRules') {
      const ruleIds = message.ruleIds as string[];
      const enabled = message.enabled as boolean;
      // Each toggle acquires its own per-rule lock. Run them in
      // parallel — the SW is single-threaded but awaits serialize
      // the storage writes; `Promise.all` keeps the net round-trip
      // close to a single toggle's duration.
      Promise.all(ruleIds.map((ruleId) => toggleRule(ruleId, enabled)))
        .then((results) => {
          const touched = results.some((r) => r);
          if (touched) {
            scheduleUpdate('rules', { immediate: true });
            updateBadgeCallback();
          }
          safeResponse({ success: true });
        })
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
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
      const expectedVersion = message.expectedVersion as number | undefined;
      updateTemplate(
        message.templateUid as string,
        message.updates as Partial<Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
        { expectedVersion },
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
      const collection = createTemplateCollection(message.name as string);
      safeResponse({ success: true, collection });
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
      const folder = createTemplateFolder(message.name as string, message.parentPath as string);
      safeResponse({ success: true, folder });
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
      listFiles()
        .then((files) => safeResponse({ files }))
        .catch((err: Error) => safeResponse({ files: [], error: err.message }));
      return true;
    } else if (message.type === 'putFile') {
      const filename = message.filename as string;
      const mimeType = message.mimeType as string | undefined;
      const bytesBase64 = message.bytesBase64 as string;
      const blob = base64ToBlob(bytesBase64, mimeType);
      putFile({ blob, filename, mimeType })
        .then((fileRef) => safeResponse({ success: true, fileRef }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'getFile') {
      const fileId = message.fileId as string;
      getFileBlob(fileId)
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
      deleteFile(fileId)
        .then((removed) => safeResponse({ success: true, removed }))
        .catch((err: Error) => safeResponse({ success: false, removed: false, error: err.message }));
      return true;

      // ── OAuth 2.0 / OIDC (Phase 13) ──────────────────────────────
    } else if (message.type === 'listOAuthTokens') {
      listTokenBundles()
        .then((tokens) => safeResponse({ tokens }))
        .catch((err: Error) => safeResponse({ tokens: {}, error: err.message }));
      return true;
    } else if (message.type === 'oauthAuthorize') {
      const config = message.config as import('@openheaders/core/types').V5.OAuth2Auth;
      launchAuthorizationCodeFlow(config)
        .then((result) => safeResponse({ success: true, bundle: result.bundle, redirectUri: result.redirectUri }))
        .catch((err: Error) => {
          const msg = err instanceof OAuth2FlowError ? `${err.step}: ${err.message}` : err.message;
          safeResponse({ success: false, error: msg });
        });
      return true;
    } else if (message.type === 'oauthClientCredentials') {
      const config = message.config as import('@openheaders/core/types').V5.OAuth2Auth;
      performClientCredentialsFlow(config)
        .then((bundle) => safeResponse({ success: true, bundle }))
        .catch((err: Error) => {
          const msg = err instanceof OAuth2FlowError ? `${err.step}: ${err.message}` : err.message;
          safeResponse({ success: false, error: msg });
        });
      return true;
    } else if (message.type === 'oauthRefresh') {
      const config = message.config as import('@openheaders/core/types').V5.OAuth2Auth;
      performRefresh(config)
        .then((bundle) => safeResponse({ success: true, bundle }))
        .catch((err: Error) => {
          const msg = err instanceof OAuth2FlowError ? `${err.step}: ${err.message}` : err.message;
          safeResponse({ success: false, error: msg });
        });
      return true;
    } else if (message.type === 'oauthRevoke') {
      const credentialRef = message.credentialRef as string;
      deleteTokenBundle(credentialRef)
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
      try {
        const workflow = createLiveWorkflow({
          name: message.name as string,
          description: message.description as string | undefined,
          steps: message.steps as import('@openheaders/core/types').V5.WorkflowStep[] | undefined,
          refresh: message.refresh as import('@openheaders/core/types').V5.RefreshPolicy | undefined,
          enabled: message.enabled as boolean | undefined,
        });
        safeResponse({ success: true, workflow });
      } catch (err) {
        safeResponse({ success: false, error: (err as Error).message });
      }
      return true;
    } else if (message.type === 'updateLiveWorkflow') {
      const req = message as {
        uid: string;
        updates: Partial<
          Omit<import('@openheaders/core/types').V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion' | 'version'>
        >;
        expectedVersion?: number;
      };
      updateLiveWorkflow(req.uid, req.updates, { expectedVersion: req.expectedVersion })
        .then((result) => {
          if (result.ok) {
            safeResponse({ success: true, workflow: result.workflow, version: result.version });
          } else if (result.reason === 'stale-draft') {
            safeResponse({
              success: false,
              reason: 'stale-draft',
              serverVersion: result.serverVersion,
              serverWorkflow: result.serverWorkflow,
            });
          } else {
            safeResponse({ success: false, reason: result.reason });
          }
        })
        .catch((err: Error) => safeResponse({ success: false, reason: 'not-found', error: err.message }));
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
      try {
        const variable = createLiveVariable({
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
      return true;
    } else if (message.type === 'updateLiveVariable') {
      const req = message as {
        uid: string;
        updates: Partial<
          Omit<import('@openheaders/core/types').V5.LiveVariable, 'uid' | 'path' | 'schemaVersion' | 'version'>
        >;
        expectedVersion?: number;
      };
      updateLiveVariable(req.uid, req.updates, { expectedVersion: req.expectedVersion })
        .then((result) => {
          if (result.ok) {
            safeResponse({ success: true, variable: result.variable, version: result.version });
          } else if (result.reason === 'stale-draft') {
            safeResponse({
              success: false,
              reason: 'stale-draft',
              serverVersion: result.serverVersion,
              serverVariable: result.serverVariable,
            });
          } else {
            safeResponse({ success: false, reason: result.reason });
          }
        })
        .catch((err: Error) => safeResponse({ success: false, reason: 'not-found', error: err.message }));
      return true;
    } else if (message.type === 'deleteLiveVariable') {
      deleteLiveVariable(message.uid as string)
        .then((removed) => safeResponse({ success: removed }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
    } else if (message.type === 'setLiveVariableOverride') {
      const req = message as {
        uid: string;
        override: import('@openheaders/core/types').V5.LiveVariableOverride | null;
        expectedVersion?: number;
      };
      setLiveVariableOverride(req.uid, req.override, { expectedVersion: req.expectedVersion })
        .then((result) => {
          if (result.ok) {
            safeResponse({ success: true, variable: result.variable, version: result.version });
          } else if (result.reason === 'stale-draft') {
            safeResponse({
              success: false,
              reason: 'stale-draft',
              serverVersion: result.serverVersion,
              serverVariable: result.serverVariable,
            });
          } else {
            safeResponse({ success: false, reason: result.reason });
          }
        })
        .catch((err: Error) => safeResponse({ success: false, reason: 'not-found', error: err.message }));
      return true;
    } else if (message.type === 'getLiveCacheForWorkflow') {
      listLiveCacheForWorkflow(message.workflowUid as string)
        .then((runs) => safeResponse({ runs }))
        .catch((err: Error) => safeResponse({ runs: [], error: err.message }));
      return true;
    } else if (message.type === 'resetLiveWorkflowCircuit') {
      // "Reset circuit" action from the Workflow Status sidebar.
      // Clears consecutiveFailures + consecutiveOpenings + nextAttemptAt
      // on the target (workflow, env) pair so the next scheduled or
      // manual refresh starts from a clean slate. Does NOT run a probe
      // — the user may want to reset + then navigate elsewhere.
      const req = message as { workflowUid: string; environmentId?: string | null };
      void (async () => {
        const wsId = getActiveWorkspaceId();
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
      const req = message as { workflowUid: string; environmentId?: string | null };
      void (async () => {
        const wsId = getActiveWorkspaceId();
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

      // ── Layout ───────────────────────────────────────────────────
    } else if (message.type === 'setLayout') {
      setPanelLayout(message.layout as import('@/shared/storage').PersistedPanelLayout)
        .then(() => safeResponse({ success: true }))
        .catch((err: Error) => safeResponse({ success: false, error: err.message }));
      return true;
      // ── Sync engine (Phase A) ──────────────────────────────────
    } else if (message.type === 'oh.sync.snapshotRules') {
      safeResponse({ entries: snapshotRulePostStates() });
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
