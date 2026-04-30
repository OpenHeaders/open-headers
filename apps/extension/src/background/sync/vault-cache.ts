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

import { VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { seedVault } from '@/shared/sync/vault-projection';
import type { InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import {
  createSingletonEntityCache,
  type SingletonEntityCache,
} from './singleton-entity-cache';
import type { SwMutatorContextFactory } from './sw-context';
import { projectVaultSingleton } from './vault-post-state';

const EMPTY_VAULT: V5.Vault = {
  schemaVersion: 5,
  secrets: [],
};

export type VaultCacheListener = () => void;

export interface VaultCache {
  readonly workspaceId: string;
  getVault(): V5.Vault;
  seedFromPersistedVault(vault: V5.Vault): Promise<void>;
  onChange(listener: VaultCacheListener): () => void;
  dispose(): void;
}

export function createVaultCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): VaultCache {
  const core: SingletonEntityCache<V5.Vault, V5.Vault> = createSingletonEntityCache(
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
    },
  );

  return {
    workspaceId: core.scope,
    getVault: core.getSnapshot,
    seedFromPersistedVault: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: VaultCache | null = null;

export function setActiveVaultCache(cache: VaultCache | null): void {
  active = cache;
}

export function getActiveVaultCache(): VaultCache | null {
  return active;
}
