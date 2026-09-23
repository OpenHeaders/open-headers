/**
 * Main-process half of the desktop's `serverSignIn` capability (the
 * client sign-in plan §14.9, F0-b): the renderer is a file origin the
 * server's admission matrix refuses everywhere, so both grants' HTTP —
 * the metadata read, the start, the poll, the redemption, the meta
 * reads — runs here over Node's fetch, which carries no Origin, through
 * the same core client every native client uses (`client: 'desktop'`).
 * The desktop is registered for the authorization code grant, and its
 * user agent is the spine's system-browser hop over the loopback
 * callback route the API OAuth leg already runs (`state`-keyed, one
 * waiter per flow; the app fronted when the redirect lands) — the
 * dispatcher only relays. The start names this device by the machine
 * name so the consent card reads "Daniels-MacBook-Pro (the desktop app)
 * asked…"; a caller's label wins.
 */

import type { ServerSignInApi } from '@openheaders/core/capabilities';
import { type AuthorizationUserAgent, createServerSignInClient } from '@openheaders/core/identity';
import { safeOsHostname } from './os-hostname';

export interface ServerSignInRpcOptions {
  /** The spine's browser hop; null on a host with no browser, where the desktop's code-only registration leaves no grant to run. */
  readonly userAgent: AuthorizationUserAgent | null;
  /** Test seam; defaults to the core client over Node's fetch and the user agent above. */
  readonly client?: ServerSignInApi;
  /** The device label sent on a start without one; defaults to the machine name. */
  readonly deviceLabel?: () => string;
}

export interface ServerSignInRpc {
  /** Answers the `oh.serverSignIn.*` channels; undefined for any other type (the update service's idiom). */
  dispatch(type: unknown, message: Record<string, unknown>): Promise<unknown> | undefined;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

export function createServerSignInRpc(options: ServerSignInRpcOptions): ServerSignInRpc {
  const ownLabel = options.deviceLabel ?? safeOsHostname;
  const client =
    options.client ??
    createServerSignInClient({ client: 'desktop', userAgent: options.userAgent, deviceLabel: ownLabel });
  return {
    dispatch(type, message) {
      switch (type) {
        case 'oh.serverSignIn.start': {
          const deviceLabel = typeof message.deviceLabel === 'string' ? message.deviceLabel : ownLabel();
          return client.start({ url: str(message.url), deviceLabel });
        }
        case 'oh.serverSignIn.poll':
          return client.poll({ handle: str(message.handle) });
        case 'oh.serverSignIn.cancel':
          return client.cancel({ handle: str(message.handle) }).then(() => ({ ok: true }));
        case 'oh.serverSignIn.signOut':
          return client.signOut({ url: str(message.url), token: str(message.token) });
        case 'oh.serverSignIn.meta':
          return client.fetchMeta({ url: str(message.url), path: str(message.path) }).then((payload) => ({ payload }));
        default:
          return undefined;
      }
    },
  };
}
