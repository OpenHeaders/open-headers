/**
 * In-tab workspace export/import — the web host's answers for the
 * channel family the extension SW and daemon spine already serve, over
 * the same lifted oracle modules. The tab oracle owns the entities the
 * gatherer and the preview differ read, so the read-shaped channels
 * (export, preview, dedup matches, snapshots, script review) answer
 * in-tab.
 *
 * `importWorkspace` REFUSES on this host for now: the orchestrator's
 * post-import reseed applies with `applyOrigin: 'inbound'`, which the
 * outbound mutation plane drops — an import would land in the tab's
 * stores only, never reach the serving daemon, and a later snapshot
 * bootstrap could clobber it. Lifting the import onto ordinary local
 * mutations (core/sync-builders batches per plan entry) is its own
 * slice; until then the honest answer is a clear refusal, not a
 * silently tab-local write.
 *
 * Vault posture: this host has no at-rest cipher — the vault slot
 * reads as absent and refuses writes. Rather than ship a silently
 * empty vault, a vault-inclusive export refuses up front with an
 * honest error; vault-free exports work end to end.
 */

import { detectBrowser, readHostProbe } from '@openheaders/core/utils';
import {
  buildWorkspaceExport,
  serializeWorkspaceExport,
  type WorkspaceExport,
} from '@openheaders/core/workspace-export';
import {
  clearPendingScriptsReview,
  getPendingScriptsReview,
} from '@openheaders/oracle/entity/request-scripts-review-store';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { type ExportGatherScope, gatherWorkspaceExport } from '@openheaders/oracle/workspace/export-gatherer';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { findExportImportMatches } from '@openheaders/oracle/workspace/import-dedup';
import { type ImportWorkspaceArgs, previewWorkspaceImport } from '@openheaders/oracle/workspace/import-orchestrator';
import { getBuildInfo } from '@openheaders/ui/shared/build-info';

const NO_VAULT_EXPORT_ERROR =
  'This surface has no vault storage, so a vault-inclusive export would carry no secrets. ' +
  'Export without the vault here, or export the vault from the app that holds it.';
const NO_VAULT_IMPORT_ERROR =
  'This surface has no vault storage and cannot import vault secrets. ' +
  'Import a vault-free export here, or run this import in the app that will hold the secrets.';
const NO_IMPORT_ERROR =
  'Importing is not yet supported on this surface — the imported entities would not reach the ' +
  'connected backend. Run this import in the app that hosts the workspace.';

const EXPORT_IMPORT_CHANNELS = [
  'exportWorkspace',
  'previewWorkspaceImport',
  'importWorkspace',
  'getLastImportedSnapshots',
  'findWorkspaceExportImportMatches',
  'getRequestScriptsReviewPending',
  'clearRequestScriptsReviewPending',
] as const;

export function isExportImportChannel(type: unknown): type is (typeof EXPORT_IMPORT_CHANNELS)[number] {
  return typeof type === 'string' && (EXPORT_IMPORT_CHANNELS as readonly string[]).includes(type);
}

/** Envelope carries secrets in either form — plaintext vault entries or an encrypted block. */
function carriesVaultSecrets(incoming: WorkspaceExport): boolean {
  return (incoming.entities.vault?.secrets.length ?? 0) > 0 || incoming.secrets !== undefined;
}

function exportPlatform(): 'chrome' | 'firefox' | 'edge' | 'safari' {
  const kind = detectBrowser(readHostProbe(navigator));
  if (kind === 'firefox' || kind === 'edge' || kind === 'safari') return kind;
  return 'chrome';
}

export async function dispatchExportImportRpc(
  type: (typeof EXPORT_IMPORT_CHANNELS)[number],
  message: Record<string, unknown>,
): Promise<unknown> {
  if (type === 'exportWorkspace') {
    const wsId = typeof message.workspaceId === 'string' ? message.workspaceId : getActiveWorkspaceId();
    const scope = message.scope as ExportGatherScope;
    const vaultMode = (message.vaultMode as 'omitted' | 'encrypted' | 'plaintext' | undefined) ?? 'omitted';
    if (vaultMode !== 'omitted') {
      return { success: false, error: NO_VAULT_EXPORT_ERROR };
    }
    try {
      const res = await gatherWorkspaceExport(wsId, scope, {
        app: 'web',
        appVersion: getBuildInfo().version,
        platform: exportPlatform(),
      });
      if (!res) return { success: false, error: 'Workspace or rule not found' };
      const envelope = buildWorkspaceExport(res.input, { vaultMode });
      const yaml = serializeWorkspaceExport(envelope);
      return { success: true, yaml, exportId: envelope.exportId, scope: envelope.scope };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
  if (type === 'previewWorkspaceImport') {
    try {
      const incoming = message.incoming as ImportWorkspaceArgs['incoming'];
      if (carriesVaultSecrets(incoming)) {
        return { success: false, error: NO_VAULT_IMPORT_ERROR };
      }
      const res = await previewWorkspaceImport({
        incoming,
        target: message.target as ImportWorkspaceArgs['target'],
        backupRestore: message.backupRestore as boolean | undefined,
      });
      return {
        success: true,
        diff: res.diff,
        missingDeps: res.missingDeps,
        snapshotHash: res.snapshotHash,
        targetWorkspaceId: res.targetWorkspaceId,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
  if (type === 'importWorkspace') {
    return { success: false, error: NO_IMPORT_ERROR };
  }
  if (type === 'getLastImportedSnapshots') {
    try {
      const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
      const snapshots =
        ((await hostStorage.get(wsKeys(workspaceId).lastImportedSnapshots)) as Record<string, string> | undefined) ??
        {};
      return { snapshots };
    } catch {
      return { snapshots: {} };
    }
  }
  if (type === 'findWorkspaceExportImportMatches') {
    try {
      return await findExportImportMatches({
        exportId: message.exportId as string,
        workspaceUid: message.workspaceUid as string,
        currentTargetWorkspaceId: message.currentTargetWorkspaceId as string | null,
      });
    } catch {
      return { exportIdSameTarget: [], exportIdOtherTargets: [], workspaceUidMatches: [] };
    }
  }
  if (type === 'getRequestScriptsReviewPending') {
    try {
      return { uids: Array.from(getPendingScriptsReview()) };
    } catch {
      return { uids: [] };
    }
  }
  try {
    await clearPendingScriptsReview(message.uid as string);
    return { success: true };
  } catch {
    return { success: false };
  }
}
