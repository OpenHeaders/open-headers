/**
 * Conflict-tracker binding for the singleton Vault editor. Uses the
 * vault-specific adapter that handles the VaultSecret discriminated
 * union (TOTP / string).
 */

import { VAULT_ENTITY_TYPE, VAULT_ID } from '@openheaders/core/sync';
import type { Vault, VaultSecret } from '@openheaders/core/types';
import { type EntityConflictsApi, useEntityConflicts } from '@openheaders/ui/shared/conflicts/use-entity-conflicts';
import { vaultConflictAdapter } from './vault-conflict-adapter';

export interface UseVaultConflictsArgs {
  liveVault: Vault | null | undefined;
  isDirty: boolean;
  enabled: boolean;
}

/** Vault is a singleton — synthesize a `(uid)`-bearing wrapper at the
 *  binding boundary so the entity-agnostic hook's `signature(e) =>
 *  e.uid` contract still holds. The signature is stable across the
 *  whole vault lifecycle (one vault per workspace). */
type VaultWithUid = Vault & { uid: string };

function withSingletonUid(vault: Vault | null | undefined): VaultWithUid | null {
  return vault ? { ...vault, uid: VAULT_ID } : null;
}

export function useVaultConflicts(args: UseVaultConflictsArgs): EntityConflictsApi<VaultWithUid> {
  return useEntityConflicts<VaultWithUid>({
    liveEntity: withSingletonUid(args.liveVault),
    isDirty: args.isDirty,
    enabled: args.enabled,
    entityType: VAULT_ENTITY_TYPE,
    adapter: vaultConflictAdapter,
  });
}

/** Project a secrets array into the path-keyed shape the tracker
 *  expects. Editors call this with their `draft` (a VaultSecret[])
 *  to produce the `form` argument for `getAllConflicts`. */
export function projectSecretsToForm(secrets: readonly VaultSecret[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of secrets) {
    out[`secrets.${s.uid}.name`] = String(s.name ?? '');
    out[`secrets.${s.uid}.kind`] = s.kind;
    if (s.kind === 'string') {
      out[`secrets.${s.uid}.value`] = String(s.value ?? '');
    } else if (s.kind === 'client-certificate') {
      out[`secrets.${s.uid}.cert`] = String(s.cert ?? '');
      out[`secrets.${s.uid}.key`] = String(s.key ?? '');
      if (s.passphrase !== undefined) out[`secrets.${s.uid}.passphrase`] = String(s.passphrase);
    } else if (s.kind === 'secret-manager') {
      out[`secrets.${s.uid}.locator.provider`] = s.locator.provider;
      for (const [key, value] of Object.entries(s.locator)) {
        if (key === 'provider' || typeof value !== 'string') continue;
        out[`secrets.${s.uid}.locator.${key}`] = value;
      }
    } else {
      out[`secrets.${s.uid}.seed`] = String(s.seed ?? '');
      out[`secrets.${s.uid}.algorithm`] = String(s.algorithm ?? '');
      out[`secrets.${s.uid}.digits`] = String(s.digits ?? '');
      out[`secrets.${s.uid}.period`] = String(s.period ?? '');
      if (s.issuer !== undefined) out[`secrets.${s.uid}.issuer`] = String(s.issuer);
    }
  }
  return out;
}
