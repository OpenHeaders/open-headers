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
 * one either.
 */

import {
  type MutatorContext,
  type MutatorIntent,
  removeVaultSecret,
  renameVaultSecret,
  setVaultSecret,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';

export type VaultMutationPayload = MutatorIntent;

export interface SetVaultSecretInput {
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
  name: string;
}

export function buildRemoveVaultSecretBatch(
  input: RemoveVaultSecretInput,
  ctx: MutatorContext,
): VaultMutationPayload {
  return removeVaultSecret(ctx, input);
}

export interface RenameVaultSecretInput {
  oldName: string;
  newSecret: V5.VaultSecret;
  orderKey?: string;
}

export function buildRenameVaultSecretBatch(
  input: RenameVaultSecretInput,
  ctx: MutatorContext,
): VaultMutationPayload {
  return renameVaultSecret(ctx, input);
}
