/**
 * Vault write-site → oracle helpers.
 *
 * Mirrors `workspace-variables-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory in
 * `@openheaders/core/sync` and a {@link MutatorContext}. Pure transforms
 * — no oracle reads, no IO — used by both the SW (boot-time hydration
 * via the vault cache) and the renderer (`useVaultMutator` write
 * client).
 *
 * The singleton entity has no id arg on the catalog factories — every
 * call targets the fixed id internally, so these wrappers don't carry
 * one either. Vault secrets carry a stable `uid` that doubles as the
 * sync engine's itemId; `buildSetVaultSecretBatch` upserts the whole
 * record (handles add, edit, rename, kind-transition uniformly);
 * `buildRemoveVaultSecretBatch` keys by uid.
 */

import {
  type MutatorContext,
  type MutatorIntent,
  removeVaultSecret,
  setVaultSecret,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';

export type VaultMutationPayload = MutatorIntent;

export interface SetVaultSecretInput {
  /** Whole secret record. `secret.uid` is the set-member itemId. */
  secret: V5.VaultSecret;
  orderKey?: string;
}

export function buildSetVaultSecretBatch(
  input: SetVaultSecretInput,
  ctx: MutatorContext,
): VaultMutationPayload {
  return setVaultSecret(ctx, input);
}

export interface RemoveVaultSecretInput {
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export function buildRemoveVaultSecretBatch(
  input: RemoveVaultSecretInput,
  ctx: MutatorContext,
): VaultMutationPayload {
  return removeVaultSecret(ctx, input);
}
