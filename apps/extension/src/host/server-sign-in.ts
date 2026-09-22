/**
 * Extension implementation of the `serverSignIn` capability (the client
 * sign-in plan §7) — the wizard's "Sign in on <host>": the core wire
 * client bound to a page-side `fetch`, so every call carries the
 * extension's own origin, which the server's admission matrix admits on
 * `POST /pair`, `/pair/poll` and the three meta routes (pinned Chromium
 * ids; Gecko / Safari UUID origins pass on scheme). Like `pairWithCode`
 * it runs from the calling surface rather than relaying through the
 * service worker: the exchange is a one-shot user gesture that needs
 * none of the SW's powers, and the SW reacts to the token the step
 * writes onto the record. The approval page opens through the shared
 * `openExternalUrl` capability (the SW's tab open).
 */

import type { ServerSignInApi } from '@openheaders/core/capabilities';
import { createServerSignInClient } from '@openheaders/core/identity';
import { selfHostLabel } from '@/utils/self-host-label';

/**
 * The device label the server's page names this client by ("Chrome ·
 * macOS") — the host supplies it so the shared step stays host-neutral;
 * a caller's own label wins.
 */
export function createExtensionServerSignIn(
  fetchFn: typeof fetch = (...args) => fetch(...args),
  deviceLabel: () => string = selfHostLabel,
): ServerSignInApi {
  const client = createServerSignInClient({ client: 'extension', fetch: fetchFn });
  return {
    ...client,
    start: (input) => client.start({ ...input, deviceLabel: input.deviceLabel ?? deviceLabel() }),
  };
}
