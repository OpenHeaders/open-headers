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
import { VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Vault } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@openheaders/oracle/storage';
import { seedVault } from '@openheaders/oracle/sync-builders/vault-projection';
import { driftRecorder } from '../modules/storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { createSingletonEntityCache, type SingletonEntityCache } from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';
import { projectVaultSingleton } from './vault-post-state';

const EMPTY_VAULT: Vault = {
  schemaVersion: 5,
  secrets: [],
};

export type VaultCacheListener = () => void;

export interface VaultCache {
  readonly workspaceId: string;
  getVault(): Vault;
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
      buildSeedBatch: (vault, ctx) => seedVault(vault, ctx),
      persist: (scope, vault) => extensionStorage.set(wsKeys(scope).vault, vault),
      loadFromStorage: (scope) =>
        extensionStorage.getValidated(wsKeys(scope).vault, VaultSchema, {
          onError: driftRecorder({
            subsystem: 'vault',
            storageKey: wsKeys(scope).vault.key,
            workspaceId: scope,
          }),
        }),
    },
  );

  return {
    workspaceId: core.scope,
    getVault: core.getSnapshot,
    seedFromPersistedVault: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
