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
 * `applyVaultReplacement` is the editor convenience: take the editor's
 * pre-image (`oldSecrets`) + post-image (`newSecrets`) and fold them
 * into the catalog primitives — `setVaultSecret` for adds/changes and
 * `removeVaultSecret` for deletions, all bundled under one `batchId`
 * so the oracle's per-batch all-or-nothing kicks in.
 *
 * Vault is non-syncing in v1 (§12.3); the apply pipe is local-only and
 * the schema-marked-sensitive payload never crosses any sync transport.
 */

import { applySyncPayload, type SyncSimpleResult } from '@/shared/sync/apply-payload';
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
import type { V5 } from '@openheaders/core/types';
import {
  ensureRendererContext,
  type RendererContextHandle,
} from '@/context/renderer-mutator-context';
import {
  createVaultSyncMirror,
  getActiveVaultSyncMirror,
  type VaultSyncMirror,
} from '@/context/vault-sync-mirror';
import {
  buildRemoveVaultSecretBatch,
  buildRenameVaultSecretBatch,
  buildSetVaultSecretBatch,
} from '@/shared/sync/vault-mutations';

// Re-exported so tests can construct a mirror without going through the singleton.
export { createVaultSyncMirror } from '@/context/vault-sync-mirror';

export type VaultSimpleResult = SyncSimpleResult;

export interface VaultWriteOptions {
  workspaceId: string;
  surfaceId: string;
  batchId?: string;
  mirror?: VaultSyncMirror;
  context?: RendererContextHandle;
}

function resolveContext(opts: VaultWriteOptions): RendererContextHandle {
  if (opts.context) return opts.context;
  return ensureRendererContext({ workspaceId: opts.workspaceId, surfaceId: opts.surfaceId });
}

export interface ApplyVaultSecretSetInput {
  secret: V5.VaultSecret;
}

export async function applyVaultSecretSet(
  input: ApplyVaultSecretSetInput,
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetVaultSecretBatch({ secret: input.secret }, ctx));
}

export interface ApplyVaultSecretRemoveInput {
  name: string;
}

export async function applyVaultSecretRemove(
  input: ApplyVaultSecretRemoveInput,
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveVaultSecretBatch({ name: input.name }, ctx));
}

export interface ApplyVaultSecretRenameInput {
  oldName: string;
  newSecret: V5.VaultSecret;
}

export async function applyVaultSecretRename(
  input: ApplyVaultSecretRenameInput,
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  const ctx = resolveContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameVaultSecretBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete secrets list. The caller
 * passes the editor's pre-image (`oldSecrets`) so the helper computes
 * the diff. Adds + value/kind/totp-field changes emit `addToSet`;
 * deletions emit `removeFromSet`. Empty diff → empty batch (no
 * broadcast, no recompile). VaultSecret records are compared by deep
 * fingerprint so kind transitions (string ↔ totp) and TOTP-field edits
 * both land as a single replacement under per-(setPath, name) LWW.
 */
export async function applyVaultReplacement(
  newSecrets: readonly V5.VaultSecret[],
  oldSecrets: readonly V5.VaultSecret[],
  opts: VaultWriteOptions,
): Promise<VaultSimpleResult> {
  const oldByName = new Map<string, V5.VaultSecret>();
  for (const s of oldSecrets) oldByName.set(s.name, s);
  const newByName = new Map<string, V5.VaultSecret>();
  for (const s of newSecrets) {
    if (!s.name.trim()) continue;
    newByName.set(s.name, s);
  }

  const ctx = resolveContext(opts).next({ batchId: opts.batchId ?? `vault-replace` });

  const bodies: MutationBody[] = [];
  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: name,
    });
  }
  for (const [name, secret] of newByName) {
    const prev = oldByName.get(name);
    if (prev && fingerprintSecret(prev) === fingerprintSecret(secret)) continue;
    bodies.push({
      kind: 'addToSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: name,
      item: secret,
    });
  }

  if (bodies.length === 0) return { ok: true };

  const sideEffects: SideEffectIntent[] = [vaultInvalidateResolverIntent(ctx.hlc)];
  const batch = mintBatch(ctx, bodies);
  return applySyncPayload({ batch, sideEffects });
}

export type { MutationEnvelope };

export function activeMirror(): VaultSyncMirror {
  return getActiveVaultSyncMirror();
}

// ── Internals ─────────────────────────────────────────────────────

function fingerprintSecret(s: V5.VaultSecret): string {
  return s.kind === 'totp'
    ? JSON.stringify(['totp', s.name, s.seed, s.algorithm, s.digits, s.period, s.issuer ?? ''])
    : JSON.stringify(['string', s.name, s.value]);
}
