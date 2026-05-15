/**
 * {@link SecretCipher} implementation backed by Electron's `safeStorage`
 * — Keychain on macOS, DPAPI on Windows, libsecret/kwallet on Linux.
 *
 * `safeStorage.encryptString` returns a `Buffer`; we base64-encode at
 * this boundary so the encrypted blob travels as a plain JSON string
 * through {@link FileBackedHostStorage}'s on-disk envelope. Same on the
 * way back: base64 → Buffer → `decryptString`.
 *
 * Availability semantics:
 *
 *   - `app.whenReady()` must have resolved before encryption is
 *     attempted. The host installs this cipher inside `installRpcHost`
 *     which itself runs after `app.whenReady()`, so this is structural
 *     not opportunistic.
 *   - On Linux, `safeStorage.isEncryptionAvailable()` can return false
 *     when no usable keyring backend is present. In that case the
 *     {@link FileBackedHostStorage} refuses to write sensitive slots
 *     rather than silently downgrading to plaintext. Surfacing this to
 *     the user is a future UX concern (commit 6 ships the seam; the
 *     "you have OAuth credentials but no keyring — set one up" prompt
 *     is a follow-up).
 */

import { safeStorage } from 'electron';
import type { SecretCipher } from '@openheaders/oracle/host-storage';

export const safeStorageCipher: SecretCipher = {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  },
  encrypt(plaintext: string): string {
    const buf = safeStorage.encryptString(plaintext);
    return buf.toString('base64');
  },
  decrypt(blob: string): string {
    return safeStorage.decryptString(Buffer.from(blob, 'base64'));
  },
};
