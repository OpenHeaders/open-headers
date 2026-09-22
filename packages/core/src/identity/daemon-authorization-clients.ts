/**
 * The registered OAuth 2.0 clients of the daemon's person sign-in (the
 * client sign-in plan §14.6) — declared ONCE, read by the authorization
 * server and by every client. Three PUBLIC clients (RFC 8252 §8.5: no
 * secret ever ships; `token_endpoint_auth_methods_supported: none`),
 * each with the grants it may use and, for the code grant, the
 * redirect rule the authorize request is matched against:
 *
 *   - `openheaders-desktop` — the desktop app: the authorization code
 *     grant, returning to the loopback callback it already runs.
 *     RFC 8252 §7.3 / §8.4: the loopback IP literals, ANY port (the
 *     app binds an ephemeral one), the exact path.
 *   - `openheaders-extension` — the browser extension: the code grant
 *     through the browser identity API's redirect (Chromium:
 *     `https://<id>.chromiumapp.org/callback` per pinned id; Gecko:
 *     `https://<sha1 hex of the add-on id>.extensions.allizom.org/callback`,
 *     the derivation Firefox's identity API applies), and the device
 *     grant where no identity API exists.
 *   - `openheaders-cli` — the command-line tool: the device grant only.
 *
 * No dynamic registration (RFC 7591) in this epic. The device label a
 * client sends on the start is a DISPLAY HINT; identity is the
 * `client_id` and its redirect.
 */

import { CHROMIUM_EXTENSION_IDS } from '../protocol/constants';

export type DaemonAuthorizationClientKind = 'desktop' | 'extension' | 'cli';

export const DAEMON_AUTHORIZATION_CLIENT_KINDS: readonly DaemonAuthorizationClientKind[] = [
  'desktop',
  'extension',
  'cli',
];

export type DaemonAuthorizationGrant = 'code' | 'device';

export interface DaemonAuthorizationClient {
  /** The `client_id` on the wire. */
  readonly id: string;
  readonly kind: DaemonAuthorizationClientKind;
  /** How the consent page names the client — lowercase; capitalized when it leads a sentence. */
  readonly name: string;
  readonly grants: readonly DaemonAuthorizationGrant[];
}

export const DAEMON_DESKTOP_CLIENT_ID = 'openheaders-desktop';
export const DAEMON_EXTENSION_CLIENT_ID = 'openheaders-extension';
export const DAEMON_CLI_CLIENT_ID = 'openheaders-cli';

export const DAEMON_AUTHORIZATION_CLIENTS: readonly DaemonAuthorizationClient[] = [
  { id: DAEMON_DESKTOP_CLIENT_ID, kind: 'desktop', name: 'the desktop app', grants: ['code'] },
  { id: DAEMON_EXTENSION_CLIENT_ID, kind: 'extension', name: 'the browser extension', grants: ['code', 'device'] },
  { id: DAEMON_CLI_CLIENT_ID, kind: 'cli', name: 'the command-line tool', grants: ['device'] },
];

/** The desktop's loopback callback path — the route `oauth-callback-http.ts` serves. */
export const DAEMON_DESKTOP_REDIRECT_PATH = '/oauth/callback';

/** The extension's identity-API redirect path, on both browser families. */
export const DAEMON_EXTENSION_REDIRECT_PATH = '/callback';

const CHROMIUM_IDENTITY_REDIRECT_DOMAIN = 'chromiumapp.org';
const GECKO_IDENTITY_REDIRECT_DOMAIN = 'extensions.allizom.org';

/**
 * Firefox's identity API derives its redirect host as the SHA-1 hex of
 * the add-on id (`toolkit/components/extensions/child/ext-identity.js`,
 * `computeHash`). Pinned here for the stable and beta ids so the
 * matcher stays synchronous and platform-neutral; the unit suite
 * recomputes them from `GECKO_EXTENSION_IDS`.
 */
export const GECKO_IDENTITY_REDIRECT_HOSTS: readonly string[] = [
  `4d04b7f29a86047e6f5ad4dc2de2b890d28f7e49.${GECKO_IDENTITY_REDIRECT_DOMAIN}`,
  `ba29c5f27456be4209094b303d9a4a8f73691053.${GECKO_IDENTITY_REDIRECT_DOMAIN}`,
];

export function findDaemonAuthorizationClient(clientId: string): DaemonAuthorizationClient | null {
  return DAEMON_AUTHORIZATION_CLIENTS.find((client) => client.id === clientId) ?? null;
}

/** A redirect URI must be absolute, carry no query or fragment, and match the rule on host + path. */
function parseRedirect(redirectUri: string): URL | null {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return null;
  }
  if (url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '') return null;
  return url;
}

function isDesktopRedirect(url: URL): boolean {
  // RFC 8252 §8.3: the loopback IP literals, never `localhost`.
  const loopback = url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  return url.protocol === 'http:' && loopback && url.pathname === DAEMON_DESKTOP_REDIRECT_PATH;
}

function isExtensionRedirect(url: URL): boolean {
  if (url.protocol !== 'https:' || url.port !== '' || url.pathname !== DAEMON_EXTENSION_REDIRECT_PATH) return false;
  const host = url.hostname;
  if (host.endsWith(`.${CHROMIUM_IDENTITY_REDIRECT_DOMAIN}`)) {
    return CHROMIUM_EXTENSION_IDS.includes(host.slice(0, -(CHROMIUM_IDENTITY_REDIRECT_DOMAIN.length + 1)));
  }
  return GECKO_IDENTITY_REDIRECT_HOSTS.includes(host);
}

/**
 * Is `redirectUri` one the registered client may be sent back to? The
 * exact-match rule of RFC 9700 §2.1, with RFC 8252 §7.3's one
 * exception: the desktop's loopback redirect matches on any port.
 */
export function isRegisteredRedirect(clientId: string, redirectUri: string): boolean {
  const client = findDaemonAuthorizationClient(clientId);
  if (client === null || !client.grants.includes('code')) return false;
  const url = parseRedirect(redirectUri);
  if (url === null) return false;
  switch (client.kind) {
    case 'desktop':
      return isDesktopRedirect(url);
    case 'extension':
      return isExtensionRedirect(url);
    case 'cli':
      return false;
  }
}
