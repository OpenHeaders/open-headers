/**
 * Environment / variable / vault bridge RPCs — all scoped to the active
 * workspace. Also home to {@link EnvironmentsSnapshot}, the atomic
 * 4-scope payload the `environmentsChanged` broadcast carries.
 */

import type { Collection, Environment, Variable, Vault, WorkspaceVariables } from '../../types';

/**
 * Snapshot of every variable-scoped state the UI cares about. Emitted
 * as one atomic broadcast so consumers never see a half-applied switch
 * (new active env but old var list, etc.).
 *
 * `activeEnvironmentId` is nullable — "No environment" is a valid state;
 * resolution still works via lower scopes.
 */
export interface EnvironmentsSnapshot {
  environments: Environment[];
  activeEnvironmentId: string | null;
  /**
   * Workspace default env uid (used as the resolver fallback when the
   * active env misses a variable, or when there's no active env).
   * `null` means no default is configured.
   */
  defaultEnvironmentId: string | null;
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
  collectionEnvOverrides: Record<string, string | null>;
  /** Last env the user manually picked — consumed by the `apply-defaults` auto-switch mode. */
  manualEnvId: string | null;
}

export interface EnvironmentRpc {
  listEnvironments: {
    req: Record<string, never>;
    res: {
      environments: Environment[];
      activeEnvironmentId: string | null;
      defaultEnvironmentId: string | null;
      collectionEnvOverrides: Record<string, string | null>;
      manualEnvId: string | null;
    };
  };
  createEnvironment: {
    req: { name: string; variables?: Variable[] };
    res: { success: boolean; environment?: Environment };
  };
  renameEnvironment: {
    req: { uid: string; name: string };
    res:
      | { ok: true; environment: Environment }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  updateEnvironmentVariables: {
    req: { uid: string; variables: Variable[] };
    res:
      | { ok: true; environment: Environment }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  deleteEnvironment: {
    req: { uid: string };
    res: { success: boolean };
  };
  setCollectionPinnedEnvs: {
    req: { collectionUid: string; pinnedEnvironmentIds: string[]; defaultEnvironmentId: string | null };
    res: { success: boolean };
  };
  getWorkspaceVariables: {
    req: Record<string, never>;
    res: { workspaceVariables: WorkspaceVariables };
  };
  getVault: {
    req: Record<string, never>;
    res: { vault: Vault };
  };
  updateCollectionVariables: {
    req: {
      collectionUid: string;
      variables: Variable[];
    };
    res:
      | { ok: true; collection: Collection }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
}
