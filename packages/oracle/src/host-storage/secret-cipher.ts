/**
 * Encryption seam for {@link FileBackedHostStorage}. Slots flagged
 * `sensitive: true` on the {@link StorageKey} contract route through a
 * cipher implementation here; everything else is persisted as plain JSON.
 *
 * Implementations live wherever the host lives — Electron's `safeStorage`
 * adapter ships in `apps/desktop/src/main/`; future daemon variants (keytar
 * on a headless Node process; KMS-backed on a cloud daemon) implement the
 * same interface against whichever credential store is available. Pure-Node
 * tests use {@link NoopSecretCipher}.
 *
 * The API is synchronous because every concrete cipher backend
 * (`safeStorage`, keytar, libsodium) provides synchronous primitives.
 * The wrapping `HostStorage` is async — file I/O dominates — and absorbs
 * any per-slot cipher cost.
 *
 * Encoded blobs MUST be JSON-serializable strings. Adapters that produce
 * binary output (e.g. `safeStorage.encryptString` returns a Buffer) are
 * expected to base64-encode at the seam boundary.
 */

export interface SecretCipher {
  /**
   * Returns `true` once the underlying credential store is ready to
   * encrypt/decrypt. Electron's `safeStorage` requires the app to be
   * ready first; daemon variants may need a config-supplied passphrase
   * unlocked. Persistence layers should treat `false` as "no sensitive
   * slot can be read or written yet" — fail loud, never silently store
   * sensitive material in plaintext.
   */
  isAvailable(): boolean;
  encrypt(plaintext: string): string;
  decrypt(blob: string): string;
}

/**
 * Test / non-encrypting fallback. NEVER use this in production with real
 * sensitive material — sensitive slots get persisted unencrypted. The
 * `isAvailable()` lie is deliberate: it lets tests round-trip sensitive
 * slots without standing up a real OS keychain.
 */
export const noopSecretCipher: SecretCipher = {
  isAvailable: () => true,
  encrypt: (plaintext) => plaintext,
  decrypt: (blob) => blob,
};
