/**
 * The trusted-roots host law in one place: Node's `ca` option REPLACES
 * the runtime bundle, so every extra anchor rides ADDITIVELY behind
 * `tls.rootCertificates` — the operating system's store when this
 * device opted in, then the workspace roots and device pins the dial
 * carries — and nothing to add leaves the option unset, so the runtime
 * default path stays byte-identical. Every node dial (the HTTP
 * dispatcher, the WS connector, the gRPC session options, the MQTT
 * `mqtts:` dial, the proxy's upstream leg) seats `ca` through this
 * helper so none of them forks the concat.
 */

import { rootCertificates } from 'node:tls';
import { isSystemTrustEnabled } from '@openheaders/oracle/entity/device-trust-store';
import { getSystemCaCertificates } from './system-trust';

export function caOptionFor(roots: readonly string[] | undefined): string[] | undefined {
  const system = isSystemTrustEnabled() ? getSystemCaCertificates() : [];
  const extra = roots ?? [];
  if (system.length === 0 && extra.length === 0) return undefined;
  return [...rootCertificates, ...system, ...extra];
}
