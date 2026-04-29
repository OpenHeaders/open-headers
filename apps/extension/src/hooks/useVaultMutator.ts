/**
 * useVaultMutator — write-only API for vault edits.
 *
 * Thin React adapter over the imperative helpers in
 * `vault-write-client.ts`. Mirrors `useWorkspaceVariablesMutator` —
 * every memoised callback closes over the `(workspaceId, surfaceId)`
 * pair so a workspace switch produces fresh function references and
 * any in-flight envelope carries the workspace id it was minted under.
 *
 * Singleton entity — none of the helpers take an entity id.
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useMemo } from 'react';
import {
  applyVaultReplacement,
  applyVaultSecretRemove,
  applyVaultSecretRename,
  applyVaultSecretSet,
  type VaultSimpleResult,
} from '@/shared/sync/vault-write-client';

export type { VaultSimpleResult };

export interface UseVaultMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseVaultMutatorApi {
  setSecret(secret: V5.VaultSecret): Promise<VaultSimpleResult>;
  removeSecret(name: string): Promise<VaultSimpleResult>;
  renameSecret(oldName: string, newSecret: V5.VaultSecret): Promise<VaultSimpleResult>;
  /** Replace the full secrets list — see `applyVaultReplacement`. */
  replaceSecrets(
    newSecrets: readonly V5.VaultSecret[],
    oldSecrets: readonly V5.VaultSecret[],
  ): Promise<VaultSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useVaultMutator(opts: UseVaultMutatorOptions): UseVaultMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setSecret = useCallback<UseVaultMutatorApi['setSecret']>(
    async (secret) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyVaultSecretSet({ secret }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const removeSecret = useCallback<UseVaultMutatorApi['removeSecret']>(
    async (name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyVaultSecretRemove({ name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const renameSecret = useCallback<UseVaultMutatorApi['renameSecret']>(
    async (oldName, newSecret) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyVaultSecretRename({ oldName, newSecret }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const replaceSecrets = useCallback<UseVaultMutatorApi['replaceSecrets']>(
    async (newSecrets, oldSecrets) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyVaultReplacement(newSecrets, oldSecrets, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ setSecret, removeSecret, renameSecret, replaceSecrets }),
    [setSecret, removeSecret, renameSecret, replaceSecrets],
  );
}
