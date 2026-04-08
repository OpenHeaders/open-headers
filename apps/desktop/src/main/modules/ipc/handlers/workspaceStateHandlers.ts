/**
 * IPC handlers for WorkspaceStateService.
 *
 * All workspace state mutations flow through these handlers.
 * The renderer calls ipcRenderer.invoke() and receives results.
 */

import type { V5 } from '@openheaders/core/types';
import { errorMessage } from '@openheaders/core';
import { ipcMain } from 'electron';
import workspaceStateService from '@/services/workspace/WorkspaceStateService';
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

  // ── Collection CRUD ───────────────────────────────────────────

  ipcMain.handle(
    'workspace-state:add-collection',
    async (_event, section: V5.WorkspaceSection, data: Omit<V5.Collection, 'uid' | 'path'>) => {
      try {
        const collection = await workspaceStateService.addCollection(section, data);
        return { success: true, collection };
      } catch (error) {
        log.error('Add collection failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'workspace-state:update-collection',
    async (_event, section: V5.WorkspaceSection, uid: string, updates: Partial<V5.Collection>) => {
      try {
        await workspaceStateService.updateCollection(section, uid, updates);
        return { success: true };
      } catch (error) {
        log.error('Update collection failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle('workspace-state:remove-collection', async (_event, section: V5.WorkspaceSection, uid: string) => {
    try {
      await workspaceStateService.removeCollection(section, uid);
      return { success: true };
    } catch (error) {
      log.error('Remove collection failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Workspace CRUD ────────────────────────────────────────────

  ipcMain.handle(
    'workspace-state:create-workspace',
    async (_event, name: string, type: WorkspaceType, options?: { description?: string; gitUrl?: string }) => {
      try {
        const created = await workspaceStateService.createWorkspace(name, type, options);
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

  // ── Environment CRUD ───────────────────────────────────────────

  ipcMain.handle('workspace-state:create-environment', async (_event, name: string) => {
    try {
      const env = await workspaceStateService.createEnvironment(name);
      return { success: true, environment: env };
    } catch (error) {
      log.error('Create environment failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:delete-environment', async (_event, name: string) => {
    try {
      await workspaceStateService.deleteEnvironment(name);
      return { success: true };
    } catch (error) {
      log.error('Delete environment failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:switch-environment', async (_event, name: string | null) => {
    try {
      await workspaceStateService.switchEnvironment(name);
      return { success: true };
    } catch (error) {
      log.error('Switch environment failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    'workspace-state:set-variable',
    async (_event, envName: string, varName: string, value: string, type: 'default' | 'secret') => {
      try {
        await workspaceStateService.setVariable(envName, varName, value, type);
        return { success: true };
      } catch (error) {
        log.error('Set variable failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'workspace-state:update-environment',
    async (_event, oldName: string, updates: { name?: string; variables?: V5.Variable[] }) => {
      try {
        await workspaceStateService.updateEnvironment(oldName, updates);
        return { success: true };
      } catch (error) {
        log.error('Update environment failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  // ── Request CRUD ───────────────────────────────────────────────

  ipcMain.handle('workspace-state:get-request', async (_event, uid: string) => {
    try {
      const request = await workspaceStateService.getRequest(uid);
      return { success: true, request };
    } catch (error) {
      log.error('Get request failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    'workspace-state:add-request',
    async (_event, collectionUid: string, request: Omit<V5.Request, 'uid' | 'path'>) => {
      try {
        const created = await workspaceStateService.addRequest(collectionUid, request);
        return { success: true, request: created };
      } catch (error) {
        log.error('Add request failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'workspace-state:update-request',
    async (_event, uid: string, updates: Partial<V5.Request>) => {
      try {
        await workspaceStateService.updateRequest(uid, updates);
        return { success: true };
      } catch (error) {
        log.error('Update request failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle('workspace-state:remove-request', async (_event, uid: string) => {
    try {
      await workspaceStateService.removeRequest(uid);
      return { success: true };
    } catch (error) {
      log.error('Remove request failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Rule CRUD ──────────────────────────────────────────────────

  ipcMain.handle(
    'workspace-state:add-rule',
    async (_event, collectionUid: string, rule: Omit<V5.Rule, 'uid' | 'path'>) => {
      try {
        const created = await workspaceStateService.addRule(collectionUid, rule);
        return { success: true, rule: created };
      } catch (error) {
        log.error('Add rule failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'workspace-state:update-rule',
    async (_event, uid: string, updates: Partial<V5.Rule>) => {
      try {
        await workspaceStateService.updateRule(uid, updates);
        return { success: true };
      } catch (error) {
        log.error('Update rule failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle('workspace-state:remove-rule', async (_event, uid: string) => {
    try {
      await workspaceStateService.removeRule(uid);
      return { success: true };
    } catch (error) {
      log.error('Remove rule failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle('workspace-state:toggle-rule', async (_event, uid: string, enabled: boolean) => {
    try {
      await workspaceStateService.toggleRule(uid, enabled);
      return { success: true };
    } catch (error) {
      log.error('Toggle rule failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Folder CRUD ────────────────────────────────────────────────

  ipcMain.handle(
    'workspace-state:add-folder',
    async (_event, collectionUid: string, section: V5.WorkspaceSection, name: string, parentPath?: string) => {
      try {
        const folder = await workspaceStateService.addFolder(collectionUid, section, name, parentPath);
        return { success: true, folder };
      } catch (error) {
        log.error('Add folder failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'workspace-state:rename-folder',
    async (_event, section: V5.WorkspaceSection, uid: string, newName: string) => {
      try {
        await workspaceStateService.renameFolder(section, uid, newName);
        return { success: true };
      } catch (error) {
        log.error('Rename folder failed:', error);
        return { success: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle('workspace-state:remove-folder', async (_event, section: V5.WorkspaceSection, uid: string) => {
    try {
      await workspaceStateService.removeFolder(section, uid);
      return { success: true };
    } catch (error) {
      log.error('Remove folder failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // ── Workspace variables ────────────────────────────────────────

  ipcMain.handle('workspace-state:update-workspace-variables', async (_event, variables: V5.WorkspaceVariables) => {
    try {
      await workspaceStateService.updateWorkspaceVariables(variables);
      return { success: true };
    } catch (error) {
      log.error('Update workspace variables failed:', error);
      return { success: false, error: errorMessage(error) };
    }
  });

  log.info('Workspace state IPC handlers registered');
}
