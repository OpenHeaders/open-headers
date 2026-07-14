/**
 * Secrets-storage bridge RPCs — the "unlock secrets storage" surface.
 * Desktop-only today: the renderer mirrors the main process's observed
 * at-rest-cipher state and offers the one honest remedy (relaunch — a
 * canceled OS-keychain prompt is cached for the process lifetime, so no
 * in-process retry can succeed). Hosts without an at-rest cipher seam
 * (extension, web) never answer these; the banner self-gates on the
 * failed call.
 */

import type { SecretCipherStatus } from '../../storage';

export interface SecretsStorageState {
  /**
   * Observed cipher availability, derived from sensitive-slot traffic —
   * never probed, so asking for state can't itself trigger an OS-keychain
   * prompt. `unknown` renders like `available`: no banner.
   */
  status: SecretCipherStatus;
  /**
   * Host OS (`process.platform` value: 'darwin' | 'win32' | 'linux' | …)
   * so the surface can name the platform-appropriate remedy — keychain
   * access on macOS, a keyring backend on Linux.
   */
  platform: string;
}

export interface SecretsRpc {
  /** Current secrets-storage state — UI hydrates from this at mount. */
  'oh.secrets.getState': { req: Record<string, never>; res: SecretsStorageState };
  /**
   * Relaunch the app so the OS can offer the keychain/keyring prompt
   * again. Resolves before the restart begins.
   */
  'oh.secrets.relaunch': { req: Record<string, never>; res: { ok: boolean } };
}
