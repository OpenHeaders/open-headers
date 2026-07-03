/**
 * Vault cache + persistence sink (Phase B).
 *
 * Thin adapter over the shared `singleton-entity-cache.ts` core. Keeps
 * the entity-named API (`getVault`, `seedFromPersistedVault`) so
 * call sites (env-store local mirror, exporter, variables-resolver,
 * snapshot-RPC handler) stay unchanged.
 *
 * v1 vault is non-syncing (§12.3) — local-only by construction.
 * Schema-marked sensitive payload never leaves the device.
 */

import { VaultSchema } from '@openheaders/core/schemas';
import type { GuardedRead } from '@openheaders/core/storage';
import { VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import { seedVault } from '@openheaders/core/sync-builders/projections/vault-projection';
import type { Vault } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { projectVaultSingleton } from '../post-state/vault-post-state';

const EMPTY_VAULT: Vault = {
  schemaVersion: 5,
  secrets: [],
};

export type VaultCacheListener = () => void;

export interface VaultCache {
  readonly workspaceId: string;
  getVault(): Vault;
  /**
   * True when the persisted vault ciphertext is present but undecryptable —
   * the at-rest key was lost (IndexedDB eviction / partial clear / corruption)
   * out from under the surviving `chrome.storage.local` blob. The vault reads
   * as empty, but this is a locked-out state, not an empty vault: existing
   * secrets are unrecoverable and must be re-entered. Surfaced so the UI shows
   * a locked banner instead of an editable empty table (whose first edit would
   * silently tombstone the orphaned secrets).
   */
  isVaultLocked(): boolean;
  seedFromPersistedVault(vault: Vault): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: VaultCacheListener): () => void;
  dispose(): void;
}

export function createVaultCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): VaultCache {
  const core: SingletonEntityCache<Vault, Vault> = createSingletonEntityCache(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: VAULT_ENTITY_TYPE,
      loggerTag: 'VaultCache',
      emptySnapshot: EMPTY_VAULT,
      project: (o) => projectVaultSingleton(o)?.vault ?? null,
      isEmptySnapshot: (vault) => vault.secrets.length === 0,
      buildSeedBatch: (vault, ctx) => seedVault(vault, ctx),
      persist: (scope, vault) => hostStorage.set(wsKeys(scope).vault, vault),
      loadGuardedFromStorage: (scope) => {
        const key = wsKeys(scope).vault;
        const onError = driftRecorder({ subsystem: 'vault', storageKey: key.key, workspaceId: scope });
        // Prefer the guarded read so a lost-key blob locks the vault rather
        // than seeding empty; fall back to the plain validated read on hosts
        // whose adapter can't detect an undecryptable slot (in-memory fakes,
        // forwarding proxies) — there an undecryptable blob is impossible.
        if (hostStorage.getValidatedGuarded) {
          return hostStorage.getValidatedGuarded(key, VaultSchema, { onError });
        }
        return hostStorage
          .getValidated(key, VaultSchema, { onError })
          .then((value): GuardedRead<Vault> => (value === null ? { status: 'absent' } : { status: 'ok', value }));
      },
    },
  );

  return {
    workspaceId: core.scope,
    getVault: core.getSnapshot,
    isVaultLocked: core.isLocked,
    seedFromPersistedVault: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
