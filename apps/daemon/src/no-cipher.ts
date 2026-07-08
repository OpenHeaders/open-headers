/**
 * No cipher until the daemon grows a passphrase/keychain story: report
 * unavailable so `FileBackedHostStorage` refuses sensitive slots
 * (vault/oauth) instead of downgrading them to plaintext on disk —
 * same posture as desktop-on-Linux without a keyring. Shared by the
 * daemon entry and the `oh-daemon` CLI, which opens the same
 * `storage.json` for the offline token mint.
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
