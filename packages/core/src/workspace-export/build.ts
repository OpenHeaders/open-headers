/**
 * Pure builder for the workspace-export envelope.
 *
 * No storage reads, no platform deps — the SW caller hands the builder
 * the data it wants exported. Tests can call this directly with hand-
 * built fixtures to assert envelope shape, ordering, and strip rules.
 *
 * Vault include modes (design §3.1 / §3.2 / §3.3):
 *   - `omitted` (default) — vault dropped from the envelope.
 *   - `encrypted` — caller pre-encrypts via `encryptVaultBlock(...)` and
 *     passes the resulting `ExportSecrets` as `secretsBlock`. Builder
 *     drops `entities.vault` (the plaintext form would defeat the
 *     encryption) and emits the `secrets` block instead.
 *   - `plaintext` — vault is carried verbatim under `entities.vault`,
 *     red banner in the modal warns the user. Builder refuses this mode
 *     when `destination === 'deep-link'` (plaintext secrets in URL
 *     history would leak).
 *
 * What the builder strips (every export, regardless of scope):
 *   - OAuth2 `clientSecret` from any `Request.auth.type === 'oauth2'`
 *     (always — recipient enters their own at first auth, per §3.1).
 *   - `path` reconstructed from `toFolderName(name, uid)` so the value
 *     is canonical regardless of what the caller passed in.
 *
 * Encryption is split out into `encryptVaultBlock` (async, lives next to
 * the rest of `crypto.ts`) so the builder stays a pure synchronous
 * function: encryption needs WebCrypto's promise API, and we don't want
 * the whole builder API surface to go async for one optional feature.
 */

import * as v from 'valibot';
import { VaultSecretSchema } from '../schemas/index';
import type {
  Collection,
  Environment,
  Folder,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  Template,
  Vault,
  VaultSecret,
  WorkspaceVariables,
} from '../types/v5/index';
import { generateUid, toFolderName } from '../utils/workspace';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  ciphertextFingerprint,
  decryptWithPassphrase,
  deriveKey,
  encryptWithPassphrase,
  keyFingerprint,
} from './crypto';
import {
  CURRENT_EXPORT_FORMAT_VERSION,
  type ExportRedactionMode,
  type ExportSecrets,
  type WorkspaceExport,
} from './schema';

// ── Builder input ───────────────────────────────────────────────────

export interface BuildWorkspaceExportInput {
  /** Caller-resolved `now`, so tests can pin `exportedAt`. */
  exportedAt: string;
  /** Caller-resolved `exportId`; defaults to a fresh uid if omitted. */
  exportId?: string;
  source: {
    app: 'extension' | 'desktop';
    appVersion: string;
    platform: 'chrome' | 'firefox' | 'edge' | 'safari' | 'electron';
    workspaceLabel?: string;
  };
  scope: 'workspace' | 'collection' | 'selection';
  notes?: string;
  workspace: {
    uid: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    defaultEnvironmentId?: string;
  };
  entities: {
    collections: Collection[];
    folders: Folder[];
    rules: Rule[];
    requests: Request[];
    templates: Template[];
    environments: Environment[];
    workspaceVars: WorkspaceVariables;
    liveWorkflows: LiveWorkflow[];
    liveVariables: LiveVariable[];
    /**
     * Vault. Carried verbatim when `vaultMode === 'plaintext'`, dropped
     * when `'omitted'`, replaced by the encrypted `secretsBlock` when
     * `'encrypted'`.
     */
    vault?: Vault;
  };
}

export type ExportDestination = 'file' | 'clipboard' | 'deep-link';

export interface BuildWorkspaceExportOptions {
  /** Vault include mode; defaults to `'omitted'`. */
  vaultMode?: ExportRedactionMode;
  /**
   * Required when `vaultMode === 'encrypted'`. Caller pre-computes via
   * `encryptVaultBlock(input.entities.vault.secrets, passphrase, ...)`
   * and passes the result here. The builder doesn't take the passphrase
   * directly — that keeps the builder synchronous and isolates crypto
   * to one well-tested helper.
   */
  secretsBlock?: ExportSecrets;
  /**
   * The intended destination, used to enforce deep-link policy:
   * plaintext-vault exports are refused for `'deep-link'` because the
   * URL would land in browser history (design §3.3).
   */
  destination?: ExportDestination;
}

/** Thrown when caller attempts a plaintext-vault export to a deep-link. */
export class PlaintextDeepLinkRefusedError extends Error {
  constructor() {
    super(
      'Plaintext-vault exports are refused on the deep-link destination because the URL would land in browser history. Use the file or clipboard destination, or switch to encrypted include.',
    );
    this.name = 'PlaintextDeepLinkRefusedError';
  }
}

/** Thrown when caller specifies `vaultMode: 'encrypted'` without `secretsBlock`. */
export class MissingSecretsBlockError extends Error {
  constructor() {
    super('vaultMode "encrypted" requires opts.secretsBlock — caller must pre-compute via encryptVaultBlock(...).');
    this.name = 'MissingSecretsBlockError';
  }
}

// ── Strip helpers ───────────────────────────────────────────────────

function stripOAuthClientSecret<R extends Request>(req: R): R {
  if (req.auth?.type !== 'oauth2') return req;
  const { clientSecret: _omitted, ...authWithoutSecret } = req.auth;
  return { ...req, auth: authWithoutSecret } as R;
}

function canonicalLeafPath(currentPath: string | undefined, name: string, uid: string): string {
  const leaf = toFolderName(name, uid);
  if (!currentPath) return leaf;
  const idx = currentPath.lastIndexOf('/');
  if (idx === -1) return leaf;
  return `${currentPath.substring(0, idx)}/${leaf}`;
}

function withCanonicalPath<E extends { name: string; uid: string; path?: string }>(entity: E): E {
  return { ...entity, path: canonicalLeafPath(entity.path, entity.name, entity.uid) };
}

// ── Build ───────────────────────────────────────────────────────────

export function buildWorkspaceExport(
  input: BuildWorkspaceExportInput,
  opts: BuildWorkspaceExportOptions = {},
): WorkspaceExport {
  const vaultMode: ExportRedactionMode = opts.vaultMode ?? 'omitted';

  if (vaultMode === 'plaintext' && opts.destination === 'deep-link') {
    throw new PlaintextDeepLinkRefusedError();
  }
  if (vaultMode === 'encrypted' && !opts.secretsBlock) {
    throw new MissingSecretsBlockError();
  }

  const requests = input.entities.requests.map((req) => withCanonicalPath(stripOAuthClientSecret(req)));
  const collections = input.entities.collections.map(withCanonicalPath);
  const folders = input.entities.folders.map(withCanonicalPath);
  const rules = input.entities.rules.map(withCanonicalPath);
  const templates = input.entities.templates.map(withCanonicalPath);
  const environments = input.entities.environments.map(withCanonicalPath);

  // Vault inclusion: `plaintext` carries `entities.vault`; `encrypted`
  // and `omitted` drop it.
  const vault: Vault | undefined = vaultMode === 'plaintext' ? input.entities.vault : undefined;
  const secretCount =
    vaultMode === 'plaintext'
      ? (input.entities.vault?.secrets.length ?? 0)
      : vaultMode === 'encrypted'
        ? // Encrypted block opacifies the count — but the caller knows
          // how many they encrypted; surface it through `meta.counts`
          // so recipients can see "N secrets" without decrypting.
          (input.entities.vault?.secrets.length ?? 0)
        : 0;

  const exportObj: WorkspaceExport = {
    kind: 'workspace-export',
    schemaVersion: 5,
    exportFormatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportId: input.exportId ?? generateUid(),
    exportedAt: input.exportedAt,
    source: {
      app: input.source.app,
      appVersion: input.source.appVersion,
      platform: input.source.platform,
      ...(input.source.workspaceLabel !== undefined ? { workspaceLabel: input.source.workspaceLabel } : {}),
    },
    scope: input.scope,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    workspace: {
      uid: input.workspace.uid,
      name: input.workspace.name,
      ...(input.workspace.description !== undefined ? { description: input.workspace.description } : {}),
      ...(input.workspace.color !== undefined ? { color: input.workspace.color } : {}),
      ...(input.workspace.icon !== undefined ? { icon: input.workspace.icon } : {}),
      ...(input.workspace.defaultEnvironmentId !== undefined
        ? { defaultEnvironmentId: input.workspace.defaultEnvironmentId }
        : {}),
    },
    entities: {
      collections,
      folders,
      environments,
      workspaceVars: input.entities.workspaceVars,
      templates,
      requests,
      rules,
      liveWorkflows: input.entities.liveWorkflows,
      liveVariables: input.entities.liveVariables,
      ...(vault ? { vault } : {}),
    },
    ...(opts.secretsBlock && vaultMode === 'encrypted' ? { secrets: opts.secretsBlock } : {}),
    meta: {
      redactions: {
        vault: vaultMode,
        liveCache: 'omitted',
        oauthTokens: 'omitted',
        totpCooldowns: 'omitted',
      },
      counts: {
        rules: rules.length,
        requests: requests.length,
        environments: environments.length,
        liveWorkflows: input.entities.liveWorkflows.length,
        liveVariables: input.entities.liveVariables.length,
        templates: templates.length,
        secrets: secretCount,
      },
    },
  };

  return exportObj;
}

// ── Vault encryption helper (async; isolated from the builder) ──────

export interface EncryptVaultBlockResult {
  block: ExportSecrets;
  /** 8-byte SHA-256 prefix of the ciphertext bytes, displayed as `XX:..`. */
  ciphertextFingerprint: string;
  /** 3-byte HKDF fingerprint of the derived key, displayed as `XX:XX:XX`. */
  keyFingerprint: string;
}

export interface EncryptVaultBlockOptions {
  iterations?: number;
  hint?: string;
}

/**
 * Encrypt a `Vault.secrets` array under a passphrase and return the
 * `ExportSecrets` envelope shape ready to drop into `buildWorkspaceExport`'s
 * `secretsBlock` option.
 *
 * The plaintext shape inside the ciphertext is `{"vault": VaultSecret[]}` —
 * a single JSON object so future revisions can carry sibling fields under
 * the same `kind`. UTF-8 encoded.
 *
 * Returns both fingerprints so the export modal can show them to the
 * sender post-encrypt; the recipient computes the key fingerprint at
 * preview time after passphrase entry to verify "we typed the same
 * passphrase" (design §3.2).
 */
export async function encryptVaultBlock(
  secrets: import('../types/v5/index').VaultSecret[],
  passphrase: string,
  opts: EncryptVaultBlockOptions = {},
): Promise<EncryptVaultBlockResult> {
  const plaintextBytes = new TextEncoder().encode(JSON.stringify({ vault: secrets }));
  const env = await encryptWithPassphrase(plaintextBytes, passphrase, { iterations: opts.iterations });
  const block: ExportSecrets = {
    encryption: {
      kind: 'pbkdf2-aes-gcm',
      salt: bytesToBase64Url(env.salt),
      iv: bytesToBase64Url(env.iv),
      iterations: env.iterations,
      ...(opts.hint !== undefined ? { hint: opts.hint } : {}),
    },
    ciphertext: bytesToBase64Url(env.ciphertext),
  };
  const ctFp = await ciphertextFingerprint(env.ciphertext);
  // Re-derive key bits to compute the fingerprint. We could thread the
  // raw bits out of `encryptWithPassphrase` but encryption is one-shot;
  // the extra derive runs on the sender's machine at export time only.
  const { rawBits } = await deriveKey(passphrase, env.salt, env.iterations);
  const keyFp = await keyFingerprint(rawBits);
  return { block, ciphertextFingerprint: ctFp, keyFingerprint: keyFp };
}

// ── Vault decryption helper ─────────────────────────────────────────

/** Thrown when AES-GCM authentication fails — wrong passphrase or
 *  tampered ciphertext (the two are indistinguishable to AES-GCM). */
export class VaultDecryptionFailedError extends Error {
  constructor() {
    super('Could not decrypt the vault block — wrong passphrase or tampered ciphertext.');
    this.name = 'VaultDecryptionFailedError';
  }
}

/** Thrown when decryption succeeded but the plaintext didn't shape up
 *  as `{ vault: VaultSecret[] }`. Distinct from a wrong-passphrase
 *  failure — implies the export was built with a future-incompatible
 *  payload shape under the same `kind` discriminator. */
export class VaultPayloadShapeError extends Error {
  constructor(detail: string) {
    super(`Decrypted vault payload doesn't match the expected shape: ${detail}`);
    this.name = 'VaultPayloadShapeError';
  }
}

export interface DecryptVaultBlockResult {
  secrets: VaultSecret[];
  /** Per-entry validation drops — well-formed payload but one secret
   *  inside didn't validate. UI surfaces as "could not decrypt" the
   *  same way as a single-entry failure (design §3.2). */
  drops: { index: number; reason: string }[];
  keyFingerprint: string;
  ciphertextFingerprint: string;
}

/**
 * Decrypt the `secrets` block produced by `encryptVaultBlock`. Throws
 * `VaultDecryptionFailedError` on wrong passphrase / tampered
 * ciphertext, `VaultPayloadShapeError` if the plaintext decoded but
 * isn't the `{vault: VaultSecret[]}` shape.
 *
 * Per-secret validation drops surface in `result.drops` rather than
 * throwing — same fail-soft posture as gate 6 in `parseWorkspaceExport`.
 */
export async function decryptVaultBlock(block: ExportSecrets, passphrase: string): Promise<DecryptVaultBlockResult> {
  if (block.encryption.kind !== 'pbkdf2-aes-gcm') {
    throw new VaultPayloadShapeError(`unsupported encryption.kind '${block.encryption.kind}'`);
  }
  const salt = base64UrlToBytes(block.encryption.salt);
  const iv = base64UrlToBytes(block.encryption.iv);
  const ciphertext = base64UrlToBytes(block.ciphertext);
  let plaintext: Uint8Array;
  try {
    plaintext = await decryptWithPassphrase(
      { salt, iv, iterations: block.encryption.iterations, ciphertext },
      passphrase,
    );
  } catch {
    throw new VaultDecryptionFailedError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch (err) {
    throw new VaultPayloadShapeError(err instanceof Error ? err.message : 'JSON parse failed');
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { vault?: unknown }).vault)) {
    throw new VaultPayloadShapeError('expected `{ vault: VaultSecret[] }`');
  }
  const rawSecrets = (parsed as { vault: unknown[] }).vault;
  const secrets: VaultSecret[] = [];
  const drops: { index: number; reason: string }[] = [];
  rawSecrets.forEach((entry, idx) => {
    const result = v.safeParse(VaultSecretSchema, entry);
    if (result.success) secrets.push(result.output);
    else drops.push({ index: idx, reason: result.issues.map((i) => i.message).join('; ') });
  });

  // Compute fingerprints to display alongside the decrypted vault — the
  // recipient asks the sender "does yours say `7f:a3:c1`?" to confirm
  // the passphrase round-tripped correctly.
  const ctFp = await ciphertextFingerprint(ciphertext);
  const { rawBits } = await deriveKey(passphrase, salt, block.encryption.iterations);
  const keyFp = await keyFingerprint(rawBits);
  return { secrets, drops, keyFingerprint: keyFp, ciphertextFingerprint: ctFp };
}
