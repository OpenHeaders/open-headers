/**
 * The `backendProbe` capability as a surface registers it when its
 * host process answers the `oh.backendProbe` channel: the desktop
 * renderer over its preload bridge to MAIN, whose Node socket carries
 * no Origin and sits under no document policy. One shim; the host
 * process opens the probe's socket, this side only relays the plain
 * options and the result.
 */

import { hostBridge } from '../bridge';
import type { Capabilities } from '../capabilities/registry';

export function createBridgedBackendProbe(): NonNullable<Capabilities['backendProbe']> {
  return (url, opts) => hostBridge.call('oh.backendProbe', { url, opts });
}
