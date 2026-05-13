/**
 * useEnvVarVault — aggregator for cross-cutting consumers that need
 * environments + workspace variables + vault together (variable
 * resolver, suggester, mutator, lookup, hover popover, resolution
 * banner, variables panel).
 *
 * Composes `useEnvironments()` (env-list slice, MWPT-aware via
 * `EnvironmentContext`) with the interim `useWorkspaceVariables()` and
 * `useVault()` slice hooks. Sessions #2/#3 of the MWPT-FULL epic
 * upgrade those interim slices to providers; this aggregator's surface
 * stays stable across the migration.
 */

import type { Environment, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { useEnvironments } from '@hooks/useEnvironments';
import { useVault } from '@hooks/useVault';
import { useWorkspaceVariables } from '@hooks/useWorkspaceVariables';

export interface UseEnvVarVaultApi {
  environments: Environment[];
  activeEnvironmentId: string | null;
  activeEnvironment: Environment | null;
  defaultEnvironmentId: string | null;
  defaultEnvironment: Environment | null;
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
  isReady: boolean;
  collectionEnvOverrides: Record<string, string | null>;
  manualEnvId: string | null;
}

export function useEnvVarVault(): UseEnvVarVaultApi {
  const env = useEnvironments();
  const { workspaceVariables, isReady: wsVarsReady } = useWorkspaceVariables();
  const { vault, isReady: vaultReady } = useVault();
  return {
    environments: env.environments,
    activeEnvironmentId: env.activeEnvironmentId,
    activeEnvironment: env.activeEnvironment,
    defaultEnvironmentId: env.defaultEnvironmentId,
    defaultEnvironment: env.defaultEnvironment,
    collectionEnvOverrides: env.collectionEnvOverrides,
    manualEnvId: env.manualEnvId,
    workspaceVariables,
    vault,
    isReady: env.isReady && wsVarsReady && vaultReady,
  };
}
