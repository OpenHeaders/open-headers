/**
 * The host's system-plane resolver slot — the same install idiom
 * as the HTTP/3 helper locator: the desktop shell registers its
 * Chromium `session.resolveProxy` adapter at boot; a host that
 * registers nothing gets the node tier's env-var default (FORK A: the
 * plane is ON by default on every tier — an unmanaged machine resolves
 * DIRECT and behaves exactly as before). Registering `null` turns the
 * plane off (the explicit Off mode; unit rigs use it too). Consulted
 * at SEND time, so registration order against transport creation
 * never matters.
 */

import { createEnvProxyResolver } from './env-proxy-resolver';
import type { SystemProxyResolver } from './types';

let registered: SystemProxyResolver | null | undefined;
let envDefault: SystemProxyResolver | undefined;

export function registerSystemProxyResolver(resolver: SystemProxyResolver | null): void {
  registered = resolver;
}

/** Clear a registration back to the tier default (test hygiene). */
export function resetSystemProxyResolver(): void {
  registered = undefined;
}

export function systemProxyResolver(): SystemProxyResolver | null {
  if (registered !== undefined) return registered;
  envDefault ??= createEnvProxyResolver();
  return envDefault;
}
