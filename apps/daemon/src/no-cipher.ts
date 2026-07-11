/**
 * The unconfigured default: report unavailable so `FileBackedHostStorage`
 * refuses sensitive slots (vault/oauth) instead of downgrading them to
 * plaintext on disk — same posture as desktop-on-Linux without a
 * keyring. A configured passphrase replaces this with the vault cipher
 * (`vault-cipher.ts`); every `storage.json` consumer resolves through
 * `resolveDaemonCipher`.
 */

import type { SecretCipher } from '@openheaders/oracle/host-storage';

export const noCipherYet: SecretCipher = {
  isAvailable: () => false,
  encrypt() {
    throw new Error('secret cipher not configured');
  },
  decrypt() {
    throw new Error('secret cipher not configured');
  },
};
