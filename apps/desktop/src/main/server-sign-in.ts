/**
 * Main-process half of the desktop's `serverSignIn` capability (the
 * client sign-in plan §7, F0-b): the renderer is a file origin the
 * server's admission matrix refuses everywhere, so the device flow's
 * HTTP — start, poll, the meta reads — runs here over Node's fetch,
 * which carries no Origin, through the same core wire client every
 * native client uses (`client: 'desktop'`). The one desktop-specific
 * act: when the poll lands the approval, the person is in their browser
 * on the server's page — front the app so the wizard's "Signed in as …"
 * is what they see next (the OAuth code leg's `revealApp` precedent).
 * The start names this device by the machine name so the page reads
 * "Daniels-MacBook-Pro (the desktop app) asked…"; a caller's label wins.
 */

import type { ServerSignInApi } from '@openheaders/core/capabilities';
import { createServerSignInClient } from '@openheaders/core/identity';
import { safeOsHostname } from './os-hostname';

/** The server refuses longer labels (400) — never let a hostname trip it. */
const MAX_DEVICE_LABEL_LENGTH = 64;

export interface ServerSignInRpcOptions {
  /** Front the workbench window — called once per approved poll. */
  readonly revealApp: () => void;
  /** Test seam; defaults to the core client over Node's fetch. */
  readonly client?: ServerSignInApi;
  /** The device label sent on a start without one; defaults to the machine name. */
  readonly deviceLabel?: () => string;
}

export interface ServerSignInRpc {
  /** Answers the `oh.serverSignIn.*` channels; undefined for any other type (the update service's idiom). */
  dispatch(type: unknown, message: Record<string, unknown>): Promise<unknown> | undefined;
}

export function createServerSignInRpc(options: ServerSignInRpcOptions): ServerSignInRpc {
  const client = options.client ?? createServerSignInClient({ client: 'desktop' });
  const ownLabel = options.deviceLabel ?? safeOsHostname;
  return {
    dispatch(type, message) {
      switch (type) {
        case 'oh.serverSignIn.start': {
          const url = typeof message.url === 'string' ? message.url : '';
          const deviceLabel = (typeof message.deviceLabel === 'string' ? message.deviceLabel : ownLabel()).slice(
            0,
            MAX_DEVICE_LABEL_LENGTH,
          );
          return client.start({ url, deviceLabel });
        }
        case 'oh.serverSignIn.poll': {
          const url = typeof message.url === 'string' ? message.url : '';
          const pollToken = typeof message.pollToken === 'string' ? message.pollToken : '';
          return client.poll({ url, pollToken }).then((polled) => {
            if (polled.status === 'approved') options.revealApp();
            return polled;
          });
        }
        case 'oh.serverSignIn.meta': {
          const url = typeof message.url === 'string' ? message.url : '';
          const path = typeof message.path === 'string' ? message.path : '';
          return client.fetchMeta({ url, path }).then((payload) => ({ payload }));
        }
        default:
          return undefined;
      }
    },
  };
}
