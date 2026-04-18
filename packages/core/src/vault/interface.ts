/**
 * Vault — the single interface every credential/secret access goes through.
 *
 * Motivation (ARCHITECTURE.md §10): the concrete storage mechanism and
 * cipher for secret-at-rest will evolve across three tiers:
 *   v1: no-op cipher (plaintext in chrome.storage.local; trust browser disk encryption)
 *   v2: passphrase-derived AES-GCM key held in chrome.storage.session
 *   v3: WebAuthn PRF hardware-backed key
 *
 * If consumers reach into storage directly, every tier change becomes a
 * multi-week migration. If they go through this interface, each tier is
 * a one-file change in the implementation module.
 *
 * Pure interface — no platform deps. Extension implementations live in
 * `apps/extension/src/shared/vault/`.
 */

/**
 * Where the secret lives and who owns it.
 *
 *   - `personal` — user-local, scoped to one workspace. Persisted in
 *     `chrome.storage.local` on the extension. NEVER synced (this is the
 *     point of the scope separation).
 *   - `session`  — in-memory, lives until browser close. Reserved for
 *     decrypted-at-unlock key material in v2.
 *
 * `shared` (team-encrypted) is deliberately not included here — it lands
 * in v2 once team workspaces + the passphrase tier are in place.
 */
export type VaultScope = { kind: 'personal'; workspaceId: string } | { kind: 'session' };

export interface Vault {
  /** Read a secret; `null` when absent. */
  get(key: string, scope: VaultScope): Promise<string | null>;
  /** Create or overwrite a secret. */
  put(key: string, value: string, scope: VaultScope): Promise<void>;
  /** Remove a secret; no-op if absent. */
  delete(key: string, scope: VaultScope): Promise<void>;
  /** Enumerate every known secret name in the given scope. */
  list(scope: VaultScope): Promise<string[]>;
}

/**
 * Pluggable cipher. The Vault implementation asks for `encrypt` on
 * write and `decrypt` on read. The identity implementation below lets
 * v1 ship with plaintext while keeping the call-site contract stable
 * for the v2/v3 cipher swap.
 *
 * Both directions are sync- or Promise-returning so v2's WebCrypto path
 * fits without interface churn.
 */
export interface VaultCipher {
  encrypt(plaintext: string): string | Promise<string>;
  decrypt(ciphertext: string): string | Promise<string>;
}

/** v1 — identity cipher. The only cipher until the v2 AES-GCM tier lands. */
export const noopCipher: VaultCipher = {
  encrypt: (x) => x,
  decrypt: (x) => x,
};
