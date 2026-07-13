/**
 * Re-point every per-workspace sync engine bridge at the currently-active
 * workspace. Called at boot and by the workspace-coord runner after an
 * active-flip swap.
 *
 * Flat + folder-tree mirrors (rules, collections, folders, requests,
 * templates, environments, live workflows/variables) are WIRED only —
 * subscription re-point plus a snapshot pull. The active service's
 * `hydrated` gate (awaited inside `setRuntimeActive`) already seeded
 * those caches from the same per-workspace storage keys the stores
 * hydrate from; seeding again here would re-apply every entity into the
 * live oracle a second time (the workspace-switch double-seed freeze).
 * The seeding `bridgeXSyncEngine` variants remain for callers whose
 * store state is fresher than the oracle — the active-workspace import
 * path.
 *
 * Singleton caches (workspace variables, vault, OAuth, pause markers,
 * layout, files, live values) keep their full bridge: one apply each,
 * and the seed primes a fresh workspace's defaults into the oracle.
 *
 * Errors are caught per bridge and routed to `onError` (or logged via
 * the core logger as a fallback) so a single bridge failure doesn't
 * collapse the whole pass.
 */

import { logger } from '@openheaders/core/utils';
import {
  bridgeVaultSyncEngine,
  bridgeWorkspaceVariablesSyncEngine,
  wireEnvironmentSyncEngine,
} from '../entity/environment-store';
import { bridgeFilesSyncEngine } from '../entity/files-store';
import { bridgeOAuthSyncEngine } from '../entity/oauth-token-store';
import { bridgePauseMarkersSyncEngine } from '../entity/pause-markers-store';
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
import { bridgeLiveValueSyncEngine } from '../live/live-value-store';
import { wireLiveVariableSyncEngine } from '../live/live-variable-store';
import { wireLiveWorkflowSyncEngine } from '../live/live-workflow-store';
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
  wire('wireRequestSyncEngine', wireRequestSyncEngine);
  wire('wireRequestCollectionSyncEngine', wireRequestCollectionSyncEngine);
  wire('wireRequestFolderSyncEngine', wireRequestFolderSyncEngine);
  wire('wireTemplateSyncEngine', wireTemplateSyncEngine);
  wire('wireTemplateCollectionSyncEngine', wireTemplateCollectionSyncEngine);
  wire('wireTemplateFolderSyncEngine', wireTemplateFolderSyncEngine);
  wire('wireLiveWorkflowSyncEngine', wireLiveWorkflowSyncEngine);
  wire('wireLiveVariableSyncEngine', wireLiveVariableSyncEngine);

  await Promise.all([
    bridgeWorkspaceVariablesSyncEngine().catch(catchFor('bridgeWorkspaceVariablesSyncEngine')),
    bridgeVaultSyncEngine().catch(catchFor('bridgeVaultSyncEngine')),
    bridgeLiveValueSyncEngine().catch(catchFor('bridgeLiveValueSyncEngine')),
    bridgeOAuthSyncEngine().catch(catchFor('bridgeOAuthSyncEngine')),
    bridgePauseMarkersSyncEngine().catch(catchFor('bridgePauseMarkersSyncEngine')),
    bridgeLayoutStateSyncEngine().catch(catchFor('bridgeLayoutStateSyncEngine')),
    bridgeFilesSyncEngine().catch(catchFor('bridgeFilesSyncEngine')),
  ]);
}
