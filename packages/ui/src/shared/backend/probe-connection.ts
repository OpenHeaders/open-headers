/**
 * The backend probe as shared UI runs it (the wizard's sign-in step,
 * "Test connection", the enable gate): the host's `backendProbe`
 * capability when one is registered — the desktop renderer, whose CSP
 * forbids a dial, relays to MAIN over the bridge — else the core probe
 * over this surface's own socket (the extension's pages, the served
 * tab). The callers never learn which; the result union is core's.
 */

import { getCapability } from '@openheaders/core/capabilities';
import {
  type ProbeConnectionResult,
  type ProbeOptions,
  probeBackendConnection as probeOverOwnSocket,
} from '@openheaders/core/identity';

export type {
  ProbeConnectionResult,
  ProbeFailure,
  ProbeFailureReason,
  ProbeOptions,
} from '@openheaders/core/identity';

/** Reachability + protocol handshake, by the host's process when it registers one. */
export function probeBackendConnection(url: string, opts: ProbeOptions): Promise<ProbeConnectionResult> {
  const hostProbe = getCapability('backendProbe');
  return hostProbe ? hostProbe(url, opts) : probeOverOwnSocket(url, opts);
}
