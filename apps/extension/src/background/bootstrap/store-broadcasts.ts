import { ensureWorkspaceRoleAssignments, refreshIdentitySnapshotFromHostStorage } from '@openheaders/core/identity';
import { invalidateAllWorkspaceOrgCache } from '@openheaders/core/sync';
import type { TreeNode } from '@openheaders/core/types';
import {
  getActiveEnvironmentId,
  getCollectionEnvOverrides,
  getDefaultEnvironmentId,
  getEnvironments,
  getManualEnvId,
  getVault,
  getWorkspaceVariables,
  isVaultLocked,
  onEnvironmentStoreChange,
} from '@openheaders/oracle/entity/environment-store';
import { listFiles, onFilesStoreChange } from '@openheaders/oracle/entity/files-store';
import { getRequests, onRequestStoreChange } from '@openheaders/oracle/entity/request-store';
import { getCollectionTrees, getRules, onStoreChange } from '@openheaders/oracle/entity/rule-store';
import { getTemplates, onTemplateStoreChange } from '@openheaders/oracle/entity/template-store';
import { onLiveCacheStoreChange } from '@openheaders/oracle/live/live-cache-store';
import { getLiveVariables, onLiveVariableStoreChange } from '@openheaders/oracle/live/live-variable-store';
import { getLiveWorkflows, onLiveWorkflowStoreChange } from '@openheaders/oracle/live/live-workflow-store';
import { pruneOrphanOwners } from '@openheaders/oracle/test-run/test-run-store';
import { broadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { scheduleUpdate } from '../modules/rule-engine';
import { getActiveWorkspaceId, listWorkspaces, onWorkspaceStoreChange } from '../modules/workspace-store';

interface InstallStoreBroadcastsOpts {
  refreshFanOut: () => void;
  tryAdoptPendingWorkspace: () => void;
}

function pruneOrphanTestRunOwnersFromStore(): void {
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

export function installStoreBroadcasts({ refreshFanOut, tryAdoptPendingWorkspace }: InstallStoreBroadcastsOpts): void {
  onStoreChange(() => {
    broadcast('rulesUpdated', { rules: getRules() });
    pruneOrphanTestRunOwnersFromStore();
  });

  onTemplateStoreChange(() => {
    broadcast('templatesUpdated', { templates: getTemplates() });
  });

  onRequestStoreChange(() => {
    broadcast('requestsUpdated', { requests: getRequests() });
  });

  onWorkspaceStoreChange(() => {
    broadcast('workspaceChanged', {
      workspaces: listWorkspaces(),
      activeWorkspaceId: getActiveWorkspaceId(),
    });
    void ensureWorkspaceRoleAssignments(listWorkspaces().map((w) => w.id))
      .then(() => refreshIdentitySnapshotFromHostStorage())
      .catch((err: unknown) => {
        logger.warn('Background', 'ensureWorkspaceRoleAssignments reconcile failed', err);
      });
    invalidateAllWorkspaceOrgCache();
    tryAdoptPendingWorkspace();
    refreshFanOut();
  });

  onEnvironmentStoreChange(() => {
    scheduleUpdate('vars', { immediate: true });
    broadcast('environmentsChanged', {
      environments: getEnvironments(),
      activeEnvironmentId: getActiveEnvironmentId(),
      defaultEnvironmentId: getDefaultEnvironmentId(),
      workspaceVariables: getWorkspaceVariables(),
      vault: getVault(),
      vaultLocked: isVaultLocked(),
      collectionEnvOverrides: getCollectionEnvOverrides(),
      manualEnvId: getManualEnvId(),
    });
  });

  onFilesStoreChange(() => {
    void (async () => {
      const files = await listFiles().catch(() => []);
      broadcast('filesChanged', { files });
    })();
  });

  onLiveWorkflowStoreChange(() => {
    broadcast('liveWorkflowsChanged', { workflows: getLiveWorkflows() });
  });

  onLiveVariableStoreChange(() => {
    scheduleUpdate('live-vars', { immediate: true });
    broadcast('liveVariablesChanged', { variables: getLiveVariables() });
  });

  onLiveCacheStoreChange((_workspaceId, workflowUid, _runs) => {
    scheduleUpdate('live-cache', { immediate: true });
    broadcast('liveCacheChanged', { workflowUid });
  });
}
