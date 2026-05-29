/**
 * Re-seed every per-workspace sync engine bridge for the currently-active
 * workspace. Called at boot and by the workspace-coord runner after an
 * active-flip swap.
 *
 * Sequencing rules baked in:
 *   - folders depend on collections being seeded first;
 *   - request-folders depend on request-collections, which depend on requests;
 *   - templates are seeded depth-first (collections → folders → templates);
 *   - live variables need their workflows.
 * Independent bridge families run in parallel.
 *
 * Errors are caught per bridge and routed to `onError` (or logged via
 * the core logger as a fallback) so a single bridge failure doesn't
 * collapse the whole re-seed.
 */

import { logger } from '@openheaders/core/utils';
import {
  bridgeEnvironmentSyncEngine,
  bridgeVaultSyncEngine,
  bridgeWorkspaceVariablesSyncEngine,
} from '../entity/environment-store';
import { bridgeFilesSyncEngine } from '../entity/files-store';
import { bridgeOAuthSyncEngine } from '../entity/oauth-token-store';
import { bridgePauseMarkersSyncEngine } from '../entity/pause-markers-store';
import {
  bridgeRequestCollectionSyncEngine,
  bridgeRequestFolderSyncEngine,
  bridgeRequestSyncEngine,
} from '../entity/request-store';
import {
  bridgeCollectionSyncEngine,
  bridgeFolderSyncEngine,
  bridgeToSyncEngine,
} from '../entity/rule-store';
import {
  bridgeTemplateCollectionSyncEngine,
  bridgeTemplateFolderSyncEngine,
  bridgeTemplateSyncEngine,
} from '../entity/template-store';
import { bridgeLiveValueSyncEngine } from '../live/live-value-store';
import {
  bridgeLiveVariableSyncEngine,
} from '../live/live-variable-store';
import { bridgeLiveWorkflowSyncEngine } from '../live/live-workflow-store';
import { bridgeLayoutStateSyncEngine } from './../workspace/layout-store';

export interface ReseedOptions {
  /** Called once per failed bridge with the bridge name + the error. */
  onError?: (bridge: string, err: unknown) => void;
}

export async function reseedAllPerWorkspaceBridges(opts: ReseedOptions = {}): Promise<void> {
  const onError =
    opts.onError ??
    ((bridge: string, err: unknown) => {
      logger.warn('HostRuntime', `${bridge} after workspace switch failed`, err);
    });
  const catchFor = (bridge: string) => (err: unknown) => onError(bridge, err);

  await Promise.all([
    bridgeToSyncEngine().catch(catchFor('bridgeToSyncEngine')),
    bridgeEnvironmentSyncEngine().catch(catchFor('bridgeEnvironmentSyncEngine')),
    bridgeCollectionSyncEngine().then(bridgeFolderSyncEngine).catch(catchFor('bridgeCollectionSyncEngine/Folder')),
    bridgeWorkspaceVariablesSyncEngine().catch(catchFor('bridgeWorkspaceVariablesSyncEngine')),
    bridgeVaultSyncEngine().catch(catchFor('bridgeVaultSyncEngine')),
    bridgeRequestSyncEngine()
      .then(bridgeRequestCollectionSyncEngine)
      .then(bridgeRequestFolderSyncEngine)
      .catch(catchFor('bridgeRequest/RequestCollection/RequestFolder')),
    bridgeTemplateCollectionSyncEngine()
      .then(bridgeTemplateFolderSyncEngine)
      .then(bridgeTemplateSyncEngine)
      .catch(catchFor('bridgeTemplate/Collection/Folder')),
    bridgeLiveWorkflowSyncEngine().then(bridgeLiveVariableSyncEngine).catch(catchFor('bridgeLiveWorkflow/LiveVariable')),
    bridgeLiveValueSyncEngine().catch(catchFor('bridgeLiveValueSyncEngine')),
    bridgeOAuthSyncEngine().catch(catchFor('bridgeOAuthSyncEngine')),
    bridgePauseMarkersSyncEngine().catch(catchFor('bridgePauseMarkersSyncEngine')),
    bridgeLayoutStateSyncEngine().catch(catchFor('bridgeLayoutStateSyncEngine')),
    bridgeFilesSyncEngine().catch(catchFor('bridgeFilesSyncEngine')),
  ]);
}
