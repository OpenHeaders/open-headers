/**
 * The product token every node-host dial identifies itself with —
 * `OpenHeaders/<app version>`, the shape API clients conventionally
 * send (product/version, nothing else: no platform suffix, no host
 * tag, so a request looks the same wherever the workspace runs). A
 * host that knows no version sends the bare product name rather than
 * an anonymous runtime default.
 */
export function productUserAgent(version?: string): string {
  return version !== undefined && version.length > 0 ? `OpenHeaders/${version}` : 'OpenHeaders';
}
