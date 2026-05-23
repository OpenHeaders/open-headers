/**
 * useBackendMode — live-tracked `backend.mode` setting for renderer
 * surfaces. The setting names the backend role this host is in:
 *
 *   in-browser           — the SW is the backend (extension only)
 *   desktop-app          — paired with the desktop app on this device
 *                          (extension as client, OR desktop self-hosting)
 *   local-self-hosted    — client of a self-hosted server on the LAN
 *   remote-self-hosted   — client of a self-hosted server over the WAN
 *
 * Reach (`useBackendReach`) is the *bind* of the locally-effective
 * backend; mode is the *role* this host plays. Two axes — keep them
 * decoupled. Settings subscriptions handle hot-reload like the existing
 * settings-keyed hooks.
 */

import type { BackendMode } from '@openheaders/ui/workbench/settings/schema/backend';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { useEffect, useState } from 'react';

export function useBackendMode(): BackendMode {
  const [mode, setMode] = useState<BackendMode>(() => getSetting('backend.mode'));

  useEffect(() => {
    const unsubscribe = subscribeKey('backend.mode', () => {
      setMode(getSetting('backend.mode'));
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  return mode;
}
