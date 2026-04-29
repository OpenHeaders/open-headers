/**
 * Vault projection — `V5.Vault ⇄ MutationBatch / MaterializedEntity`.
 *
 * Mirrors `workspace-variables-projection.ts` for the singleton vault
 * entity. The oracle stores secrets as set members at `secrets` (set
 * member identity = secret name); persisted `V5.Vault.secrets` is a
 * plain array of `VaultSecret` (kind: 'string' | 'totp').
 * `seedVault` strips the `secrets` array off the create payload and
 * emits one `addToSet` per secret (itemId = name); `projectVault` is
 * the inverse.
 *
 * There is exactly one materialized record per workspace at the fixed
 * id `VAULT_ID`. The seed function takes no id — singletons don't
 * have one to thread.
 */

import type { V5 } from '@openheaders/core/types';
import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
  VAULT_PATH,
} from '@openheaders/core/sync';

/**
 * Convert a persisted `V5.Vault` into a `MutationBatch` of one `create`
 * for the scalar shell plus one `addToSet` per secret. All-or-nothing
 * under the oracle's per-entity lock.
 */
export function seedVault(vault: V5.Vault, ctx: MutatorContext): MutationBatch {
  const shell = stripSecrets(vault);

  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      payload: shell,
    },
  ];
  for (const secret of vault.secrets) {
    bodies.push({
      kind: 'addToSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: secret.name,
      item: secret,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` (the oracle's snapshot of the
 * singleton) back into a `V5.Vault`. Returns `null` when the
 * materialized data fails basic shape checks.
 */
export function projectVault(materialized: MaterializedEntity): V5.Vault | null {
  if (materialized.type !== VAULT_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as V5.Vault;
}

// ── internals ─────────────────────────────────────────────────────

function stripSecrets(vault: V5.Vault): unknown {
  const shell = JSON.parse(JSON.stringify(vault)) as Record<string, unknown>;
  delete shell.secrets;
  return shell;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
