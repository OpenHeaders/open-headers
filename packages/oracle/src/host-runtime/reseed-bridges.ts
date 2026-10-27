/**
 * Re-point every per-workspace sync engine bridge at the currently-active
 * workspace. Called at boot and by the workspace-coord runner after an
 * active-flip swap.
 *
 * Wiring only — a subscription re-point plus a snapshot pull for every
 * store mirror, flat and singleton alike. The active service's
 * `hydrated` gate (awaited inside `setRuntimeActive`) replayed the
 * workspace's durable log into its oracle and every cache projects
 * that, so this pass appends nothing to any log: a boot and a swap are
 * reads. The seeding `bridgeXSyncEngine` variants remain for the one
 * caller whose store state is fresher than the oracle — the
 * active-workspace import path. The layout cache has no store mirror
 * and needs no wire.
 *
 * Errors are caught per bridge and routed to `onError` (or logged via
 * the core logger as a fallback) so a single bridge failure doesn't
 * collapse the whole pass.
 */

import { logger } from '@openheaders/core/utils';
import {
  wireEnvironmentSyncEngine,
  wireVaultSyncEngine,
  wireWorkspaceVariablesSyncEngine,
} from '../entity/environment-store';
import { wireFilesSyncEngine } from '../entity/files-store';
import { wireOAuthSyncEngine } from '../entity/oauth-token-store';
import { wirePauseMarkersSyncEngine } from '../entity/pause-markers-store';
import {
  wireRequestCollectionSyncEngine,
  wireRequestFolderSyncEngine,
  wireRequestSyncEngine,
} from '../entity/request-store';
import { wireRuleCollectionSyncEngine, wireRuleFolderSyncEngine, wireRuleSyncEngine } from '../entity/rule-store';
import {
  wireTemplateCollectionSyncEngine,
  wireTemplateFolderSyncEngine,
  wireTemplateSyncEngine,
} from '../entity/template-store';
import { wireTrustedRootsSyncEngine } from '../entity/trusted-roots-store';
import { bridgeLiveValueSyncEngine } from '../live/live-value-store';
import { wireLiveVariableSyncEngine } from '../live/live-variable-store';
import { wireLiveWorkflowSyncEngine } from '../live/live-workflow-store';

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
  const wire = (bridge: string, fn: () => void): void => {
    try {
      fn();
    } catch (err) {
      onError(bridge, err);
    }
  };

  wire('wireRuleSyncEngine', wireRuleSyncEngine);
  wire('wireRuleCollectionSyncEngine', wireRuleCollectionSyncEngine);
  wire('wireRuleFolderSyncEngine', wireRuleFolderSyncEngine);
  wire('wireEnvironmentSyncEngine', wireEnvironmentSyncEngine);
  wire('wireWorkspaceVariablesSyncEngine', wireWorkspaceVariablesSyncEngine);
  wire('wireVaultSyncEngine', wireVaultSyncEngine);
  wire('wireTrustedRootsSyncEngine', wireTrustedRootsSyncEngine);
  wire('wireRequestSyncEngine', wireRequestSyncEngine);
  wire('wireRequestCollectionSyncEngine', wireRequestCollectionSyncEngine);
  wire('wireRequestFolderSyncEngine', wireRequestFolderSyncEngine);
  wire('wireTemplateSyncEngine', wireTemplateSyncEngine);
  wire('wireTemplateCollectionSyncEngine', wireTemplateCollectionSyncEngine);
  wire('wireTemplateFolderSyncEngine', wireTemplateFolderSyncEngine);
  wire('wireLiveWorkflowSyncEngine', wireLiveWorkflowSyncEngine);
  wire('wireLiveVariableSyncEngine', wireLiveVariableSyncEngine);
  wire('wireOAuthSyncEngine', wireOAuthSyncEngine);
  wire('wirePauseMarkersSyncEngine', wirePauseMarkersSyncEngine);
  wire('wireFilesSyncEngine', wireFilesSyncEngine);

  // The live-value bridge wires the propagation hooks and folds the
  // oracle's value set into this host's liveCache blob — a host-local
  // write, never a mutation.
  await bridgeLiveValueSyncEngine().catch((err: unknown) => onError('bridgeLiveValueSyncEngine', err));
}
