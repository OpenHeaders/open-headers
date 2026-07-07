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
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import {
  keyBetween,
  mintBatch,
  type MutationBody,
  type MutationEnvelope,
  seedKey,
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
} from '../../context/mirrors/vault-sync-mirror';
import {
  buildRemoveVaultSecretBatch,
  buildSetVaultSecretBatch,
} from '@openheaders/core/sync-builders/mutations/vault-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createVaultSyncMirror } from '../../context/mirrors/vault-sync-mirror';
export type { VaultSyncMirror } from '../../context/mirrors/vault-sync-mirror';

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
 * Identity is `secret.uid`. Adds + content edits (rename / value /
 * kind-transition / totp fields) + reorders emit `addToSet`; deletions
 * emit `removeFromSet` by uid. Each surviving row's `orderKey` is assigned
 * LSEQ-style: reuse the row's current key while it keeps the running order
 * monotonic, and mint a fresh `keyBetween` only where the order breaks (a
 * moved row) or a row is new. A row unchanged in both content AND position
 * emits nothing. Empty diff → `{ ok: true }` (no fire). Mirrors
 * `applyWorkspaceVariablesReplacement`.
 */
export async function applyVaultReplacement(
  newSecrets: readonly VaultSecret[],
  oldSecrets: readonly VaultSecret[],
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  const oldByUid = new Map<string, VaultSecret>();
  for (const s of oldSecrets) oldByUid.set(s.uid, s);
  const survivors = newSecrets.filter((s) => s.name.trim());
  const newUids = new Set(survivors.map((s) => s.uid));

  // Current persisted order keys (fractional-index order). The write
  // reuses them to keep unmoved rows byte-stable across saves.
  const mirror = resolveMirror(opts, getVaultSyncMirrorForWorkspace);
  await mirror.hydrated;
  const currentKeys = new Map(mirror.liveSecretOrderKeys().map((e) => [e.itemId, e.orderKey] as const));

  // Assign each survivor an orderKey in editor order: reuse the existing
  // key when it stays strictly greater than the previous assignment,
  // otherwise mint a fresh one after `prev` (seed for the first mint).
  const assigned = new Map<string, string>();
  let prevKey: string | null = null;
  for (const s of survivors) {
    const cur = currentKeys.get(s.uid);
    const reuse = cur !== undefined && (prevKey === null || cur > prevKey);
    const key: string = reuse ? cur : prevKey === null ? seedKey() : keyBetween(prevKey, null);
    assigned.set(s.uid, key);
    prevKey = key;
  }

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `vault-replace` });

  const bodies: MutationBody[] = [];
  for (const [uid] of oldByUid) {
    if (newUids.has(uid)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: uid,
    });
  }
  for (const secret of survivors) {
    const prev = oldByUid.get(secret.uid);
    const key = assigned.get(secret.uid)!;
    const contentSame = prev && fingerprintSecret(prev) === fingerprintSecret(secret);
    const keySame = currentKeys.get(secret.uid) === key;
    if (contentSame && keySame) continue;
    bodies.push({
      kind: 'addToSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: secret.uid,
      item: secret,
      orderKey: key,
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
