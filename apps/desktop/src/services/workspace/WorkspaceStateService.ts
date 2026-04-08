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
import { resolveRules, VariableResolver } from '@openheaders/core/variables';
import electron from 'electron';
import {
  deleteEnvironmentFiles,
  deleteItemFolder,
  readAllCollections,
  readAllEnvironments,
  readAllRuleCollections,
  readAllRules,
  readRequest,
  readVault,
  readWorkspaceManifest,
  readWorkspaceVariables,
  renameEnvironmentFiles,
  writeCollection,
  writeEnvironment,
  writeRequest,
  writeRule,
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

function generateUid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let uid = '';
  for (let i = 0; i < 4; i++) {
    uid += chars[Math.floor(Math.random() * chars.length)];
  }
  return uid;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export type { WorkspaceState } from './state';

class WorkspaceStateService {
  private readonly state: WorkspaceState;
  private readonly appDataPath: string;

  // Variable resolution (single source of truth for {{VAR}} interpolation)
  private readonly variableResolver = new VariableResolver();

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

    // Wire extension→desktop rule mutations (toggle/delete from extension popup)
    deps.webSocketService.setRuleMutationCallbacks({
      toggleRule: (uid, enabled) => this.toggleRule(uid, enabled),
      removeRule: (uid) => this.removeRule(uid),
    });

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
      this.broadcastResolvedRules();

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

    // Keep resolver in sync with loaded data
    this.syncVariableResolver();

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

      if (this.dirty.requestCollections) {
        const sectionDir = `${this.workspaceRootPath}/requests`;
        for (const coll of this.state.requestCollections) {
          saves.push(writeCollection(sectionDir, coll));
        }
        this.dirty.requestCollections = false;
      }

      if (this.dirty.ruleCollections) {
        const sectionDir = `${this.workspaceRootPath}/rules`;
        for (const coll of this.state.ruleCollections) {
          saves.push(writeCollection(sectionDir, coll));
        }
        this.dirty.ruleCollections = false;
      }

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

      this.broadcastResolvedRules();

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

  async addCollection(section: V5.WorkspaceSection, data: Omit<V5.Collection, 'uid' | 'path'>): Promise<V5.Collection> {
    return crudAddCollection(this.ctx, section, data);
  }

  async updateCollection(section: V5.WorkspaceSection, uid: string, updates: Partial<V5.Collection>): Promise<void> {
    return crudUpdateCollection(this.ctx, section, uid, updates);
  }

  async removeCollection(section: V5.WorkspaceSection, uid: string): Promise<void> {
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
    await deleteEnvironmentFiles(this.workspaceRootPath, name);
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

    this.syncVariableResolver();
    this.broadcastResolvedRules();
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
    this.syncVariableResolver();
    this.scheduleDebouncedSave();
    this.broadcastResolvedRules();
    sendPatchToRenderers(this.state, ['environments']);
  }

  async updateEnvironment(oldName: string, updates: { name?: string; variables?: V5.Variable[] }): Promise<void> {
    const env = this.state.environments.find((e) => e.name === oldName);
    if (!env) return;

    if (updates.name && updates.name !== oldName) {
      await renameEnvironmentFiles(this.workspaceRootPath, oldName, updates.name);
      env.name = updates.name;
      env.path = `environments/${updates.name.toLowerCase()}.yaml`;
      if (this.state.activeEnvironmentName === oldName) {
        this.state.activeEnvironmentName = updates.name;
      }
    }
    if (updates.variables !== undefined) {
      env.variables = updates.variables;
    }

    this.dirty.environments = true;
    this.syncVariableResolver();
    this.scheduleDebouncedSave();
    this.broadcastResolvedRules();
    sendPatchToRenderers(this.state, ['environments', 'activeEnvironmentName']);
  }

  // ── Request CRUD ──────────────────────────────────────────────

  async getRequest(uid: string): Promise<V5.Request | null> {
    const node = this.findRequestNode(uid);
    if (!node) return null;
    return readRequest(node.path);
  }

  async addRequest(collectionUid: string, request: Omit<V5.Request, 'uid' | 'path'>): Promise<V5.Request> {
    const collection = this.state.requestCollections.find((c) => c.uid === collectionUid);
    if (!collection) throw new Error(`Collection ${collectionUid} not found`);

    const uid = generateUid();
    const slug = slugify(request.name);
    const folderName = slug ? `${slug}-${uid}` : uid;
    const itemDir = `${collection.path}/${folderName}`;

    const newRequest: V5.Request = { ...request, uid, path: itemDir };
    await writeRequest(itemDir, newRequest);

    collection.tree.push({
      type: 'request',
      uid,
      name: request.name,
      path: itemDir,
      method: request.method,
    });

    this.dirty.requestCollections = true;
    this.scheduleDebouncedSave();
    sendPatchToRenderers(this.state, ['requestCollections']);
    return newRequest;
  }

  async updateRequest(uid: string, updates: Partial<V5.Request>): Promise<void> {
    const node = this.findRequestNode(uid);
    if (!node) return;

    const existing = await readRequest(node.path);
    if (!existing) return;

    const updated: V5.Request = { ...existing, ...updates, uid: existing.uid, path: existing.path };
    await writeRequest(node.path, updated);

    // Update tree node metadata if name/method changed
    if (updates.name) node.name = updates.name;
    if (updates.method) node.method = updates.method;

    this.dirty.requestCollections = true;
    sendPatchToRenderers(this.state, ['requestCollections']);
  }

  async removeRequest(uid: string): Promise<void> {
    const node = this.findRequestNode(uid);
    if (!node) return;

    await deleteItemFolder(node.path);
    this.removeNodeFromTree(this.state.requestCollections, uid);

    this.dirty.requestCollections = true;
    this.scheduleDebouncedSave();
    sendPatchToRenderers(this.state, ['requestCollections']);
  }

  // ── Rule CRUD ─────────────────────────────────────────────────

  async addRule(collectionUid: string, rule: Omit<V5.Rule, 'uid' | 'path'>): Promise<V5.Rule> {
    const collection = this.state.ruleCollections.find((c) => c.uid === collectionUid);
    if (!collection) throw new Error(`Rule collection ${collectionUid} not found`);

    const uid = generateUid();
    const slug = slugify(rule.name);
    const folderName = slug ? `${slug}-${uid}` : uid;
    const itemDir = `${collection.path}/${folderName}`;

    const newRule = { ...rule, uid, path: itemDir } as V5.Rule;
    await writeRule(itemDir, newRule);

    this.state.rules.push(newRule);
    this.dirty.rules = true;
    this.scheduleDebouncedSave();
    this.broadcastResolvedRules();
    sendPatchToRenderers(this.state, ['rules', 'ruleCollections']);
    return newRule;
  }

  async updateRule(uid: string, updates: Partial<V5.Rule>): Promise<void> {
    const idx = this.state.rules.findIndex((r) => r.uid === uid);
    if (idx === -1) return;

    const existing = this.state.rules[idx];
    const updated = { ...existing, ...updates, uid: existing.uid, path: existing.path } as V5.Rule;
    this.state.rules[idx] = updated;
    await writeRule(existing.path, updated);

    this.dirty.rules = true;
    this.broadcastResolvedRules();
    sendPatchToRenderers(this.state, ['rules']);
  }

  async removeRule(uid: string): Promise<void> {
    const rule = this.state.rules.find((r) => r.uid === uid);
    if (!rule) return;

    await deleteItemFolder(rule.path);
    this.state.rules = this.state.rules.filter((r) => r.uid !== uid);

    this.dirty.rules = true;
    this.scheduleDebouncedSave();
    this.broadcastResolvedRules();
    sendPatchToRenderers(this.state, ['rules']);
  }

  async toggleRule(uid: string, enabled: boolean): Promise<void> {
    const rule = this.state.rules.find((r) => r.uid === uid);
    if (!rule) return;

    rule.enabled = enabled;
    await writeRule(rule.path, rule);

    this.dirty.rules = true;
    this.broadcastResolvedRules();
    sendPatchToRenderers(this.state, ['rules']);
  }

  // ── Folder CRUD ───────────────────────────────────────────────

  async addFolder(collectionUid: string, section: V5.WorkspaceSection, name: string, parentPath?: string): Promise<V5.FolderNode> {
    const collections = section === 'requests' ? this.state.requestCollections : this.state.ruleCollections;
    const collection = collections.find((c) => c.uid === collectionUid);
    if (!collection) throw new Error(`Collection ${collectionUid} not found`);

    const uid = generateUid();
    const slug = slugify(name);
    const folderName = slug ? `${slug}-${uid}` : uid;
    const baseDir = parentPath || collection.path;
    const folderDir = `${baseDir}/${folderName}`;

    // Create directory and _folder.yaml
    const fs = await import('node:fs');
    await fs.promises.mkdir(folderDir, { recursive: true });

    const node: V5.FolderNode = { type: 'folder', uid, name, path: folderDir, children: [] };

    if (parentPath) {
      const parent = this.findFolderNode(collection.tree, parentPath);
      if (parent) parent.children.push(node);
      else collection.tree.push(node);
    } else {
      collection.tree.push(node);
    }

    const dirtyKey = section === 'requests' ? 'requestCollections' : 'ruleCollections';
    this.dirty[dirtyKey] = true;
    this.scheduleDebouncedSave();
    sendPatchToRenderers(this.state, [dirtyKey]);
    return node;
  }

  async renameFolder(section: V5.WorkspaceSection, uid: string, newName: string): Promise<void> {
    const collections = section === 'requests' ? this.state.requestCollections : this.state.ruleCollections;
    for (const coll of collections) {
      const node = this.findFolderNodeByUid(coll.tree, uid);
      if (node) {
        node.name = newName;
        const dirtyKey = section === 'requests' ? 'requestCollections' : 'ruleCollections';
        this.dirty[dirtyKey] = true;
        this.scheduleDebouncedSave();
        sendPatchToRenderers(this.state, [dirtyKey]);
        return;
      }
    }
  }

  async removeFolder(section: V5.WorkspaceSection, uid: string): Promise<void> {
    const collections = section === 'requests' ? this.state.requestCollections : this.state.ruleCollections;
    for (const coll of collections) {
      const node = this.findFolderNodeByUid(coll.tree, uid);
      if (node) {
        await deleteItemFolder(node.path);
        this.removeNodeFromTree(collections, uid);
        const dirtyKey = section === 'requests' ? 'requestCollections' : 'ruleCollections';
        this.dirty[dirtyKey] = true;
        this.scheduleDebouncedSave();
        sendPatchToRenderers(this.state, [dirtyKey]);
        return;
      }
    }
  }

  // ── Workspace variables update ────────────────────────────────

  async updateWorkspaceVariables(variables: V5.WorkspaceVariables): Promise<void> {
    this.state.workspaceVariables = variables;
    this.dirty.workspaceVariables = true;
    this.syncVariableResolver();
    this.scheduleDebouncedSave();
    this.broadcastResolvedRules();
    sendPatchToRenderers(this.state, ['workspaceVariables']);
  }

  // ── Variable resolution ──────────────────────────────────────

  /**
   * Sync the VariableResolver with the current state.
   * Called after any state change that affects variable scopes:
   * workspace load, environment CRUD, workspace variable update, vault update, collection variable update.
   */
  private syncVariableResolver(): void {
    this.variableResolver.setVault(this.state.vault);
    this.variableResolver.setEnvironments(this.state.environments);
    this.variableResolver.setWorkspaceVariables(this.state.workspaceVariables);

    // Sync collection variables from all collections (request + rule)
    for (const coll of [...this.state.requestCollections, ...this.state.ruleCollections]) {
      if (coll.variables.length > 0) {
        this.variableResolver.setCollectionVariables(coll.uid, coll.variables);
      }
    }
  }

  /** Expose resolver for WSRuleHandler to use when broadcasting. */
  getVariableResolver(): VariableResolver {
    return this.variableResolver;
  }

  /**
   * Resolve all {{VAR}} templates in rules and broadcast to WebSocket clients.
   * Called after any state change that affects rules or variables.
   */
  private broadcastResolvedRules(): void {
    const resolved = resolveRules(this.state.rules, this.variableResolver);
    broadcastToServices(resolved, this.webSocketService);
  }

  // ── Tree helpers ──────────────────────────────────────────────

  private findRequestNode(uid: string): V5.RequestNode | null {
    for (const coll of this.state.requestCollections) {
      const found = this.findNodeInTree<V5.RequestNode>(coll.tree, uid, 'request');
      if (found) return found;
    }
    return null;
  }

  private findNodeInTree<T extends V5.TreeNode>(nodes: V5.TreeNode[], uid: string, type: string): T | null {
    for (const node of nodes) {
      if (node.uid === uid && node.type === type) return node as T;
      if (node.type === 'folder') {
        const found = this.findNodeInTree<T>(node.children, uid, type);
        if (found) return found;
      }
    }
    return null;
  }

  private findFolderNode(nodes: V5.TreeNode[], path: string): V5.FolderNode | null {
    for (const node of nodes) {
      if (node.type === 'folder' && node.path === path) return node;
      if (node.type === 'folder') {
        const found = this.findFolderNode(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  private findFolderNodeByUid(nodes: V5.TreeNode[], uid: string): V5.FolderNode | null {
    for (const node of nodes) {
      if (node.type === 'folder' && node.uid === uid) return node;
      if (node.type === 'folder') {
        const found = this.findFolderNodeByUid(node.children, uid);
        if (found) return found;
      }
    }
    return null;
  }

  private removeNodeFromTree(collections: V5.CollectionTree[], uid: string): void {
    for (const coll of collections) {
      if (this.removeFromNodes(coll.tree, uid)) return;
    }
  }

  private removeFromNodes(nodes: V5.TreeNode[], uid: string): boolean {
    const idx = nodes.findIndex((n) => n.uid === uid);
    if (idx !== -1) {
      nodes.splice(idx, 1);
      return true;
    }
    for (const node of nodes) {
      if (node.type === 'folder' && this.removeFromNodes(node.children, uid)) return true;
    }
    return false;
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
