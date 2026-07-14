/**
 * SecretsStorageBanner — the "unlock secrets storage" surface. Renders
 * only while the host reports the at-rest cipher `unavailable`: sensitive
 * slots (Vault secrets, OAuth tokens) can be neither read nor saved, and
 * the never-write-plaintext law keeps it that way for the whole session.
 *
 * The remedy is honest per platform: on macOS a canceled keychain prompt
 * is cached for the process lifetime, so relaunching (and allowing access
 * this time) is the ONLY way back; on Linux the missing piece is usually
 * a keyring backend, so the copy names that before offering the relaunch.
 *
 * Hosts without the `oh.secrets.*` RPCs (extension, web) fail the state
 * call and the banner never renders — same self-gating idiom as
 * `SecurityUpdateBanner`. Closable per session; it returns next session
 * while the condition persists.
 */

import type { SecretsStorageState } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { Alert, Button } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';

const SecretsStorageBanner: React.FC = () => {
  const [state, setState] = useState<SecretsStorageState | null>(null);
  const [dismissed, setDismissed] = useState(false);

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
        // Host without an at-rest cipher seam — no banner.
      });
    const unsubscribe = bridge.subscribe('secretsStorageState', setState);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (state === null || state.status !== 'unavailable' || dismissed) return null;

  const message =
    'Secrets storage is locked — Vault secrets and OAuth tokens cannot be read or saved this session.';
  const description =
    state.platform === 'darwin'
      ? 'Open Headers was denied access to the system keychain. Relaunch the app and allow keychain access when prompted.'
      : state.platform === 'linux'
        ? 'No usable keyring backend is available. Set one up (GNOME Keyring or KWallet), then relaunch the app.'
        : 'Open Headers could not access the system credential store. Relaunch the app to try again.';

  const relaunch = (): void => {
    const bridge = getHostBridge();
    if (!bridge) return;
    void bridge.call('oh.secrets.relaunch').catch(() => undefined);
  };

  return (
    <Alert
      banner
      type="error"
      showIcon
      closable
      onClose={() => setDismissed(true)}
      data-testid="secrets-storage-banner"
      message={message}
      description={description}
      action={
        <Button size="small" danger onClick={relaunch} data-testid="secrets-storage-relaunch">
          Relaunch
        </Button>
      }
    />
  );
};

export default SecretsStorageBanner;
