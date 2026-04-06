/**
 * CentralizedEnvironmentService — thin IPC client.
 *
 * All environment state management, persistence, and broadcasting now live in
 * the main process (WorkspaceStateService). This renderer-side service:
 *  - Receives environment state via workspace:state-patch IPC events
 *  - Forwards all mutations to main via IPC invokes
 *  - Provides synchronous getAllVariables/resolveTemplate from local cache
 *  - Dispatches local DOM events for renderer-internal UI updates
 */

import type { Environment, EnvironmentVariable } from '@openheaders/core';
import { createLogger } from '@/renderer/utils/error-handling/logger';
import { EnvironmentVariableManager, TemplateResolver } from './environment';

const log = createLogger('CentralizedEnvironmentService');

export interface EnvironmentServiceState {
  currentWorkspaceId: string;
  environments: Environment[];
  activeEnvironment: string | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
}

type StateListener = (state: EnvironmentServiceState, changedKeys: string[]) => void;

class CentralizedEnvironmentService {
  private state: EnvironmentServiceState;
  private listeners: Set<StateListener> = new Set();
  private patchCleanup: (() => void) | null = null;
  variableManager: EnvironmentVariableManager;
  templateResolver: TemplateResolver;

  constructor() {
    this.state = {
      currentWorkspaceId: 'default-personal',
      environments: [],
      activeEnvironment: null,
      isLoading: false,
      isReady: false,
      error: null,
    };

    this.variableManager = new EnvironmentVariableManager();
    this.templateResolver = new TemplateResolver();

    // Subscribe to state patches from main process
    if (window.electronAPI?.workspaceState) {
      this.patchCleanup = window.electronAPI.workspaceState.onStatePatch((patch) => {
        const changedKeys: string[] = [];

        if (patch.environments !== undefined) {
          this.state.environments = patch.environments;
          changedKeys.push('environments');
        }
        if (patch.activeEnvironment !== undefined) {
          this.state.activeEnvironment = patch.activeEnvironment;
          changedKeys.push('activeEnvironment');
        }
        if (patch.activeWorkspaceId !== undefined) {
          this.state.currentWorkspaceId = patch.activeWorkspaceId;
          changedKeys.push('currentWorkspaceId');
        }

        if (changedKeys.length > 0) {
          this.state.isReady = true;
          this.state.isLoading = false;

          // Dispatch DOM events for renderer-internal listeners (e.g. HeaderRules.tsx)
          const activeEnv = this.getActiveEnv();
          if (changedKeys.includes('environments')) {
            window.dispatchEvent(
              new CustomEvent('environment-variables-changed', {
                detail: {
                  environment: activeEnv?.name ?? null,
                  variables: activeEnv?.variables ?? {},
                },
              }),
            );
          }
          if (changedKeys.includes('activeEnvironment')) {
            window.dispatchEvent(
              new CustomEvent('environment-switched', {
                detail: {
                  environment: activeEnv?.name ?? null,
                  variables: activeEnv?.variables ?? {},
                },
              }),
            );
          }

          this.notifyListeners(changedKeys);
        }
      });
    }

    log.info('CentralizedEnvironmentService initialized (IPC client)');
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private getActiveEnv(): Environment | undefined {
    return this.state.activeEnvironment
      ? this.state.environments.find((e) => e.id === this.state.activeEnvironment)
      : undefined;
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

  getState(): EnvironmentServiceState {
    return {
      ...this.state,
      environments: [...this.state.environments],
    };
  }

  // ── Initialization (hydrate from main) ──────────────────────

  async initialize(_workspaceId: string | null = null): Promise<boolean> {
    try {
      this.state.isLoading = true;
      this.state.error = null;

      if (!window.electronAPI?.workspaceState) {
        log.error('workspaceState API not available');
        this.state.error = 'workspaceState API not available';
        this.state.isLoading = false;
        this.state.isReady = true;
        this.notifyListeners(['error', 'isLoading', 'isReady']);
        return false;
      }

      const envState = await window.electronAPI.workspaceState.getEnvironmentState();
      this.state.environments = envState.environments;
      this.state.activeEnvironment = envState.activeEnvironment;
      this.state.isReady = true;
      this.state.isLoading = false;
      this.notifyListeners(['environments', 'activeEnvironment', 'isReady', 'isLoading']);

      log.info('Hydrated environment state from main process');
      return true;
    } catch (error) {
      log.error('Failed to hydrate from main:', error);
      this.state.error = error instanceof Error ? error.message : String(error);
      this.state.isLoading = false;
      // Mark ready even on error to prevent blocking
      this.state.isReady = true;
      this.notifyListeners(['error', 'isLoading', 'isReady']);
      return false;
    }
  }

  async waitForReady(timeout = 5000): Promise<boolean> {
    const start = Date.now();
    while (!this.state.isReady) {
      if (Date.now() - start > timeout) throw new Error('Timeout waiting for environment service');
      await new Promise((r) => setTimeout(r, 100));
    }
    return true;
  }

  // ── Environment CRUD (IPC forwards) ──────────────────────────

  async createEnvironment(params: { name: string; collectionId?: string; folderId?: string }): Promise<Environment> {
    const result = await window.electronAPI.workspaceState.createEnvironment(params);
    if (!result.success) throw new Error(result.error ?? 'Failed to create environment');
    return result.environment!;
  }

  async updateEnvironment(
    environmentId: string,
    updates: { name?: string; variables?: Record<string, EnvironmentVariable> },
  ): Promise<boolean> {
    const result = await window.electronAPI.workspaceState.updateEnvironment(environmentId, updates);
    if (!result.success) throw new Error(result.error ?? 'Failed to update environment');
    return true;
  }

  async deleteEnvironment(environmentId: string): Promise<boolean> {
    const result = await window.electronAPI.workspaceState.deleteEnvironment(environmentId);
    if (!result.success) throw new Error(result.error ?? 'Failed to delete environment');
    return true;
  }

  async switchEnvironment(environmentId: string | null): Promise<boolean> {
    const result = await window.electronAPI.workspaceState.switchEnvironment(environmentId);
    if (!result.success) throw new Error(result.error ?? 'Failed to switch environment');
    return true;
  }

  // ── Variable CRUD (IPC forwards) ─────────────────────────────

  async setVariable(name: string, value: string | null, isSensitive = false): Promise<boolean> {
    if (!this.state.activeEnvironment) {
      throw new Error('No active environment — select an environment first');
    }
    const result = await window.electronAPI.workspaceState.setVariable(
      name,
      value,
      this.state.activeEnvironment,
      isSensitive,
    );
    if (!result.success) throw new Error(result.error ?? 'Failed to set variable');
    return true;
  }

  async setVariableInEnvironment(
    name: string,
    value: string | null,
    environmentId: string,
    isSensitive = false,
  ): Promise<boolean> {
    const result = await window.electronAPI.workspaceState.setVariable(name, value, environmentId, isSensitive);
    if (!result.success) throw new Error(result.error ?? 'Failed to set variable');
    return true;
  }

  async batchSetVariablesInEnvironment(
    environmentId: string,
    variables: Array<{ name: string; value: string | null; isSensitive?: boolean }>,
  ): Promise<boolean> {
    const result = await window.electronAPI.workspaceState.batchSetVariables(environmentId, variables);
    if (!result.success) throw new Error(result.error ?? 'Failed to batch set variables');
    return true;
  }

  // ── Pure local operations (no IPC) ───────────────────────────

  getAllVariables(): Record<string, string> {
    return this.variableManager.getAllVariables(this.state.environments, this.state.activeEnvironment);
  }

  resolveTemplate(template: string): string {
    const variables = this.getAllVariables();
    const result = this.templateResolver.resolveTemplate(template, variables, {
      logMissing: true,
      defaultValue: '',
    });
    return typeof result === 'string' ? result : (result?.resolved ?? '');
  }

  // ── Cleanup ──────────────────────────────────────────────────

  cleanup(): void {
    if (this.patchCleanup) {
      this.patchCleanup();
      this.patchCleanup = null;
    }
    this.listeners.clear();
  }
}

// Singleton
let serviceInstance: CentralizedEnvironmentService | null = null;

export function getCentralizedEnvironmentService(): CentralizedEnvironmentService {
  if (!serviceInstance) {
    serviceInstance = new CentralizedEnvironmentService();
  }
  return serviceInstance;
}

export { CentralizedEnvironmentService };
