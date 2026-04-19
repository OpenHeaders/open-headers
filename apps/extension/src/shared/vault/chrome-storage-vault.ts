/**
 * ChromeStorageVault — extension implementation of `@openheaders/core/vault`.
 *
 * Reads + writes the workspace's `V5.Vault` blob through
 * `chrome.storage.local` under `oh.ws.<id>.vault`. Routes every secret
 * value through the injected `VaultCipher` so the v2 AES-GCM swap
 * (ARCHITECTURE.md §10) is a one-line change — replace the default
 * `noopCipher` constructor arg with the real implementation.
 *
 * Scope semantics (for this v1):
 *   - `personal`: writes to `chrome.storage.local` under the workspace's
 *     vault key. Persistent across browser restarts. Never synced.
 *   - `session`:  not implemented yet — reserved for decrypted key
 *     material held in `chrome.storage.session` in v2. Reads return
 *     null; writes are a no-op so callers can fail open rather than
 *     throwing at call sites that will eventually want session scope.
 *
 * Intentionally bypasses the in-memory `environment-store.ts` vault
 * cache. Using the store would create a read-through layer that the
 * cipher can't encrypt (the store is keyed by plaintext V5.Vault
 * shape). The environment-store's vault remains the resolver's
 * snapshot for variable interpolation; direct credential lookups from
 * future features (OAuth token refresh, etc.) go through this Vault.
 */

import type { V5 } from '@openheaders/core/types';
import { noopCipher, type Vault, type VaultCipher, type VaultScope } from '@openheaders/core/vault';
import { logger } from '@utils/logger';
import { report as reportStatus } from '@/shared/status';
import { extensionStorage, wsKeys } from '@/shared/storage';

// Phase 10 note — this direct-storage vault path writes to the same
// `oh.ws.<id>.vault` key that the SW's `setVault` manages. Per-key
// writes here bypass the SW's Web Lock wrapping; it's safe for now
// because OAuth/API-key features (the only direct-vault writers) are
// all per-tab user actions with no cross-tab race surface, but if a
// future caller adds concurrent direct-vault writes we'd need to
// route them through the SW bridge to pick up the locking.
const EMPTY_BLOB: V5.Vault = { schemaVersion: 5, version: 1, secrets: [] };

export class ChromeStorageVault implements Vault {
  constructor(private readonly cipher: VaultCipher = noopCipher) {}

  async get(key: string, scope: VaultScope): Promise<string | null> {
    if (scope.kind !== 'personal') return null;
    const blob = await this.readBlob(scope.workspaceId);
    const secret = blob.secrets.find((s) => s.name === key);
    if (!secret?.value) return null;
    try {
      const value = await this.cipher.decrypt(secret.value);
      // Report green on success so a prior cipher failure can transition
      // back to healthy. Stable message lets the store's dedup suppress
      // churn across repeated successful decrypts.
      reportStatus({ subsystem: 'secrets', state: 'green', message: 'Vault healthy' });
      return value;
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
    const blob = await this.readBlob(scope.workspaceId);
    const encrypted = await this.cipher.encrypt(value);
    const idx = blob.secrets.findIndex((s) => s.name === key);
    if (idx >= 0) {
      blob.secrets[idx] = { name: key, value: encrypted };
    } else {
      blob.secrets.push({ name: key, value: encrypted });
    }
    await this.writeBlob(scope.workspaceId, blob);
  }

  async delete(key: string, scope: VaultScope): Promise<void> {
    if (scope.kind !== 'personal') return;
    const blob = await this.readBlob(scope.workspaceId);
    const before = blob.secrets.length;
    blob.secrets = blob.secrets.filter((s) => s.name !== key);
    if (blob.secrets.length === before) return;
    await this.writeBlob(scope.workspaceId, blob);
  }

  async list(scope: VaultScope): Promise<string[]> {
    if (scope.kind !== 'personal') return [];
    const blob = await this.readBlob(scope.workspaceId);
    return blob.secrets.map((s) => s.name);
  }

  // ── Internal ────────────────────────────────────────────────────

  private async readBlob(workspaceId: string): Promise<V5.Vault> {
    try {
      const stored = await extensionStorage.get(wsKeys(workspaceId).vault);
      if (stored && 'secrets' in stored && Array.isArray(stored.secrets)) {
        // Fresh copy — callers mutate the return value. Preserve the
        // `version` counter from storage so concurrent SW writes can
        // still advance it deterministically.
        return {
          schemaVersion: stored.schemaVersion ?? 5,
          version: typeof stored.version === 'number' ? stored.version : 1,
          secrets: [...stored.secrets],
        };
      }
    } catch (err) {
      logger.warn('ChromeStorageVault', `readBlob failed for ${workspaceId}`, err);
    }
    return { ...EMPTY_BLOB, secrets: [] };
  }

  private async writeBlob(workspaceId: string, blob: V5.Vault): Promise<void> {
    await extensionStorage.set(wsKeys(workspaceId).vault, blob);
  }
}

// ── Default singleton ─────────────────────────────────────────────

/**
 * Default vault instance — used by any caller that just wants to
 * read/write secrets. v2's cipher swap replaces the `noopCipher` here.
 */
export const vault: Vault = new ChromeStorageVault(noopCipher);
