/**
 * Eager initialization of every renderer-side entity mirror for the
 * runtime-Active workspace.
 *
 * The renderer mirror layer is the symmetric counterpart to the SW's
 * per-workspace cache layer (`apps/extension/src/background/sync/service.ts`'s
 * `services: Map<workspaceId, WorkspaceServiceState>`, commit 1 sub-commit
 * 1a). Per-workspace mirrors are lazily instantiated on first
 * `getXSyncMirrorForWorkspace(workspaceId)` call (commit 2 — replaced
 * the pre-MWPT-FULL `let active` singleton with a workspace-keyed map).
 *
 * Lazy-on-first-write opens two races on the runtime-Active workspace:
 *
 *   1. **Subscription lifetime.** A write that fires before the
 *      mirror is created drops the post-commit broadcast (no
 *      listener attached). The snapshot RPC can recover state from
 *      storage but won't deliver broadcasts the surface never heard.
 *
 *   2. **First-write timing.** The snapshot RPC is async. A synchronous
 *      `mirror.get(uid)` immediately after creation returns null until
 *      the snapshot resolves. Write clients that gate on
 *      `getXMirror(uid)` for "entity exists" checks falsely report
 *      `not-found`.
 *
 * `eagerInitRendererMirrors` resolves the runtime-Active workspaceId
 * via `popupOpen`, then forces every per-workspace mirror to
 * instantiate for that workspace, opening each broadcast subscription
 * synchronously (`hostBridge.subscribe('syncBroadcast', …)` in the shared cores
 * fires before `void config.fetchSnapshot(…)`) and kicks off every
 * snapshot RPC in parallel. By the time the user's first gesture
 * lands, every mirror for the runtime-Active workspace has subscribed
 * and its snapshot has completed.
 *
 * Diverged workbench tabs (per-tab editing scope bound to a workspace
 * ≠ runtime-Active) instantiate their workspace's mirrors on first
 * read — the bridge subscription for THAT workspace opens before the
 * tab issues its first write, so the same race-free property holds
 * per-workspace.
 *
 * Idempotent — every `getXSyncMirrorForWorkspace(id)` returns the
 * existing mirror on subsequent calls. Safe to invoke multiple times
 * within a surface's lifetime (e.g. once at module load + once at
 * React tree mount) without doubling up subscriptions.
 *
 * Read-only surfaces (e.g. sidepanel today) don't need this — they
 * never call write-clients and never hit the lazy-init race.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { hostLogger as logger } from '@openheaders/core/logger';
import { getActiveAwarenessMirror } from './awareness-mirror';
import { getCollectionSyncMirrorForWorkspace } from './collection-sync-mirror';
import { getEnvSyncMirrorForWorkspace } from './env-sync-mirror';
import { getActiveExtensionWorkspaceSyncMirror } from './extension-workspace-sync-mirror';
import { getFilesSyncMirrorForWorkspace } from './files-sync-mirror';
import { getFolderSyncMirrorForWorkspace } from './folder-sync-mirror';
import { getLayoutStateSyncMirrorForWorkspace } from './layout-state-sync-mirror';
import { getLiveVariableSyncMirrorForWorkspace } from './live-variable-sync-mirror';
import { getLiveWorkflowSyncMirrorForWorkspace } from './live-workflow-sync-mirror';
import { getPauseMarkersSyncMirrorForWorkspace } from './pause-markers-sync-mirror';
import { getRequestCollectionSyncMirrorForWorkspace } from './request-collection-sync-mirror';
import { getRequestFolderSyncMirrorForWorkspace } from './request-folder-sync-mirror';
import { getRequestSyncMirrorForWorkspace } from './request-sync-mirror';
import { getRuleSyncMirrorForWorkspace } from './rule-sync-mirror';
import { getTemplateCollectionSyncMirrorForWorkspace } from './template-collection-sync-mirror';
import { getTemplateFolderSyncMirrorForWorkspace } from './template-folder-sync-mirror';
import { getTemplateSyncMirrorForWorkspace } from './template-sync-mirror';
import { getVaultSyncMirrorForWorkspace } from './vault-sync-mirror';
import { getWorkspaceVariablesSyncMirrorForWorkspace } from './workspace-variables-sync-mirror';

/**
 * Pre-instantiate every per-workspace mirror for the given workspace.
 * Order is irrelevant — every getter is independent. Listed
 * alphabetically so a missing entry is obvious in code review.
 */
function instantiateMirrorsForWorkspace(workspaceId: string): void {
  getCollectionSyncMirrorForWorkspace(workspaceId);
  getEnvSyncMirrorForWorkspace(workspaceId);
  getFilesSyncMirrorForWorkspace(workspaceId);
  getFolderSyncMirrorForWorkspace(workspaceId);
  getLayoutStateSyncMirrorForWorkspace(workspaceId);
  getLiveVariableSyncMirrorForWorkspace(workspaceId);
  getLiveWorkflowSyncMirrorForWorkspace(workspaceId);
  getPauseMarkersSyncMirrorForWorkspace(workspaceId);
  getRequestCollectionSyncMirrorForWorkspace(workspaceId);
  getRequestFolderSyncMirrorForWorkspace(workspaceId);
  getRequestSyncMirrorForWorkspace(workspaceId);
  getRuleSyncMirrorForWorkspace(workspaceId);
  getTemplateCollectionSyncMirrorForWorkspace(workspaceId);
  getTemplateFolderSyncMirrorForWorkspace(workspaceId);
  getTemplateSyncMirrorForWorkspace(workspaceId);
  getVaultSyncMirrorForWorkspace(workspaceId);
  getWorkspaceVariablesSyncMirrorForWorkspace(workspaceId);
}

/**
 * Fire-and-forget eager-init. Awareness and the global extension-workspace
 * mirror instantiate synchronously (no workspace dependency); the
 * per-workspace mirrors are seeded once the host's
 * `getActiveWorkspaceId` capability resolves. Surfaces that import this
 * never need to await — the returned mirror lookups remain race-free
 * for the runtime-Active workspace via the synchronous `subscribe`
 * ordering in the shared mirror cores.
 *
 * Hosts that don't register `getActiveWorkspaceId` (a stripped-down
 * shell, a test harness, …) skip the per-workspace seed cleanly; only
 * the workspace-independent mirrors come up. Lazy instantiation on
 * first read still works.
 */
export function eagerInitRendererMirrors(): void {
  // Workspace-independent mirrors — synchronous.
  getActiveAwarenessMirror();
  getActiveExtensionWorkspaceSyncMirror();

  // Per-workspace mirrors — bind to the runtime-Active workspace as
  // soon as the capability resolves. Surfaces that diverge (workbench
  // per-tab editing scope) lazily instantiate their workspace's
  // mirrors on first read; the same race-free property holds because
  // the per-mirror subscription opens synchronously in the core.
  const probe = getCapability('getActiveWorkspaceId');
  if (!probe) return;
  probe()
    .then((resp) => {
      const id = resp.activeWorkspaceId;
      if (!id) return;
      instantiateMirrorsForWorkspace(id);
    })
    .catch((err: Error) => {
      logger.info('eagerInitRendererMirrors', `getActiveWorkspaceId failed: ${err.message}`);
    });
}
