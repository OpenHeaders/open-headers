/**
 * useVault — vault slice hook.
 *
 * Reads from `VaultContext` (mounted by `<VaultProvider>` on every
 * surface, nested innermost in the three-sibling stack per § 4.1.b:
 * Environment → WorkspaceVariables → Vault). Workbench mounts the
 * provider with `activeWorkspaceIdOverride={editingScopeWorkspaceId}`
 * so diverged tabs editing W2 see and write to W2's vault.
 *
 * Slice surface preserves the original `{ vault, isReady }` reader
 * shape; mutators live on the context for callers that prefer the
 * in-context API.
 */

import { useVaultContext, type VaultContextValue } from '@openheaders/ui/context';

export type UseVaultApi = VaultContextValue;

export function useVault(): UseVaultApi {
  return useVaultContext();
}
