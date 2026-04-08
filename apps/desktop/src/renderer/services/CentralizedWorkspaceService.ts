/**
 * CentralizedWorkspaceService — thin IPC client (V5).
 *
 * All state management, persistence, auto-save, and broadcasting live in
 * the main process (WorkspaceStateService). This renderer-side service:
 *  - Hydrates from main on init via IPC
 *  - Receives incremental state patches via IPC events
 *  - Forwards all mutations to main via IPC invokes
 *  - Exposes subscribe/notify for React hooks
 */

import type { V5 } from '@openheaders/core/types';
import { createLogger } from '@/renderer/utils/error-handling/logger';
import type { Workspace, WorkspaceSyncStatus, WorkspaceType } from '@/types/workspace';

const log = createLogger('CentralizedWorkspaceService');

export interface WorkspaceServiceState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  isWorkspaceSwitching: boolean;
  syncStatus: Record<string, WorkspaceSyncStatus>;
  requestCollections: V5.CollectionTree[];
  ruleCollections: V5.CollectionTree[];
  rules: V5.Rule[];
  environments: V5.Environment[];
  activeEnvironmentName: string | null;
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
}

type StateListener = (state: WorkspaceServiceState, changedKeys: string[]) => void;

class CentralizedWorkspaceService {
  state: WorkspaceServiceState;
  private listeners: Set<StateListener> = new Set();
  private initPromise: Promise<boolean> | null = null;
  private patchCleanup: (() => void) | null = null;

  constructor() {
    this.state = {
      initialized: false,
      loading: true,
      error: null,
      workspaces: [],
      activeWorkspaceId: 'default-personal',
      isWorkspaceSwitching: false,
      syncStatus: {},
      requestCollections: [],
      ruleCollections: [],
      rules: [],
      environments: [],
      activeEnvironmentName: null,
      workspaceVariables: { variables: [] },
      vault: { secrets: [] },
    };

    // Subscribe to state patches from main process
    if (window.electronAPI?.workspaceState) {
      this.patchCleanup = window.electronAPI.workspaceState.onStatePatch((patch) => {
        const changedKeys: string[] = [];
        for (const [key, value] of Object.entries(patch)) {
          if (key in this.state) {
            Object.assign(this.state, { [key]: value });
            changedKeys.push(key);
          }
        }
        if (changedKeys.length > 0) {
          this.notifyListeners(changedKeys);
        }
      });
    }

    log.info('CentralizedWorkspaceService initialized (V5 IPC client)');
  }

  // ── State management ──────────────────────────────────────────

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState(), []);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(changedKeys: string[] = []): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state, changedKeys);
      } catch (e) {
        log.error('Listener error:', e);
      }
    }
  }

  getState(): WorkspaceServiceState {
    return { ...this.state };
  }

  // ── Initialization (hydrate from main) ──────────────────────

  async initialize(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<boolean> {
    try {
      if (!window.electronAPI?.workspaceState) {
        const msg = 'workspaceState API not available';
        log.error(msg);
        this.state.error = msg;
        this.state.loading = false;
        this.notifyListeners(['error', 'loading']);
        return false;
      }

      const result = await window.electronAPI.workspaceState.initialize();
      if (result.state) {
        const changedKeys: string[] = [];
        for (const [key, value] of Object.entries(result.state)) {
          if (key in this.state) {
            Object.assign(this.state, { [key]: value });
            changedKeys.push(key);
          }
        }
        this.notifyListeners(changedKeys);
      }

      log.info('Hydrated from main process');
      return result.success;
    } catch (error) {
      log.error('Failed to hydrate from main:', error);
      this.state.error = error instanceof Error ? error.message : String(error);
      this.state.loading = false;
      this.notifyListeners(['error', 'loading']);
      throw error;
    }
  }

  isReady(): boolean {
    return this.state.initialized && !this.state.loading;
  }

  // ── Collection CRUD (IPC forwards) ────────────────────────

  async addCollection(
    section: V5.WorkspaceSection,
    data: Omit<V5.Collection, 'uid' | 'path'>,
  ): Promise<V5.Collection> {
    const result = await window.electronAPI.workspaceState.addCollection(section, data);
    if (!result.success) throw new Error(result.error ?? 'Failed to add collection');
    return result.collection!;
  }

  async updateCollection(
    section: V5.WorkspaceSection,
    uid: string,
    updates: Partial<V5.Collection>,
  ): Promise<void> {
    const result = await window.electronAPI.workspaceState.updateCollection(section, uid, updates);
    if (!result.success) throw new Error(result.error ?? 'Failed to update collection');
  }

  async removeCollection(section: V5.WorkspaceSection, uid: string): Promise<void> {
    const result = await window.electronAPI.workspaceState.removeCollection(section, uid);
    if (!result.success) throw new Error(result.error ?? 'Failed to remove collection');
  }

  // ── Workspace CRUD (IPC forwards) ──────────────────────────

  async createWorkspace(
    name: string,
    type: WorkspaceType,
    options?: { description?: string; gitUrl?: string },
  ): Promise<Workspace> {
    const result = await window.electronAPI.workspaceState.createWorkspace(name, type, options);
    if (!result.success) throw new Error(result.error ?? 'Failed to create workspace');
    return result.workspace!;
  }

  async switchWorkspace(workspaceId: string): Promise<void> {
    const result = await window.electronAPI.workspaceState.switchWorkspace(workspaceId);
    if (!result.success) throw new Error(result.error ?? 'Failed to switch workspace');
  }

  async updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<boolean> {
    const result = await window.electronAPI.workspaceState.updateWorkspace(workspaceId, updates);
    if (!result.success) throw new Error(result.error ?? 'Failed to update workspace');
    return true;
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const result = await window.electronAPI.workspaceState.deleteWorkspace(workspaceId);
    if (!result.success) throw new Error(result.error ?? 'Failed to delete workspace');
    return true;
  }

  async copyWorkspaceData(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void> {
    const result = await window.electronAPI.workspaceState.copyWorkspaceData(sourceWorkspaceId, targetWorkspaceId);
    if (!result.success) throw new Error(result.error ?? 'Failed to copy workspace data');
  }

  // ── Request CRUD (IPC forwards) ────────────────────────

  async getRequest(uid: string): Promise<V5.Request | null> {
    const result = await window.electronAPI.workspaceState.getRequest(uid);
    if (!result.success) throw new Error(result.error ?? 'Failed to get request');
    return result.request ?? null;
  }

  async addRequest(
    collectionUid: string,
    request: Omit<V5.Request, 'uid' | 'path'>,
  ): Promise<V5.Request> {
    const result = await window.electronAPI.workspaceState.addRequest(collectionUid, request);
    if (!result.success) throw new Error(result.error ?? 'Failed to add request');
    return result.request!;
  }

  async updateRequest(uid: string, updates: Partial<V5.Request>): Promise<void> {
    const result = await window.electronAPI.workspaceState.updateRequest(uid, updates);
    if (!result.success) throw new Error(result.error ?? 'Failed to update request');
  }

  async removeRequest(uid: string): Promise<void> {
    const result = await window.electronAPI.workspaceState.removeRequest(uid);
    if (!result.success) throw new Error(result.error ?? 'Failed to remove request');
  }

  // ── Rule CRUD (IPC forwards) ──────────────────────────

  async addRule(
    collectionUid: string,
    rule: Omit<V5.Rule, 'uid' | 'path'>,
  ): Promise<V5.Rule> {
    const result = await window.electronAPI.workspaceState.addRule(collectionUid, rule);
    if (!result.success) throw new Error(result.error ?? 'Failed to add rule');
    return result.rule!;
  }

  async updateRule(uid: string, updates: Partial<V5.Rule>): Promise<void> {
    const result = await window.electronAPI.workspaceState.updateRule(uid, updates);
    if (!result.success) throw new Error(result.error ?? 'Failed to update rule');
  }

  async removeRule(uid: string): Promise<void> {
    const result = await window.electronAPI.workspaceState.removeRule(uid);
    if (!result.success) throw new Error(result.error ?? 'Failed to remove rule');
  }

  async toggleRule(uid: string, enabled: boolean): Promise<void> {
    const result = await window.electronAPI.workspaceState.toggleRule(uid, enabled);
    if (!result.success) throw new Error(result.error ?? 'Failed to toggle rule');
  }

  // ── Folder CRUD (IPC forwards) ────────────────────────

  async addFolder(
    collectionUid: string,
    section: V5.WorkspaceSection,
    name: string,
    parentPath?: string,
  ): Promise<V5.FolderNode> {
    const result = await window.electronAPI.workspaceState.addFolder(collectionUid, section, name, parentPath);
    if (!result.success) throw new Error(result.error ?? 'Failed to add folder');
    return result.folder!;
  }

  async renameFolder(section: V5.WorkspaceSection, uid: string, newName: string): Promise<void> {
    const result = await window.electronAPI.workspaceState.renameFolder(section, uid, newName);
    if (!result.success) throw new Error(result.error ?? 'Failed to rename folder');
  }

  async removeFolder(section: V5.WorkspaceSection, uid: string): Promise<void> {
    const result = await window.electronAPI.workspaceState.removeFolder(section, uid);
    if (!result.success) throw new Error(result.error ?? 'Failed to remove folder');
  }

  // ── Workspace variables (IPC forwards) ────────────────

  async updateWorkspaceVariables(variables: V5.WorkspaceVariables): Promise<void> {
    const result = await window.electronAPI.workspaceState.updateWorkspaceVariables(variables);
    if (!result.success) throw new Error(result.error ?? 'Failed to update workspace variables');
  }

  // ── Environment CRUD (IPC forwards) ───────────────────────

  async createEnvironment(name: string): Promise<V5.Environment> {
    const result = await window.electronAPI.workspaceState.createEnvironment(name);
    if (!result.success) throw new Error(result.error ?? 'Failed to create environment');
    return result.environment!;
  }

  async deleteEnvironment(name: string): Promise<void> {
    const result = await window.electronAPI.workspaceState.deleteEnvironment(name);
    if (!result.success) throw new Error(result.error ?? 'Failed to delete environment');
  }

  async switchEnvironment(name: string | null): Promise<void> {
    const result = await window.electronAPI.workspaceState.switchEnvironment(name);
    if (!result.success) throw new Error(result.error ?? 'Failed to switch environment');
  }

  async setVariable(
    envName: string,
    varName: string,
    value: string,
    type: 'default' | 'secret',
  ): Promise<void> {
    const result = await window.electronAPI.workspaceState.setVariable(envName, varName, value, type);
    if (!result.success) throw new Error(result.error ?? 'Failed to set variable');
  }

  async updateEnvironment(oldName: string, updates: { name?: string; variables?: V5.Variable[] }): Promise<void> {
    const result = await window.electronAPI.workspaceState.updateEnvironment(oldName, updates);
    if (!result.success) throw new Error(result.error ?? 'Failed to update environment');
  }

  // ── Cleanup ────────────────────────────────────────────────

  cleanup(): void {
    if (this.patchCleanup) {
      this.patchCleanup();
      this.patchCleanup = null;
    }
    this.listeners.clear();
  }
}

// Singleton
let serviceInstance: CentralizedWorkspaceService | null = null;

export function getCentralizedWorkspaceService(): CentralizedWorkspaceService {
  if (!serviceInstance) {
    serviceInstance = new CentralizedWorkspaceService();
  }
  return serviceInstance;
}

export { CentralizedWorkspaceService };
