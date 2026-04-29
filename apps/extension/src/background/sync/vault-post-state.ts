/**
 * Per-envelope vault post-state projection (Phase B).
 *
 * Same shape as `workspace-variables-post-state.ts` for the singleton
 * vault entity. Renderer-side write helpers need the live secret names
 * before they can emit matching `removeFromSet` envelopes (secret
 * identity = name). Tombstoned (singleton deletion is not a production
 * gesture) and non-matching envelopes return `null`.
 *
 * The vault is §12.1 schema-marked sensitive in full; this projection
 * is consumed by the renderer mirror over the same-machine broadcast
 * channel and never crosses any sync transport (Vault is non-syncing
 * in v1, §12.3).
 */

import type { SyncVaultPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH } from '@openheaders/core/sync';
import { projectVault } from '@/shared/sync/vault-projection';
import type { EntityOracle } from './oracle';

/**
 * Build the vault post-state for `envelope` using `oracle`. Returns
 * `null` for non-matching envelopes, deletes (entity tombstoned), and
 * any envelope whose materialized record fails to project.
 */
export function projectVaultPostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncVaultPostState | null {
  if (envelope.body.type !== VAULT_ENTITY_TYPE) return null;
  return projectVaultSingleton(oracle);
}

/**
 * Build the vault post-state for the singleton entity. Used by the
 * snapshot RPC to seed freshly-mounted renderer mirrors before the
 * next live broadcast lands. Returns `null` when the singleton hasn't
 * been materialized yet (cold oracle prior to seed).
 */
export function projectVaultSingleton(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
): SyncVaultPostState | null {
  const materialized = oracle.materializeOne(VAULT_ENTITY_TYPE, VAULT_ID);
  if (!materialized) return null;

  const vault = projectVault(materialized);
  if (!vault) return null;

  const secretNames = oracle
    .liveSetItems(VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH)
    .map((entry) => entry.itemId);

  return { vault, secretNames };
}
