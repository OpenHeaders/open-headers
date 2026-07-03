/**
 * useEnvironments — env-list-slice hook.
 *
 * Reads from `EnvironmentContext` (mounted by `<EnvironmentProvider>` on
 * every surface). The provider owns the state instance; this hook is a
 * thin context reader so consumer call sites stay unchanged across the
 * MWPT-FULL session #1 migration. Workbench surfaces mount the provider
 * with `activeWorkspaceIdOverride={editingScopeWorkspaceId}` so diverged
 * tabs editing workspace W2 see and write to W2's env list (entity CRUD
 * routes through `env-write-client` with the explicit workspaceId).
 *
 * Cross-cutting consumers that need workspace variables / vault read
 * those slices via `useWorkspaceVariables()` / `useVault()`, or the
 * aggregator `useEnvVarVault()` for "I need everything" cases.
 */

import {
  type EnvironmentContextValue,
  type EnvironmentWriteResult,
  useEnvironmentContext,
} from '@openheaders/ui/context';

export type { EnvironmentWriteResult };
export type UseEnvironmentsApi = EnvironmentContextValue;

export function useEnvironments(): UseEnvironmentsApi {
  return useEnvironmentContext();
}
