/**
 * The trusted-roots host law in one place: Node's `ca` option REPLACES
 * the runtime bundle, so the workspace roots ride ADDITIVELY behind
 * `tls.rootCertificates`, and an empty list leaves the option unset —
 * the runtime default path stays byte-identical. Every node dial (the
 * HTTP dispatcher, the WS connector, the gRPC session options, the
 * MQTT `mqtts:` dial, the proxy's upstream leg) seats `ca` through
 * this helper so none of them forks the concat.
 */

import { rootCertificates } from 'node:tls';

export function caOptionFor(roots: readonly string[] | undefined): string[] | undefined {
  if (roots === undefined || roots.length === 0) return undefined;
  return [...rootCertificates, ...roots];
}
