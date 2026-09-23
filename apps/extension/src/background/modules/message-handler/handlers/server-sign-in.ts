/**
 * The person's sign-in from this client (the client sign-in plan
 * §14.9) — the `oh.serverSignIn.*` channels the popup, the workbench
 * tab and the side panel reach through the bridged capability. The
 * service worker holds the ONE core client for this host because the
 * code grant's browser hop lives here: the identity API's window
 * outlives a popup that closes when the window takes focus, and the
 * registered redirect (`https://<id>.chromiumapp.org/callback`, the
 * Gecko twin) is the identity API's own. Where the identity API is
 * absent the same client runs the device grant — the person opens
 * the verification link the step shows. The device label is this
 * browser and platform ("Chrome · macOS"); a caller's own label wins.
 */

import type { ServerSignInApi } from '@openheaders/core/capabilities';
import {
  type AuthorizationUserAgent,
  createServerSignInClient,
  DAEMON_EXTENSION_REDIRECT_PATH,
} from '@openheaders/core/identity';
import { identity } from '@utils/browser-api';
import { selfHostLabel } from '@/utils/self-host-label';
import type { HandlerMap } from '../types';

/**
 * The identity API as the code grant's user agent: the registered
 * callback on the browser's per-extension redirect origin, and the
 * flow's window resolving with the redirect it intercepted. A closed
 * window is a rejection — the client reads it as the leg abandoned.
 */
export function identityUserAgent(): AuthorizationUserAgent | null {
  if (!identity.isAvailable()) return null;
  return {
    redirectUri: () => new URL(DAEMON_EXTENSION_REDIRECT_PATH, identity.getRedirectURL('')).toString(),
    launch: (url) =>
      identity.launchWebAuthFlow({ url, interactive: true }).then((responseUrl) => {
        if (responseUrl === null) throw new Error('the authorization window closed before the redirect');
        return responseUrl;
      }),
  };
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

export function createServerSignInHandlers(getClient: () => ServerSignInApi): HandlerMap {
  return {
    'oh.serverSignIn.start': ({ message, respond }) => {
      const deviceLabel = typeof message.deviceLabel === 'string' ? message.deviceLabel : undefined;
      getClient()
        .start({ url: str(message.url), ...(deviceLabel !== undefined ? { deviceLabel } : {}) })
        .then(respond, () => respond({ ok: false, reason: 'error' }));
      return true;
    },
    'oh.serverSignIn.poll': ({ message, respond }) => {
      getClient()
        .poll({ handle: str(message.handle) })
        .then(respond, () => respond({ status: 'offline' }));
      return true;
    },
    'oh.serverSignIn.cancel': ({ message, respond }) => {
      getClient()
        .cancel({ handle: str(message.handle) })
        .then(
          () => respond({ ok: true }),
          () => respond({ ok: true }),
        );
      return true;
    },
    'oh.serverSignIn.signOut': ({ message, respond }) => {
      getClient()
        .signOut({ url: str(message.url), token: str(message.token) })
        .then(respond, () => respond({ ok: false }));
      return true;
    },
    'oh.serverSignIn.meta': ({ message, respond }) => {
      getClient()
        .fetchMeta({ url: str(message.url), path: str(message.path) })
        .then(
          (payload) => respond({ payload }),
          () => respond({ payload: null }),
        );
      return true;
    },
  };
}

let liveClient: ServerSignInApi | null = null;

/** The host's one client, built on first use so the identity probe runs once the SW is up. */
function client(): ServerSignInApi {
  liveClient ??= createServerSignInClient({
    client: 'extension',
    userAgent: identityUserAgent(),
    deviceLabel: selfHostLabel,
  });
  return liveClient;
}

export const serverSignInHandlers: HandlerMap = createServerSignInHandlers(client);
