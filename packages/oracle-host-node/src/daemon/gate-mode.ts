/**
 * The server's gate state — ONE server-side answer to "how does a
 * person sign in here?" (the client sign-in plan §6.3). The served web
 * tab resolves the same four states from the three meta routes
 * (`resolveGateMode` in the web host); the OAuth consent page renders
 * them server-side. Both read this module's truth so the two
 * front doors can never disagree:
 *
 *   - `setup`     — no directory user has ever been admitted and no IdP
 *                   is configured: the first browser claims the server.
 *   - `sso`       — an IdP is configured: the provider button is the way in.
 *   - `password`  — a claimed server where some active user holds a password.
 *   - `no-login`  — a claimed server with neither: only an admin-issued
 *                   code or token can bring a device in.
 *
 * Precedence is the web tab's: SSO first (an IdP-fronted server is never
 * unclaimed, O4), then the claim, then the password holder.
 */

import { isDaemonDirectoryEmpty } from '@openheaders/core/identity';

export type DaemonGateMode =
  | { readonly kind: 'setup'; readonly requiresCode: boolean }
  | { readonly kind: 'sso'; readonly provider: string }
  | { readonly kind: 'password' }
  | { readonly kind: 'no-login' };

export interface GateModeDeps {
  /** The configured IdP's label; null when no IdP is configured. */
  readonly ssoProvider: (() => string) | null;
  /** The claim service's answer for the asking peer (`{unclaimed, requiresCode}`). */
  readonly setupMeta: (peerIsLoopback: boolean) => Promise<{ unclaimed: boolean; requiresCode: boolean }>;
  /** Does any ACTIVE directory user hold a password? */
  readonly passwordEnabled: () => Promise<boolean>;
}

/** `peerIsLoopback` is the asking browser's — the setup code is demanded only off the server's own machine. */
export type GateModeResolver = (peerIsLoopback: boolean) => Promise<DaemonGateMode>;

/** Unclaimed = an empty directory on a daemon with no IdP (the front-door plan O4). */
export async function isServerUnclaimed(oidcConfigured: boolean): Promise<boolean> {
  if (oidcConfigured) return false;
  return isDaemonDirectoryEmpty();
}

export function createGateModeResolver(deps: GateModeDeps): GateModeResolver {
  return async (peerIsLoopback) => {
    if (deps.ssoProvider !== null) return { kind: 'sso', provider: deps.ssoProvider() };
    const setup = await deps.setupMeta(peerIsLoopback);
    if (setup.unclaimed) return { kind: 'setup', requiresCode: setup.requiresCode };
    return (await deps.passwordEnabled()) ? { kind: 'password' } : { kind: 'no-login' };
  };
}
