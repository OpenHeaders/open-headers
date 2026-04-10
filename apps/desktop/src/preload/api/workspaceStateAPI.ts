/**
 * Preload API for WorkspaceStateService.
 *
 * Exposes typed IPC methods on window.electronAPI.workspaceState.
 * The renderer hydrates from main on window open, then receives
 * incremental state patches via IPC events.
 */

import type { V5 } from '@openheaders/core/types';
import { ipcRenderer } from 'electron';
import type { WorkspaceState } from '@/services/workspace/WorkspaceStateService';
import type { Workspace, WorkspaceType } from '@/types/workspace';

export interface WorkspaceStatePatch {
  requestCollections?: V5.CollectionTree[];
  ruleCollections?: V5.CollectionTree[];
  rules?: V5.Rule[];
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  syncStatus?: Record<string, unknown>;
  loading?: boolean;
  error?: string | null;
  initialized?: boolean;
  isWorkspaceSwitching?: boolean;
  environments?: V5.Environment[];
  activeEnvironmentName?: string | null;
  workspaceVariables?: V5.WorkspaceVariables;
  vault?: V5.Vault;
}

export interface SwitchProgress {
  step: string;
  progress: number;
  label: string;
  isGitOperation: boolean;
  targetWorkspace?: { id: string; name: string; type: string };
}

interface OperationResult {
  success: boolean;
  error?: string;
}

interface InitResult extends OperationResult {
  state: WorkspaceState;
}

export function createWorkspaceStateAPI() {
  return {
    // State access
    initialize: (): Promise<InitResult> => ipcRenderer.invoke('workspace-state:initialize'),
    getState: (): Promise<WorkspaceState> => ipcRenderer.invoke('workspace-state:get-state'),

    // Workspace switching
    switchWorkspace: (workspaceId: string): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:switch-workspace', workspaceId),

    // Collection CRUD
    addCollection: (
      section: V5.WorkspaceSection,
      data: Omit<V5.Collection, 'uid' | 'path'>,
    ): Promise<OperationResult & { collection?: V5.Collection }> =>
      ipcRenderer.invoke('workspace-state:add-collection', section, data),

    updateCollection: (
      section: V5.WorkspaceSection,
      uid: string,
      updates: Partial<V5.Collection>,
    ): Promise<OperationResult> => ipcRenderer.invoke('workspace-state:update-collection', section, uid, updates),

    removeCollection: (section: V5.WorkspaceSection, uid: string): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:remove-collection', section, uid),

    // Workspace CRUD
    createWorkspace: (
      name: string,
      type: WorkspaceType,
      options?: { description?: string; gitUrl?: string },
    ): Promise<OperationResult & { workspace?: Workspace }> =>
      ipcRenderer.invoke('workspace-state:create-workspace', name, type, options),

    updateWorkspace: (workspaceId: string, updates: Partial<Workspace>): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:update-workspace', workspaceId, updates),

    deleteWorkspace: (workspaceId: string): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:delete-workspace', workspaceId),

    copyWorkspaceData: (sourceWorkspaceId: string, targetWorkspaceId: string): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:copy-workspace-data', sourceWorkspaceId, targetWorkspaceId),

    // Environment CRUD
    createEnvironment: (name: string): Promise<OperationResult & { environment?: V5.Environment }> =>
      ipcRenderer.invoke('workspace-state:create-environment', name),

    deleteEnvironment: (name: string): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:delete-environment', name),

    switchEnvironment: (name: string | null): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:switch-environment', name),

    setVariable: (
      envName: string,
      varName: string,
      value: string,
      type: 'default' | 'secret',
    ): Promise<OperationResult> => ipcRenderer.invoke('workspace-state:set-variable', envName, varName, value, type),

    updateEnvironment: (
      oldName: string,
      updates: { name?: string; variables?: V5.Variable[] },
    ): Promise<OperationResult> => ipcRenderer.invoke('workspace-state:update-environment', oldName, updates),

    // Request CRUD
    getRequest: (uid: string): Promise<OperationResult & { request?: V5.Request }> =>
      ipcRenderer.invoke('workspace-state:get-request', uid),

    addRequest: (
      collectionUid: string,
      request: Omit<V5.Request, 'uid' | 'path'>,
    ): Promise<OperationResult & { request?: V5.Request }> =>
      ipcRenderer.invoke('workspace-state:add-request', collectionUid, request),

    updateRequest: (uid: string, updates: Partial<V5.Request>): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:update-request', uid, updates),

    removeRequest: (uid: string): Promise<OperationResult> => ipcRenderer.invoke('workspace-state:remove-request', uid),

    // Rule CRUD
    addRule: (
      collectionUid: string,
      rule: Omit<V5.Rule, 'uid' | 'path'>,
    ): Promise<OperationResult & { rule?: V5.Rule }> =>
      ipcRenderer.invoke('workspace-state:add-rule', collectionUid, rule),

    updateRule: (uid: string, updates: Partial<V5.Rule>): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:update-rule', uid, updates),

    removeRule: (uid: string): Promise<OperationResult> => ipcRenderer.invoke('workspace-state:remove-rule', uid),

    toggleRule: (uid: string, enabled: boolean): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:toggle-rule', uid, enabled),

    // Folder CRUD
    addFolder: (
      collectionUid: string,
      section: V5.WorkspaceSection,
      name: string,
      parentPath?: string,
    ): Promise<OperationResult & { folder?: V5.FolderNode }> =>
      ipcRenderer.invoke('workspace-state:add-folder', collectionUid, section, name, parentPath),

    renameFolder: (section: V5.WorkspaceSection, uid: string, newName: string): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:rename-folder', section, uid, newName),

    removeFolder: (section: V5.WorkspaceSection, uid: string): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:remove-folder', section, uid),

    // Workspace variables
    updateWorkspaceVariables: (variables: V5.WorkspaceVariables): Promise<OperationResult> =>
      ipcRenderer.invoke('workspace-state:update-workspace-variables', variables),

    // IPC event listeners (main → renderer)
    onStatePatch: (callback: (patch: WorkspaceStatePatch) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, patch: WorkspaceStatePatch) => callback(patch);
      ipcRenderer.on('workspace:state-patch', handler);
      return () => ipcRenderer.removeListener('workspace:state-patch', handler);
    },

    onSwitchProgress: (callback: (progress: SwitchProgress) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: SwitchProgress) => callback(progress);
      ipcRenderer.on('workspace:switch-progress', handler);
      return () => ipcRenderer.removeListener('workspace:switch-progress', handler);
    },
  };
}

export type WorkspaceStateAPI = ReturnType<typeof createWorkspaceStateAPI>;
