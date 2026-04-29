/**
 * Secret intent factories for vault.
 *
 * Mirrors `workspace-variables/variable.ts` — singleton entity, no id
 * arg on the factories. Set-member identity = secret name. Concurrent
 * same-name edits converge under per-(setPath, name) LWW; concurrent
 * diverging renames produce two new entries.
 *
 * Vault items diverge from `Variable`: `VaultSecret` is a discriminated
 * union over `kind: 'string' | 'totp'`, with TOTP entries carrying RFC
 * 6238 fields (seed/algorithm/digits/period/issuer). The factories
 * accept the full `VaultSecret` record so callers can place either kind
 * in one shape.
 *
 * Factoring decision (4-instances-deep): a shared `variable-set`
 * factory across env / collection / workspace-vars / vault would have
 * to abstract over both the id-resolution shape (id-arg vs singleton)
 * and the item shape (Variable vs VaultSecret). The two combine to
 * make the factor ungainly — wrapping arg translators is the wrong
 * shape (see project memory `feedback_no_workarounds.md`). Keep
 * concrete catalogs; the pattern is recognizable and ≤50-line bodies.
 */

import type { V5 } from '../../../types';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import { VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH } from './types';

export interface SetVaultSecretArgs {
  secret: V5.VaultSecret;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

/**
 * Add or update a vault secret. Idempotent on (name) — a subsequent
 * `setVaultSecret` for the same name supersedes via per-itemId LWW
 * (§7.2). Whole-record replacement matches the env / collection /
 * workspace-var model; kind transitions (string → totp or vice versa)
 * fall out for free since the union is the item.
 */
export function setVaultSecret(ctx: MutatorContext, args: SetVaultSecretArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: VAULT_ENTITY_TYPE,
        id: VAULT_ID,
        path: VAULT_PATH,
        itemId: args.secret.name,
        item: args.secret,
        orderKey: args.orderKey,
      },
    ]),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}

export interface RemoveVaultSecretArgs {
  name: string;
}

/**
 * Tombstone a vault secret. The tombstone retains for the configured
 * TTL (§9.2) so reconnecting offline nodes don't resurrect the entry
 * via a stale `setVaultSecret` at lower HLC.
 */
export function removeVaultSecret(ctx: MutatorContext, args: RemoveVaultSecretArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: VAULT_ENTITY_TYPE,
        id: VAULT_ID,
        path: VAULT_PATH,
        itemId: args.name,
      },
    ]),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}

export interface RenameVaultSecretArgs {
  oldName: string;
  /** Carries the full secret payload (with the new name) so the new entry
   *  preserves the value/kind/TOTP parameters across the rename. */
  newSecret: V5.VaultSecret;
  orderKey?: string;
}

/**
 * Atomic rename — emitted as a single batch so the local oracle's
 * per-batch all-or-nothing (§11.2) guarantees observers never see the
 * "old removed but new not yet added" intermediate state. Rename to
 * the same name returns an empty batch (no broadcast, no recompile).
 */
export function renameVaultSecret(ctx: MutatorContext, args: RenameVaultSecretArgs): MutatorIntent {
  if (args.oldName === args.newSecret.name) {
    return { batch: mintBatch(ctx, []), sideEffects: [] };
  }
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: args.oldName,
    },
    {
      kind: 'addToSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: args.newSecret.name,
      item: args.newSecret,
      orderKey: args.orderKey,
    },
  ];
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}
