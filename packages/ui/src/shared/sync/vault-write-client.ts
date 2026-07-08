/**
 * Renderer-side imperative entry point for vault writes.
 *
 * Mirrors `workspace-variables-write-client.ts` for the singleton vault
 * entity. Each helper builds a `MutationBatch` against the active vault
 * mirror and fires `oh.sync.apply` directly — no SW round-trip per
 * primitive, no `setVault` shim. The §19.4 synchronous-render
 * discipline lives in the editor; this module is what the editor
 * reaches for once the user commits.
 *
 * Identity is `secret.uid`. `applyVaultSecretSet` upserts the whole
 * record (handles add, edit, rename, kind-transition uniformly);
 * `applyVaultSecretRemove` keys by uid; `applyVaultReplacement` diffs
 * two lists by uid.
 *
 * Vault is non-syncing in v1 (§12.3); the apply pipe is local-only and
 * the schema-marked-sensitive payload never crosses any sync transport.
 */

import {
  type MutationEnvelope,
  mintBatch,
  type SideEffectIntent,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
  VAULT_PATH,
  vaultInvalidateResolverIntent,
} from '@openheaders/core/sync';
import { synthesizeSetDiff, toLiveSetEntries } from '@openheaders/core/sync-builders';
import {
  buildRemoveVaultSecretBatch,
  buildSetVaultSecretBatch,
} from '@openheaders/core/sync-builders/mutations/vault-mutations';
import type { VaultSecret } from '@openheaders/core/types';
import { getVaultSyncMirrorForWorkspace, type VaultSyncMirror } from '../../context/mirrors/vault-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type { VaultSyncMirror } from '../../context/mirrors/vault-sync-mirror';
// Re-exported so tests can construct a mirror without going through the singleton.
export { createVaultSyncMirror } from '../../context/mirrors/vault-sync-mirror';

export type VaultSimpleResult = SyncSimpleResult;

export interface VaultWriteOptions extends BaseSyncWriteOptions {
  mirror?: VaultSyncMirror;
}

export interface ApplyVaultSecretSetInput {
  /** Whole secret record. `secret.uid` is the set-member itemId. */
  secret: VaultSecret;
}

export async function applyVaultSecretSet(
  input: ApplyVaultSecretSetInput,
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetVaultSecretBatch({ secret: input.secret }, ctx));
}

export interface ApplyVaultSecretRemoveInput {
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export async function applyVaultSecretRemove(
  input: ApplyVaultSecretRemoveInput,
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveVaultSecretBatch({ uid: input.uid }, ctx));
}

/**
 * Editor convenience: persist a complete secrets list, preserving the
 * editor's row ORDER as fractional-index `orderKey`s (§23.5) so the set
 * materializes back in the same order the user sees — not uid-sorted.
 *
 * Identity is `secret.uid`. The diff is {@link synthesizeSetDiff} — the
 * same LIS-optimal synthesizer the rule / request / template set paths
 * use: `removeFromSet` for deleted uids, `addToSet` (with `orderKey`) for
 * adds + content edits (rename / value / kind-transition / totp fields —
 * structural equality over the whole record, matching the editor's dirty
 * fingerprint), a minimal set of `moveBefore` envelopes for pure
 * reorders. A row unchanged in both content AND position emits nothing.
 * Empty diff → `{ ok: true }` (no fire). Mirrors
 * `applyWorkspaceVariablesReplacement`.
 */
export async function applyVaultReplacement(
  newSecrets: readonly VaultSecret[],
  oldSecrets: readonly VaultSecret[],
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  // Current persisted order keys (fractional-index order). The diff
  // reuses them to keep unmoved rows byte-stable across saves.
  const mirror = resolveMirror(opts, getVaultSyncMirrorForWorkspace);
  await mirror.hydrated;
  const currentKeys = new Map(mirror.liveSecretOrderKeys().map((e) => [e.itemId, e.orderKey] as const));

  const bodies = synthesizeSetDiff({
    type: VAULT_ENTITY_TYPE,
    id: VAULT_ID,
    path: VAULT_PATH,
    live: toLiveSetEntries(oldSecrets, currentKeys),
    newItems: newSecrets.filter((s) => s.name.trim()),
  });
  if (bodies.length === 0) return { ok: true };

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `vault-replace` });

  const sideEffects: SideEffectIntent[] = [vaultInvalidateResolverIntent(ctx.hlc)];
  const batch = mintBatch(ctx, bodies);
  return applySyncPayload({ batch, sideEffects });
}

export type { MutationEnvelope };

export function activeMirror(workspaceId: string): VaultSyncMirror {
  return getVaultSyncMirrorForWorkspace(workspaceId);
}
