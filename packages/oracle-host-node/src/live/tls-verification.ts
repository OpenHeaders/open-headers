/**
 * The TLS verification failure family — the codes the node runtime
 * raises when the peer's certificate could not be trusted (as opposed
 * to a handshake, protocol or client-certificate failure). A dial that
 * failed on one of these is exactly the case a trust gesture repairs:
 * pin the presented certificate on this device, or add its issuer to
 * the workspace, and resend. Hostname mismatches are NOT in the family
 * — trusting the certificate would not make it name the host.
 *
 * One vocabulary for every node transport (HTTP, WS, gRPC, MQTT) and
 * the trust-certificate remedy they attach.
 */

import type { TrustCertificateErrorHint } from '@openheaders/core/types';

const TLS_VERIFICATION_CODES: ReadonlySet<string> = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_UNTRUSTED',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
]);

export function isTlsVerificationCode(code: string | undefined): code is string {
  return code !== undefined && TLS_VERIFICATION_CODES.has(code);
}

/**
 * The remedy for a verification failure against `url`: the endpoint
 * the probe should dial (the pinned address when the send resolved to
 * one, the URL's host otherwise) and the SNI name that endpoint must
 * be asked for when the two differ.
 */
export function trustCertificateHintFor(
  url: string,
  code: string,
  resolveToAddress?: string,
): TrustCertificateErrorHint | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  const port = parsed.port !== '' ? Number(parsed.port) : defaultPortOf(parsed.protocol);
  if (port === undefined) return undefined;
  const host = resolveToAddress ?? hostname;
  return {
    kind: 'trust-certificate',
    certificate: true,
    host,
    port,
    ...(host !== hostname ? { servername: hostname } : {}),
    code,
    netError: code,
  };
}

function defaultPortOf(protocol: string): number | undefined {
  switch (protocol) {
    case 'https:':
    case 'wss:':
      return 443;
    case 'mqtts:':
      return 8883;
    default:
      return undefined;
  }
}
