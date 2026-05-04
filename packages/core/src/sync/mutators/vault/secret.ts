/**
 * Secret intent factories for vault.
 *
 * Mirrors the shared variable mutator factory: singleton entity, no id
 * arg on the factories. Set-member identity = the secret's stable
 * `uid`. Concurrent same-row edits converge under per-(setPath, uid)
 * LWW; concurrent renames on the same uid converge on the later-HLC
 * name (one row, latest-name-wins). Earlier comments describing
 * "concurrent diverging renames produce two new entries" reflected the
 * pre-uid name-as-identity model and are wrong under this factory.
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
  /** Whole secret record. `secret.uid` is the set-member itemId. */
  secret: V5.VaultSecret;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

/**
 * Add or update a vault secret. Used uniformly for add / edit (value,
 * kind transition, name). Per-(setPath, uid) LWW means the latest
 * record for the same uid supersedes (§7.2). Whole-record replacement
 * matches the variable model; kind transitions (string → totp or vice
 * versa) fall out for free since the union is the item.
 */
export function setVaultSecret(ctx: MutatorContext, args: SetVaultSecretArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: VAULT_ENTITY_TYPE,
        id: VAULT_ID,
        path: VAULT_PATH,
        itemId: args.secret.uid,
        item: args.secret,
        orderKey: args.orderKey,
      },
    ]),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}

export interface RemoveVaultSecretArgs {
  /** The row's persisted uid — NOT its name. */
  uid: string;
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
        itemId: args.uid,
      },
    ]),
    sideEffects: [invalidateResolverIntent(ctx.hlc)],
  };
}
