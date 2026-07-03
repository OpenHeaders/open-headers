/** Workspace export, import, and script-review RPCs. */

import {
  buildWorkspaceExport,
  type EncryptVaultBlockResult,
  encryptVaultBlock,
  serializeWorkspaceExport,
} from '@openheaders/core/workspace-export';
import {
  clearPendingScriptsReview,
  getPendingScriptsReview,
} from '@openheaders/oracle/entity/request-scripts-review-store';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { runtime as browserRuntime, isChrome, isEdge, isFirefox, isSafari } from '@utils/browser-api';
import { gatherWorkspaceExport } from '../../workspace/workspace-export-gatherer';
import { findExportImportMatches } from '../../workspace/workspace-import-dedup';
import {
  importWorkspace as importWorkspaceFromExport,
  previewWorkspaceImport,
} from '../../workspace/workspace-import-orchestrator';
import { getActiveWorkspaceId } from '../../workspace/workspace-store';
import type { HandlerMap } from '../types';

export const exportImportHandlers: HandlerMap = {
  exportWorkspace: ({ message, respond }) => {
    // scope = 'workspace' (full workspace) or 'selection' (per-type uid lists,
    // collections/folders auto-expanded by the gatherer).
    // PR 4: vaultMode = 'omitted' (default) | 'encrypted' | 'plaintext'.
    const wsId = (message.workspaceId as string | undefined) ?? getActiveWorkspaceId();
    const scope = message.scope as Parameters<typeof gatherWorkspaceExport>[1];
    const vaultMode = (message.vaultMode as 'omitted' | 'encrypted' | 'plaintext' | undefined) ?? 'omitted';
    const passphrase = message.passphrase as string | undefined;
    const passphraseHint = message.passphraseHint as string | undefined;
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
          respond({ success: false, error: 'Workspace or rule not found' });
          return;
        }
        let secretsBlock: EncryptVaultBlockResult | undefined;
        if (vaultMode === 'encrypted') {
          if (!passphrase) {
            respond({ success: false, error: 'Encrypted vault export requires a passphrase' });
            return;
          }
          const vaultSecrets = res.input.entities.vault?.secrets ?? [];
          secretsBlock = await encryptVaultBlock(vaultSecrets, passphrase, {
            ...(passphraseHint ? { hint: passphraseHint } : {}),
          });
        }
        const envelope = buildWorkspaceExport(res.input, {
          vaultMode,
          ...(secretsBlock ? { secretsBlock: secretsBlock.block } : {}),
        });
        const yaml = serializeWorkspaceExport(envelope);
        respond({
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
        respond({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  },

  previewWorkspaceImport: ({ message, respond }) => {
    previewWorkspaceImport({
      incoming: message.incoming as Parameters<typeof previewWorkspaceImport>[0]['incoming'],
      target: message.target as Parameters<typeof previewWorkspaceImport>[0]['target'],
      backupRestore: message.backupRestore as boolean | undefined,
    })
      .then((res) =>
        respond({
          success: true,
          diff: res.diff,
          missingDeps: res.missingDeps,
          snapshotHash: res.snapshotHash,
          targetWorkspaceId: res.targetWorkspaceId,
        }),
      )
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  findWorkspaceExportImportMatches: ({ message, respond }) => {
    findExportImportMatches({
      exportId: message.exportId as string,
      workspaceUid: message.workspaceUid as string,
      currentTargetWorkspaceId: message.currentTargetWorkspaceId as string | null,
    })
      .then((res) => respond(res))
      .catch(() => respond({ exportIdSameTarget: [], exportIdOtherTargets: [], workspaceUidMatches: [] }));
    return true;
  },

  getRequestScriptsReviewPending: ({ respond }) => {
    try {
      respond({ uids: Array.from(getPendingScriptsReview()) });
    } catch {
      respond({ uids: [] });
    }
    return true;
  },

  clearRequestScriptsReviewPending: ({ message, respond }) => {
    clearPendingScriptsReview(message.uid as string)
      .then(() => respond({ success: true }))
      .catch(() => respond({ success: false }));
    return true;
  },

  getLastImportedSnapshots: ({ message, respond }) => {
    const workspaceId = message.workspaceId as string;
    void (async () => {
      try {
        const snapshots =
          ((await hostStorage.get(wsKeys(workspaceId).lastImportedSnapshots)) as Record<string, string> | undefined) ??
          {};
        respond({ snapshots });
      } catch {
        respond({ snapshots: {} });
      }
    })();
    return true;
  },

  importWorkspace: ({ message, respond }) => {
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
      .then((res) => respond({ success: true, report: res.report, targetWorkspaceId: res.targetWorkspaceId }))
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },
};
