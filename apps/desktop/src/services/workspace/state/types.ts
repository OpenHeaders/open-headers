/**
 * Shared types for WorkspaceStateService and its submodules.
 *
 * Workspace state is the single source of truth for the active workspace's
 * data in memory. The storage layer (V5StorageService) handles disk I/O.
 */

import type { V5 } from '@openheaders/core/types';
import type { Workspace, WorkspaceMetadata, WorkspaceSyncStatus } from '@/types/workspace';

// ── State shape ───────────────────────────────────────────────────

export interface WorkspaceState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  isWorkspaceSwitching: boolean;
  syncStatus: Record<string, WorkspaceSyncStatus>;
  /** Request collections with their tree structure. */
  requestCollections: V5.CollectionTree[];
  /** Rule collections with their tree structure. */
  ruleCollections: V5.CollectionTree[];
  /** All rules across all collections. */
  rules: V5.Rule[];
  /** Environments available in this workspace. */
  environments: V5.Environment[];
  /** Name of the active environment (null = no environment). */
  activeEnvironmentName: string | null;
  /** Workspace-level variables. */
  workspaceVariables: V5.WorkspaceVariables;
  /** Vault secrets (local, never synced). */
  vault: V5.Vault;
}

// ── External service interfaces ───────────────────────────────────

export interface RuleMutationCallbacks {
  toggleRule(uid: string, enabled: boolean): Promise<void>;
  removeRule(uid: string): Promise<void>;
}

export interface WebSocketServiceLike {
  /** Update rules and broadcast to connected extensions. */
  updateRules(resolvedRules: V5.Rule[]): void;
  /** Wire callbacks so extension-initiated mutations round-trip through the state service. */
  setRuleMutationCallbacks(callbacks: RuleMutationCallbacks): void;
  environmentHandler: EnvironmentResolverLike;
}

export interface EnvironmentResolverLike {
  loadEnvironmentVariables(): Record<string, string>;
  resolveTemplate(template: string, variables: Record<string, string>): string;
  setVariables(variables: Record<string, string>): void;
  clearVariableCache(): void;
}

export interface WorkspaceSyncSchedulerLike {
  activateWorkspace(workspaceId: string, options?: { skipInitialSync?: boolean }): Promise<void>;
  onWorkspaceSwitch(workspaceId: string, options?: { skipInitialSync?: boolean }): Promise<void>;
  onWorkspaceUpdated(workspaceId: string, workspace: Workspace): Promise<void>;
}

// ── Dirty tracking ────────────────────────────────────────────────

export interface DirtyFlags {
  requestCollections: boolean;
  ruleCollections: boolean;
  rules: boolean;
  environments: boolean;
  workspaceVariables: boolean;
  vault: boolean;
  workspaces: boolean;
}

// ── Context passed to CRUD submodules ─────────────────────────────

/**
 * Shared context that CRUD operations receive from the orchestrator.
 * Provides mutable access to state, dirty flags, and services without
 * coupling the submodules to the WorkspaceStateService class.
 */
export interface StateContext {
  state: WorkspaceState;
  dirty: DirtyFlags;
  workspaceRootPath: string;
  /** App data directory (for workspaces.json registry). */
  appDataPath: string;
  webSocketService: WebSocketServiceLike | null;
  envResolver: EnvironmentResolverLike | null;
  syncScheduler: WorkspaceSyncSchedulerLike | null;
  scheduleDebouncedSave(): void;
  saveAll(): Promise<void>;
  saveWorkspacesConfig(): Promise<void>;
  loadWorkspaceData(workspaceId: string): Promise<void>;
  updateWorkspaceMetadataInMemory(workspaceId: string, metadata: Partial<WorkspaceMetadata>): void;
}
