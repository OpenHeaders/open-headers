/**
 * The `serverSignIn` capability as a surface registers it when its host
 * process answers the `oh.serverSignIn.*` channels (the client sign-in
 * plan §14.9): the desktop renderer over its preload bridge to MAIN,
 * the extension's popup / workbench / side panel over the runtime
 * message channel to the service worker. One shim, both hosts — the
 * host process holds the in-flight flows, this side only relays.
 */

import { hostBridge } from '../bridge';
import type { ServerSignInApi } from '../capabilities/registry';

export function createBridgedServerSignIn(): ServerSignInApi {
  return {
    start: (input) => hostBridge.call('oh.serverSignIn.start', input),
    poll: (input) => hostBridge.call('oh.serverSignIn.poll', input),
    cancel: (input) => hostBridge.call('oh.serverSignIn.cancel', input).then(() => undefined),
    signOut: (input) => hostBridge.call('oh.serverSignIn.signOut', input),
    fetchMeta: (input) => hostBridge.call('oh.serverSignIn.meta', input).then((resp) => resp.payload),
  };
}
