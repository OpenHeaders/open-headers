/**
 * useWorkspaceVariables — workspace-vars slice hook.
 *
 * Reads from `WorkspaceVariablesContext` (mounted by
 * `<WorkspaceVariablesProvider>` on every surface, nested inside
 * `EnvironmentProvider` per § 4.1.b). Workbench mounts the provider
 * with `activeWorkspaceIdOverride={editingScopeWorkspaceId}` so
 * diverged tabs editing W2 see and write to W2's workspace variables.
 *
 * Slice surface preserves the original
 * `{ workspaceVariables, isReady }` reader shape; mutators live on the
 * context and are exposed for callers that prefer the in-context API
 * (existing `useWorkspaceVariablesMutator` callers stay on that path).
 */

import {
  type WorkspaceVariablesContextValue,
  useWorkspaceVariablesContext,
} from '@context/WorkspaceVariablesContext';

export type UseWorkspaceVariablesApi = WorkspaceVariablesContextValue;

export function useWorkspaceVariables(): UseWorkspaceVariablesApi {
  return useWorkspaceVariablesContext();
}
