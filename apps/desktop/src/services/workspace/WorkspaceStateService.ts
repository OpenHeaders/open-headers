/**
 * WorkspaceStateService — main-process owner of all workspace state.
 *
 * Orchestrates:
 *  - Workspace lifecycle (load, switch, create, delete)
 *  - Environment management (create, switch, set variables)
 *  - Collection/rule CRUD (delegated to submodules)
 *  - Auto-save with dirty tracking
 *  - Broadcasting state to renderer and WebSocket
 *
 * Data is read/written via V5StorageService (YAML workspace format).
 */

import type { V5 } from '@openheaders/core/types';
import { errorMessage } from '@openheaders/core';
import electron from 'electron';
import {
  readAllCollections,
  readAllEnvironments,
  readAllRuleCollections,
  readAllRules,
  readVault,
  readWorkspaceManifest,
  readWorkspaceVariables,
  writeEnvironment,
  writeVault,
  writeWorkspaceVariables,
} from '@/services/workspace/v5-storage';
import type { Workspace, WorkspaceMetadata, WorkspaceType } from '@/types/workspace';
import mainLogger from '@/utils/mainLogger';
import {
  broadcastToServices,
  addCollection as crudAddCollection,
  removeCollection as crudRemoveCollection,
  updateCollection as crudUpdateCollection,
  copyWorkspaceData as crudCopyWorkspaceData,
  createWorkspace as crudCreateWorkspace,
  deleteWorkspace as crudDeleteWorkspace,
  updateWorkspace as crudUpdateWorkspace,
  type DirtyFlags,
  type EnvironmentResolverLike,
  loadWorkspacesConfig,
  saveWorkspacesConfig as persistWorkspacesConfig,
  sendPatchToRenderers,
  sendProgressToRenderers,
  type StateContext,
  type WebSocketServiceLike,
  type WorkspaceState,
  type WorkspaceSyncSchedulerLike,
} from './state';

const { createLogger } = mainLogger;
const log = createLogger('WorkspaceStateService');

export type { WorkspaceState } from './state';

class WorkspaceStateService {
  private readonly state: WorkspaceState;
  private readonly appDataPath: string;

  // External services (wired after construction)
  private webSocketService: WebSocketServiceLike | null = null;
  private envResolver: EnvironmentResolverLike | null = null;
  private syncScheduler: WorkspaceSyncSchedulerLike | null = null;

  // Auto-save
  private dirty: DirtyFlags = {
    requestCollections: false,
    ruleCollections: false,
    rules: false,
    environments: false,
    workspaceVariables: false,
    vault: false,
    workspaces: false,
  };
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private isSaving = false;
  private debounceSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Init
  private initPromise: Promise<boolean> | null = null;
  private configReady: Promise<void>;
  private _resolveConfigReady!: () => void;

  /** Path to the active workspace root directory. */
  private workspaceRootPath = '';

  constructor() {
    this.appDataPath = electron.app.getPath('userData');
    this.state = {
      initialized: false,
      loading: false,
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
    this.configReady = new Promise((resolve) => {
      this._resolveConfigReady = resolve;
    });
    log.info('WorkspaceStateService created');
  }

  // ── StateContext for submodules ────────────────────────────────

  private get ctx(): StateContext {
    return {
      state: this.state,
      dirty: this.dirty,
      workspaceRootPath: this.workspaceRootPath,
      appDataPath: this.appDataPath,
      webSocketService: this.webSocketService,
      envResolver: this.envResolver,
      syncScheduler: this.syncScheduler,
      scheduleDebouncedSave: () => this.scheduleDebouncedSave(),
      saveAll: () => this.saveAll(),
      saveWorkspacesConfig: () => this.saveWorkspacesConfig(),
      loadWorkspaceData: (id) => this.loadWorkspaceData(id),
      updateWorkspaceMetadataInMemory: (id, meta) => this.updateWorkspaceMetadataInMemory(id, meta),
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  configure(deps: {
    webSocketService: WebSocketServiceLike;
    syncScheduler?: WorkspaceSyncSchedulerLike;
  }): void {
    this.webSocketService = deps.webSocketService;
    this.envResolver = deps.webSocketService.environmentHandler;
    this.syncScheduler = deps.syncScheduler ?? null;
    this._resolveConfigReady();
    log.info('WorkspaceStateService configured');
  }

  async initialize(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<boolean> {
    try {
      this.state.loading = true;

      // Load workspace registry
      const config = await loadWorkspacesConfig(this.appDataPath);
      this.state.workspaces = config.workspaces;
      this.state.activeWorkspaceId = config.activeWorkspaceId;
      this.state.syncStatus = config.syncStatus;

      // Load active workspace data
      await this.loadWorkspaceData(this.state.activeWorkspaceId);

      // Wait for services to be wired before broadcasting
      await this.configReady;

      // Broadcast to extension
      broadcastToServices(this.state, this.webSocketService);

      // Start auto-save
      this.autoSaveTimer = setInterval(() => this.saveAll(), 30_000);

      this.state.initialized = true;
      this.state.loading = false;
      log.info('WorkspaceStateService initialized');
      return true;
    } catch (error) {
      this.state.error = errorMessage(error);
      this.state.loading = false;
      log.error('Initialization failed:', error);
      return false;
    }
  }

  // ── Workspace data loading ────────────────────────────────────

  private async loadWorkspaceData(workspaceId: string): Promise<void> {
    // For now, workspaces live inside appData. Will be changed to user-chosen paths.
    this.workspaceRootPath = `${this.appDataPath}/workspaces/${workspaceId}`;

    const manifest = await readWorkspaceManifest(this.workspaceRootPath);
    if (!manifest) {
      log.info(`No workspace.yaml found in ${this.workspaceRootPath}, starting fresh`);
      this.state.requestCollections = [];
      this.state.ruleCollections = [];
      this.state.rules = [];
      this.state.environments = [];
      this.state.workspaceVariables = { variables: [] };
      this.state.vault = { secrets: [] };
      return;
    }

    const [requestCollections, ruleCollections, rules, environments, workspaceVars, vault] = await Promise.all([
      readAllCollections(this.workspaceRootPath),
      readAllRuleCollections(this.workspaceRootPath),
      readAllRules(this.workspaceRootPath),
      readAllEnvironments(this.workspaceRootPath),
      readWorkspaceVariables(this.workspaceRootPath),
      readVault(this.workspaceRootPath),
    ]);

    this.state.requestCollections = requestCollections;
    this.state.ruleCollections = ruleCollections;
    this.state.rules = rules;
    this.state.environments = environments;
    this.state.workspaceVariables = workspaceVars;
    this.state.vault = vault;

    // Activate the stored environment
    if (this.state.activeEnvironmentName) {
      const activeEnv = environments.find((e) => e.name === this.state.activeEnvironmentName);
      if (activeEnv) activeEnv.isActive = true;
    }

    log.info(
      `Loaded workspace: ${requestCollections.length} request collections, ${ruleCollections.length} rule collections, ${rules.length} rules, ${environments.length} environments`,
    );
  }

  // ── Auto-save ─────────────────────────────────────────────────

  private scheduleDebouncedSave(): void {
    if (this.debounceSaveTimer) clearTimeout(this.debounceSaveTimer);
    this.debounceSaveTimer = setTimeout(() => this.saveAll(), 2000);
  }

  private async saveAll(): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;

    try {
      const saves: Promise<void>[] = [];

      if (this.dirty.workspaceVariables) {
        saves.push(writeWorkspaceVariables(this.workspaceRootPath, this.state.workspaceVariables));
        this.dirty.workspaceVariables = false;
      }

      if (this.dirty.vault) {
        saves.push(writeVault(this.workspaceRootPath, this.state.vault));
        this.dirty.vault = false;
      }

      if (this.dirty.environments) {
        for (const env of this.state.environments) {
          saves.push(writeEnvironment(this.workspaceRootPath, env));
        }
        this.dirty.environments = false;
      }

      if (this.dirty.workspaces) {
        saves.push(
          persistWorkspacesConfig(this.appDataPath, {
            workspaces: this.state.workspaces,
            activeWorkspaceId: this.state.activeWorkspaceId,
            syncStatus: this.state.syncStatus,
          }),
        );
        this.dirty.workspaces = false;
      }

      // TODO: save collections and rules when dirty

      if (saves.length > 0) {
        await Promise.all(saves);
        log.debug(`Saved ${saves.length} data types`);
      }
    } catch (error) {
      log.error('Save failed:', errorMessage(error));
    } finally {
      this.isSaving = false;
    }
  }

  // ── Workspace switching ───────────────────────────────────────

  async switchWorkspace(workspaceId: string): Promise<boolean> {
    if (workspaceId === this.state.activeWorkspaceId) return true;
    if (this.state.isWorkspaceSwitching) return false;

    const target = this.state.workspaces.find((w) => w.id === workspaceId);
    if (!target) return false;

    try {
      this.state.isWorkspaceSwitching = true;
      sendProgressToRenderers('saving', 10, 'Saving current workspace...', false, target);

      await this.saveAll();

      sendProgressToRenderers('loading', 50, 'Loading workspace data...', false, target);

      this.state.activeWorkspaceId = workspaceId;
      await this.loadWorkspaceData(workspaceId);

      broadcastToServices(this.state, this.webSocketService);

      this.dirty.workspaces = true;
      await this.saveAll();

      this.state.isWorkspaceSwitching = false;
      sendPatchToRenderers(this.state, [
        'activeWorkspaceId',
        'requestCollections',
        'ruleCollections',
        'rules',
        'environments',
        'workspaceVariables',
        'vault',
        'isWorkspaceSwitching',
      ]);

      log.info(`Switched to workspace "${target.name}"`);
      return true;
    } catch (error) {
      this.state.isWorkspaceSwitching = false;
      log.error(`Failed to switch workspace:`, errorMessage(error));
      return false;
    }
  }

  // ── Collection CRUD ───────────────────────────────────────────

  async addCollection(section: 'requests' | 'rules', data: Omit<V5.Collection, 'uid' | 'path'>): Promise<V5.Collection> {
    return crudAddCollection(this.ctx, section, data);
  }

  async updateCollection(section: 'requests' | 'rules', uid: string, updates: Partial<V5.Collection>): Promise<void> {
    return crudUpdateCollection(this.ctx, section, uid, updates);
  }

  async removeCollection(section: 'requests' | 'rules', uid: string): Promise<void> {
    return crudRemoveCollection(this.ctx, section, uid);
  }

  // ── Environment CRUD ──────────────────────────────────────────

  async createEnvironment(name: string): Promise<V5.Environment> {
    const env: V5.Environment = {
      name,
      path: `environments/${name.toLowerCase()}.yaml`,
      variables: [],
      isActive: false,
    };
    this.state.environments.push(env);
    this.dirty.environments = true;
    this.scheduleDebouncedSave();
    sendPatchToRenderers(this.state, ['environments']);
    return env;
  }

  async deleteEnvironment(name: string): Promise<void> {
    this.state.environments = this.state.environments.filter((e) => e.name !== name);
    if (this.state.activeEnvironmentName === name) {
      this.state.activeEnvironmentName = null;
    }
    this.dirty.environments = true;
    this.scheduleDebouncedSave();
    sendPatchToRenderers(this.state, ['environments', 'activeEnvironmentName']);
  }

  async switchEnvironment(name: string | null): Promise<void> {
    for (const env of this.state.environments) {
      env.isActive = env.name === name;
    }
    this.state.activeEnvironmentName = name;
    this.dirty.workspaces = true;
    this.scheduleDebouncedSave();

    broadcastToServices(this.state, this.webSocketService);
    sendPatchToRenderers(this.state, ['environments', 'activeEnvironmentName']);
  }

  async setVariable(envName: string, varName: string, value: string, type: 'default' | 'secret' = 'default'): Promise<void> {
    const env = this.state.environments.find((e) => e.name === envName);
    if (!env) return;

    const existing = env.variables.find((v) => v.name === varName);
    if (existing) {
      existing.value = value;
      existing.type = type;
    } else {
      env.variables.push({ name: varName, value, type });
    }

    this.dirty.environments = true;
    this.scheduleDebouncedSave();
    sendPatchToRenderers(this.state, ['environments']);
  }

  // ── Workspace CRUD ────────────────────────────────────────────

  async createWorkspace(
    name: string,
    type: WorkspaceType,
    options?: { description?: string; gitUrl?: string; path?: string },
  ): Promise<Workspace> {
    const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const workspace = {
      id,
      name,
      type,
      description: options?.description,
      gitUrl: options?.gitUrl,
    };
    return crudCreateWorkspace(this.ctx, workspace, (wsId) => this.switchWorkspace(wsId).then(() => {}));
  }

  async updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<boolean> {
    return crudUpdateWorkspace(this.ctx, workspaceId, updates);
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    return crudDeleteWorkspace(this.ctx, workspaceId, (wsId) => this.switchWorkspace(wsId).then(() => {}));
  }

  async copyWorkspaceData(sourceId: string, targetId: string): Promise<void> {
    return crudCopyWorkspaceData(this.ctx, sourceId, targetId);
  }

  private async saveWorkspacesConfig(): Promise<void> {
    await persistWorkspacesConfig(this.appDataPath, {
      workspaces: this.state.workspaces,
      activeWorkspaceId: this.state.activeWorkspaceId,
      syncStatus: this.state.syncStatus,
    });
  }

  // ── Metadata helpers ──────────────────────────────────────────

  private updateWorkspaceMetadataInMemory(workspaceId: string, metadata: Partial<WorkspaceMetadata>): void {
    const ws = this.state.workspaces.find((w) => w.id === workspaceId);
    if (ws) {
      ws.metadata = { ...ws.metadata, ...metadata };
      ws.updatedAt = new Date().toISOString();
      this.dirty.workspaces = true;
    }
  }

  // ── State accessors ───────────────────────────────────────────

  getState(): WorkspaceState {
    return this.state;
  }

  getActiveWorkspaceId(): string {
    return this.state.activeWorkspaceId;
  }

  // ── Shutdown ──────────────────────────────────────────────────

  async stop(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.debounceSaveTimer) {
      clearTimeout(this.debounceSaveTimer);
      this.debounceSaveTimer = null;
    }
    await this.saveAll();
    log.info('WorkspaceStateService stopped');
  }
}

const workspaceStateService = new WorkspaceStateService();
export default workspaceStateService;
