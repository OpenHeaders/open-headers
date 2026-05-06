/**
 * Per-envelope vault post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Renderer-side write helpers need the live secret uids before they
 * can emit matching `removeFromSet` envelopes (secret identity = name).
 *
 * The vault is §12.1 schema-marked sensitive in full; this projection
 * is consumed by the renderer mirror over the same-machine broadcast
 * channel and never crosses any sync transport (Vault is non-syncing
 * in v1, §12.3).
 */

import type { SyncVaultPostState } from '@openheaders/core/protocol';
import { VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH } from '@openheaders/core/sync';
import { projectVault } from '@/shared/sync/vault-projection';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncVaultPostState>({
  entityType: VAULT_ENTITY_TYPE,
  entityId: VAULT_ID,
  compose: (materialized, oracle) => {
    const vault = projectVault(materialized);
    if (!vault) return null;
    const secretUids = oracle.liveSetItems(VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH).map((entry) => entry.itemId);
    return { vault, secretUids };
  },
});

export const projectVaultPostState = projectors.projectPostState;
export const projectVaultSingleton = projectors.projectSingleton;
