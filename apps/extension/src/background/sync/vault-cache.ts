/**
 * Vault cache + persistence sink (Phase B).
 *
 * Mirrors `workspace-variables-cache.ts` for the singleton vault
 * entity. Subscribes to the oracle's broadcast bus, re-projects the
 * materialized state on every committed vault envelope, and persists
 * the projected `V5.Vault` back to `chrome.storage.local` under the
 * workspace's `vault` key so legacy readers (env-store local mirror,
 * exporter, variables-resolver) keep working without change.
 *
 * Hydration: `seedFromPersistedVault(vault)` applies one `seedVault`
 * batch through the oracle. Boot-time replay through this same sink
 * is idempotent and byte-stable.
 *
 * v1 vault is non-syncing (§12.3) — this cache is local-only by
 * construction. Schema-marked sensitive payload never leaves the
 * device through any sync transport.
 */

import type { MaterializedEntity } from '@openheaders/core/sync';
import { VAULT_ENTITY_TYPE, VAULT_ID } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { projectVault, seedVault } from '@/shared/sync/vault-projection';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

// `version` is retired by Phase B (§24); kept on the empty default
// until commit 4 sweeps the schema field.
const EMPTY_VAULT: V5.Vault = {
  schemaVersion: 5,
  version: 1,
  secrets: [],
};

export type VaultCacheListener = () => void;

export interface VaultCache {
  readonly workspaceId: string;
  /** Snapshot of the singleton record. Returns the empty default until
   *  the oracle's first commit lands. */
  getVault(): V5.Vault;
  /** Replace the cache from a persisted singleton snapshot and seed
   *  the oracle. Drives boot-time hydration and the workspace-switch
   *  path. */
  seedFromPersistedVault(vault: V5.Vault): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. */
  onChange(listener: VaultCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createVaultCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): VaultCache {
  let snapshot: V5.Vault = EMPTY_VAULT;
  const listeners = new Set<VaultCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectSingleton(oracle.materializeAll()) ?? EMPTY_VAULT;
    snapshot = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('VaultCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== VAULT_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getVault: () => snapshot,

    async seedFromPersistedVault(persisted: V5.Vault): Promise<void> {
      const batch = seedVault(persisted, contextFactory());
      const result = await oracle.apply(batch, []);
      if (!result.ok) {
        logger.info(
          'VaultCache',
          `seedFromPersistedVault failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
        );
      }
      refreshFromOracle();
      logger.info('VaultCache', `Seeded singleton for ws=${workspaceId}`);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
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

// ── helpers ───────────────────────────────────────────────────────

function projectSingleton(materialized: MaterializedEntity[]): V5.Vault | null {
  for (const m of materialized) {
    if (m.type !== VAULT_ENTITY_TYPE) continue;
    if (m.id !== VAULT_ID) continue;
    return projectVault(m);
  }
  return null;
}

async function persist(workspaceId: string, vault: V5.Vault): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).vault, vault);
  } catch (err) {
    logger.info('VaultCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}
