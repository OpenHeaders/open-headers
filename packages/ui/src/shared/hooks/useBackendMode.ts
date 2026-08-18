/**
 * useBackendMode — live-tracked back-end mode for renderer surfaces.
 * The mode names the backend role this host is in:
 *
 *   in-browser           — the SW is the backend (extension only)
 *   desktop-app          — paired with the desktop app on this device
 *                          (extension as client, OR desktop self-hosting)
 *   local-self-hosted    — client of a self-hosted server on the LAN
 *   remote-self-hosted   — client of a self-hosted server over the WAN
 *
 * Since the multi-backend Phase-1 retirement the mode is not a stored
 * setting — it is DERIVED from the `OH.backends` registry's primary
 * record (the multi-backend plan §1: "kind is presentation derived from
 * the URL, not a stored mode"). Reach (`useBackendReach`) is the *bind*
 * of the locally-effective backend; mode is the *role* this host plays.
 * Two axes — keep them decoupled.
 */

import { usePrimaryBackend } from '@openheaders/ui/shared/backend';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { type BackendMode, deriveBackendMode } from '@openheaders/ui/workbench/settings/schema/backend';

export function useBackendMode(): BackendMode {
  const primary = usePrimaryBackend();
  return deriveBackendMode(getCurrentHost(), primary);
}
