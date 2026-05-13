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
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import {
  mintBatch,
  type MutationBody,
  type MutationEnvelope,
  type SideEffectIntent,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
  VAULT_PATH,
  vaultInvalidateResolverIntent,
} from '@openheaders/core/sync';
import type { VaultSecret } from '@openheaders/core/types';
import {
  createVaultSyncMirror,
  getVaultSyncMirrorForWorkspace,
  type VaultSyncMirror,
} from '@/context/vault-sync-mirror';
import {
  buildRemoveVaultSecretBatch,
  buildSetVaultSecretBatch,
} from '@openheaders/oracle/sync-builders/vault-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createVaultSyncMirror } from '@/context/vault-sync-mirror';

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
 * Editor convenience: persist a complete secrets list. Identity is
 * `secret.uid`. Adds + edits (rename / value / kind-transition / totp
 * fields) emit `addToSet` against the same uid; deletions emit
 * `removeFromSet` by uid. Empty diff → empty batch.
 */
export async function applyVaultReplacement(
  newSecrets: readonly VaultSecret[],
  oldSecrets: readonly VaultSecret[],
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  const oldByUid = new Map<string, VaultSecret>();
  for (const s of oldSecrets) oldByUid.set(s.uid, s);
  const newByUid = new Map<string, VaultSecret>();
  for (const s of newSecrets) {
    if (!s.name.trim()) continue;
    newByUid.set(s.uid, s);
  }

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `vault-replace` });

  const bodies: MutationBody[] = [];
  for (const [uid] of oldByUid) {
    if (newByUid.has(uid)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: uid,
    });
  }
  for (const [uid, secret] of newByUid) {
    const prev = oldByUid.get(uid);
    if (prev && fingerprintSecret(prev) === fingerprintSecret(secret)) continue;
    bodies.push({
      kind: 'addToSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: uid,
      item: secret,
    });
  }

  if (bodies.length === 0) return { ok: true };

  const sideEffects: SideEffectIntent[] = [vaultInvalidateResolverIntent(ctx.hlc)];
  const batch = mintBatch(ctx, bodies);
  return applySyncPayload({ batch, sideEffects });
}

export type { MutationEnvelope };

export function activeMirror(workspaceId: string): VaultSyncMirror {
  return getVaultSyncMirrorForWorkspace(workspaceId);
}

// ── Internals ─────────────────────────────────────────────────────

function fingerprintSecret(s: VaultSecret): string {
  return s.kind === 'totp'
    ? JSON.stringify(['totp', s.name, s.seed, s.algorithm, s.digits, s.period, s.issuer ?? ''])
    : JSON.stringify(['string', s.name, s.value]);
}
