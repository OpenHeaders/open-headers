/**
 * useVaultMutator — write-only API for vault edits.
 *
 * Thin React adapter over `vault-write-client.ts`. Singleton entity —
 * none of the helpers take an entity id. Identity for secret rows is
 * `secret.uid`; `setSecret` upserts the whole record (handles add,
 * edit, rename, kind-transition uniformly), `removeSecret` keys by uid.
 */

import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import {
  applyVaultReplacement,
  applyVaultSecretRemove,
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
  /** Upsert a secret — handles add, edit, rename, kind-transition. */
  setSecret(secret: V5.VaultSecret): Promise<VaultSimpleResult>;
  /** Remove a secret by its persisted uid. */
  removeSecret(uid: string): Promise<VaultSimpleResult>;
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

  const removeSecret = useGuardedMutation(workspaceId, surfaceId, (writeOpts, uid: string) =>
    applyVaultSecretRemove({ uid }, writeOpts),
  );

  const replaceSecrets = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, newSecrets: readonly V5.VaultSecret[], oldSecrets: readonly V5.VaultSecret[]) =>
      applyVaultReplacement(newSecrets, oldSecrets, writeOpts),
  );

  return useMemo(
    () => ({ setSecret, removeSecret, replaceSecrets }),
    [setSecret, removeSecret, replaceSecrets],
  );
}
