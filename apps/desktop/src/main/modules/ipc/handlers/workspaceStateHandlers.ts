/**
 * IPC handlers for WorkspaceStateService.
 *
 * All workspace state mutations flow through these handlers.
 * The renderer calls ipcRenderer.invoke() and receives results.
 */

import type { Collection, EnvironmentVariable, Folder, HeaderRule, Source, SourceUpdate } from '@openheaders/core';

import { errorMessage } from '@openheaders/core';
import { ipcMain } from 'electron';
import workspaceStateService from '@/services/workspace/WorkspaceStateService';
import type { ProxyRule } from '@/types/proxy';
import type { Workspace, WorkspaceType } from '@/types/workspace';
import mainLogger from '@/utils/mainLogger';

const { createLogger } = mainLogger;
const log = createLogger('WorkspaceStateHandlers');

export function registerWorkspaceStateHandlers(): void {
  // ── State access ──────────────────────────────────────────────

  ipcMain.handle('workspace-state:initialize', async () => {
    try {
      if (!workspaceStateService.getState().initialized) {
        await workspaceStateService.initialize();
      }
      return { success: true, state: workspaceStateService.getState() };
    } catch (error) {
      log.error('Initialize failed:', error);
      return { success: false, error: errorMessage(error), state: workspaceStateService.getState() };
    }
  });

  ipcMain.handle('workspace-state:get-state', () => {
    return workspaceStateService.getState();
  });

  // ── Workspace switching ───────────────────────────────────────

  ipcMain.handle('workspace-state:switch-workspace', async (_event, workspaceId: string) => {
    try {
      await workspaceStateService.switchWorkspace(workspaceId);
      return { success: true };
    } catch (error) {
      log.error('Switch workspace failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Source CRUD ────────────────────────────────────────────────

  ipcMain.handle('workspace-state:add-source', async (_event, sourceData: Source) => {
    try {
      const source = await workspaceStateService.addSource(sourceData);
      return { success: true, source };
    } catch (error) {
      log.error('Add source failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:update-source', async (_event, sourceId: string, updates: SourceUpdate) => {
    try {
      const source = await workspaceStateService.updateSource(sourceId, updates);
      return { success: true, source };
    } catch (error) {
      log.error('Update source failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:remove-source', async (_event, sourceId: string) => {
    try {
      await workspaceStateService.removeSource(sourceId);
      return { success: true };
    } catch (error) {
      log.error('Remove source failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:update-source-content', async (_event, sourceId: string, content: string) => {
    try {
      await workspaceStateService.updateSourceContent(sourceId, content);
      return { success: true };
    } catch (error) {
      log.error('Update source content failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:refresh-source', async (_event, sourceId: string) => {
    try {
      const result = await workspaceStateService.refreshSource(sourceId);
      return { success: result };
    } catch (error) {
      log.error('Refresh source failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:import-sources', async (_event, sources: Source[], replace: boolean) => {
    try {
      await workspaceStateService.importSources(sources, replace);
      return { success: true };
    } catch (error) {
      log.error('Import sources failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Header Rule CRUD ──────────────────────────────────────────

  ipcMain.handle('workspace-state:add-header-rule', async (_event, ruleData: Partial<HeaderRule>) => {
    try {
      const rule = await workspaceStateService.addHeaderRule(ruleData);
      return { success: true, rule };
    } catch (error) {
      log.error('Add header rule failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:update-header-rule', async (_event, ruleId: string, updates: Partial<HeaderRule>) => {
    try {
      await workspaceStateService.updateHeaderRule(ruleId, updates);
      return { success: true };
    } catch (error) {
      log.error('Update header rule failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:remove-header-rule', async (_event, ruleId: string) => {
    try {
      await workspaceStateService.removeHeaderRule(ruleId);
      return { success: true };
    } catch (error) {
      log.error('Remove header rule failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Proxy Rule CRUD ───────────────────────────────────────────

  ipcMain.handle('workspace-state:add-proxy-rule', async (_event, ruleData: ProxyRule) => {
    try {
      await workspaceStateService.addProxyRule(ruleData);
      return { success: true };
    } catch (error) {
      log.error('Add proxy rule failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:remove-proxy-rule', async (_event, ruleId: string) => {
    try {
      await workspaceStateService.removeProxyRule(ruleId);
      return { success: true };
    } catch (error) {
      log.error('Remove proxy rule failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Collection CRUD ────────────────────────────────────────────

  ipcMain.handle('workspace-state:add-collection', async (_event, data: Omit<Collection, 'id'>) => {
    try {
      const collection = await workspaceStateService.addCollection(data);
      return { success: true, collection };
    } catch (error) {
      log.error('Add collection failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    'workspace-state:update-collection',
    async (_event, collectionId: string, updates: Partial<Collection>) => {
      try {
        await workspaceStateService.updateCollection(collectionId, updates);
        return { success: true };
      } catch (error) {
        log.error('Update collection failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle('workspace-state:remove-collection', async (_event, collectionId: string) => {
    try {
      await workspaceStateService.removeCollection(collectionId);
      return { success: true };
    } catch (error) {
      log.error('Remove collection failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Folder CRUD ───────────────────────────────────────────────

  ipcMain.handle('workspace-state:add-folder', async (_event, folderData: Omit<Folder, 'id'>) => {
    try {
      const folder = await workspaceStateService.addFolder(folderData);
      return { success: true, folder };
    } catch (error) {
      log.error('Add folder failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:update-folder', async (_event, folderId: string, updates: Partial<Folder>) => {
    try {
      await workspaceStateService.updateFolder(folderId, updates);
      return { success: true };
    } catch (error) {
      log.error('Update folder failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:remove-folder', async (_event, folderId: string) => {
    try {
      await workspaceStateService.removeFolder(folderId);
      return { success: true };
    } catch (error) {
      log.error('Remove folder failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Workspace CRUD ────────────────────────────────────────────

  ipcMain.handle(
    'workspace-state:create-workspace',
    async (_event, workspace: Partial<Workspace> & { id: string; name: string; type: WorkspaceType }) => {
      try {
        const created = await workspaceStateService.createWorkspace(workspace);
        return { success: true, workspace: created };
      } catch (error) {
        log.error('Create workspace failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'workspace-state:update-workspace',
    async (_event, workspaceId: string, updates: Partial<Workspace>) => {
      try {
        await workspaceStateService.updateWorkspace(workspaceId, updates);
        return { success: true };
      } catch (error) {
        log.error('Update workspace failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle('workspace-state:delete-workspace', async (_event, workspaceId: string) => {
    try {
      await workspaceStateService.deleteWorkspace(workspaceId);
      return { success: true };
    } catch (error) {
      log.error('Delete workspace failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    'workspace-state:copy-workspace-data',
    async (_event, sourceWorkspaceId: string, targetWorkspaceId: string) => {
      try {
        await workspaceStateService.copyWorkspaceData(sourceWorkspaceId, targetWorkspaceId);
        return { success: true };
      } catch (error) {
        log.error('Copy workspace data failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle('workspace-state:sync-workspace', async (_event, workspaceId: string) => {
    try {
      const result = await workspaceStateService.syncWorkspace(workspaceId);
      return result;
    } catch (error) {
      log.error('Sync workspace failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Environment CRUD ───────────────────────────────────────────

  ipcMain.handle('workspace-state:get-environment-state', () => {
    return workspaceStateService.getEnvironmentState();
  });

  ipcMain.handle(
    'workspace-state:create-environment',
    async (_event, params: { name: string; collectionId?: string; folderId?: string }) => {
      try {
        const env = await workspaceStateService.createEnvironment(params);
        return { success: true, environment: env };
      } catch (error) {
        log.error('Create environment failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'workspace-state:update-environment',
    async (
      _event,
      environmentId: string,
      updates: { name?: string; variables?: Record<string, EnvironmentVariable> },
    ) => {
      try {
        await workspaceStateService.updateEnvironment(environmentId, updates);
        return { success: true };
      } catch (error) {
        log.error('Update environment failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle('workspace-state:delete-environment', async (_event, environmentId: string) => {
    try {
      await workspaceStateService.deleteEnvironment(environmentId);
      return { success: true };
    } catch (error) {
      log.error('Delete environment failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:switch-environment', async (_event, environmentId: string | null) => {
    try {
      await workspaceStateService.switchEnvironment(environmentId);
      return { success: true };
    } catch (error) {
      log.error('Switch environment failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    'workspace-state:set-variable',
    async (_event, name: string, value: string | null, environmentId: string, isSensitive: boolean) => {
      try {
        await workspaceStateService.setVariable(name, value, environmentId, isSensitive);
        return { success: true };
      } catch (error) {
        log.error('Set variable failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'workspace-state:batch-set-variables',
    async (
      _event,
      environmentId: string,
      variables: Array<{ name: string; value: string | null; isSensitive?: boolean }>,
    ) => {
      try {
        await workspaceStateService.batchSetVariables(environmentId, variables);
        return { success: true };
      } catch (error) {
        log.error('Batch set variables failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  // ── Workspace Variables ────────────────────────────────────────

  ipcMain.handle(
    'workspace-state:update-workspace-variables',
    async (_event, variables: Record<string, EnvironmentVariable>) => {
      try {
        await workspaceStateService.updateWorkspaceVariables(variables);
        return { success: true };
      } catch (error) {
        log.error('Update workspace variables failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  log.info('Workspace state IPC handlers registered');
}
