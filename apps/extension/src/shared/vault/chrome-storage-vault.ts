/**
 * ChromeStorageVault — renderer-side implementation of
 * `@openheaders/core/vault`.
 *
 * Every mutation routes through the SW's `vaultPutSecret` /
 * `vaultDeleteSecret` RPCs so there is exactly ONE writer to the
 * workspace vault key (the SW, under a `withLock` wrapper that
 * serializes against the bulk `setVault` path used by `VaultEditor`).
 * Reads hit the SW's in-memory snapshot via `vaultGetSecret` /
 * `vaultListSecretNames` for strict consistency with the last write.
 *
 * This implementation runs ONLY in renderer contexts (popup,
 * sidepanel, workspace, devtools panel). The SW itself consumes the
 * vault via `environment-store`'s in-memory `getVault()` — the direct
 * in-process API — not through this class. A Vault returned by this
 * factory in an SW context would deadlock on self-RPC.
 *
 * Cipher runs in the renderer (same thread that captures the
 * passphrase in v2+). The SW stores opaque strings, never plaintext
 * secrets. `noopCipher` today is a passthrough; the v2 AES-GCM swap
 * drops in a real encrypt/decrypt pair with zero call-site changes
 * outside this file.
 *
 * Scope semantics (v1):
 *   - `personal` — per-workspace vault, persisted via the SW.
 *   - `session`  — in-memory, dies on browser close. Reserved for v2
 *                  decrypted key material. Reads return null; writes
 *                  are a no-op so callers can fail open.
 */

import { noopCipher, type Vault, type VaultCipher, type VaultScope } from '@openheaders/core/vault';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import { report as reportStatus } from '@/shared/status';

export class ChromeStorageVault implements Vault {
  constructor(private readonly cipher: VaultCipher = noopCipher) {}

  async get(key: string, scope: VaultScope): Promise<string | null> {
    if (scope.kind !== 'personal') return null;
    const { value } = await call('vaultGetSecret', { key }).catch(() => ({ value: null }));
    if (value === null) return null;
    try {
      const plaintext = await this.cipher.decrypt(value);
      // Report green on success so a prior cipher failure can transition
      // back to healthy. Stable message lets the store's dedup suppress
      // churn across repeated successful decrypts.
      reportStatus({ subsystem: 'secrets', state: 'green', message: 'Vault healthy' });
      return plaintext;
    } catch (err) {
      const errorClass = err instanceof Error ? err.name : undefined;
      logger.warn('ChromeStorageVault', `Failed to decrypt ${key}`, err);
      reportStatus({
        subsystem: 'secrets',
        state: 'red',
        message: `Failed to decrypt vault entry: ${key}`,
        context: { workspaceId: scope.workspaceId, errorClass },
      });
      return null;
    }
  }

  async put(key: string, value: string, scope: VaultScope): Promise<void> {
    if (scope.kind !== 'personal') return;
    const encrypted = await this.cipher.encrypt(value);
    await call('vaultPutSecret', { key, value: encrypted }).catch((err: Error) => {
      logger.warn('ChromeStorageVault', `vaultPutSecret failed for ${key}`, err);
      return { ok: false as const, reason: 'other' as const, message: err.message };
    });
  }

  async delete(key: string, scope: VaultScope): Promise<void> {
    if (scope.kind !== 'personal') return;
    await call('vaultDeleteSecret', { key }).catch((err: Error) => {
      logger.warn('ChromeStorageVault', `vaultDeleteSecret failed for ${key}`, err);
      return { ok: false as const, reason: 'other' as const, message: err.message };
    });
  }

  async list(scope: VaultScope): Promise<string[]> {
    if (scope.kind !== 'personal') return [];
    const { names } = await call('vaultListSecretNames').catch(() => ({ names: [] as string[] }));
    return names;
  }
}

// ── Default singleton ─────────────────────────────────────────────

/**
 * Default vault instance — used by any renderer caller that wants to
 * read/write secrets. v2's cipher swap replaces the `noopCipher` here.
 */
export const vault: Vault = new ChromeStorageVault(noopCipher);
