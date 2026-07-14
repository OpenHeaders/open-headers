/**
 * useSecretsStorageState — mirrors the host's observed at-rest-cipher
 * state into the renderer.
 *
 * One `oh.secrets.getState` RPC at mount + one `secretsStorageState`
 * subscription. Hosts without an at-rest cipher seam (extension, web)
 * reject the RPC and the hook stays `null` — consumers render nothing,
 * so the surfaces self-gate exactly like the update affordances do.
 *
 * The remedy is honest per platform: on macOS a canceled keychain
 * prompt is cached for the process lifetime, so relaunching (and
 * allowing access this time) is the ONLY way back; on Linux the missing
 * piece is usually a keyring backend, named before the relaunch.
 */

import type { SecretsStorageState } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { useEffect, useState } from 'react';

export function useSecretsStorageState(): SecretsStorageState | null {
  const [state, setState] = useState<SecretsStorageState | null>(null);

  useEffect(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    let cancelled = false;
    void bridge
      .call('oh.secrets.getState')
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        // Host without the secrets RPC — stay null.
      });
    const unsubscribe = bridge.subscribe('secretsStorageState', setState);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}

/** Ask the host to relaunch so the OS can offer the keychain prompt again. */
export function requestSecretsRelaunch(): void {
  const bridge = getHostBridge();
  if (!bridge) return;
  void bridge.call('oh.secrets.relaunch').catch(() => undefined);
}

/** Platform-appropriate remedy line for the locked state. */
export function secretsStorageRemedy(platform: string): string {
  if (platform === 'darwin') {
    return 'Open Headers was denied access to the system keychain. Relaunch the app and allow keychain access when prompted.';
  }
  if (platform === 'linux') {
    return 'No usable keyring backend is available. Set one up (GNOME Keyring or KWallet), then relaunch the app.';
  }
  return 'Open Headers could not access the system credential store. Relaunch the app to try again.';
}
