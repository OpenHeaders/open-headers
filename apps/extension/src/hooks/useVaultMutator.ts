/**
 * useVaultMutator — write-only API for vault edits.
 *
 * Thin React adapter over `vault-write-client.ts`. Singleton entity —
 * none of the helpers take an entity id.
 */

import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import {
  applyVaultReplacement,
  applyVaultSecretRemove,
  applyVaultSecretRename,
  applyVaultSecretSet,
  type VaultSimpleResult,
} from '@/shared/sync/vault-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

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

export function useVaultMutator(opts: UseVaultMutatorOptions): UseVaultMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setSecret = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, secret: V5.VaultSecret) => applyVaultSecretSet({ secret }, writeOpts),
  );

  const removeSecret = useGuardedMutation(workspaceId, surfaceId, (writeOpts, name: string) =>
    applyVaultSecretRemove({ name }, writeOpts),
  );

  const renameSecret = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, oldName: string, newSecret: V5.VaultSecret) =>
      applyVaultSecretRename({ oldName, newSecret }, writeOpts),
  );

  const replaceSecrets = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, newSecrets: readonly V5.VaultSecret[], oldSecrets: readonly V5.VaultSecret[]) =>
      applyVaultReplacement(newSecrets, oldSecrets, writeOpts),
  );

  return useMemo(
    () => ({ setSecret, removeSecret, renameSecret, replaceSecrets }),
    [setSecret, removeSecret, renameSecret, replaceSecrets],
  );
}
