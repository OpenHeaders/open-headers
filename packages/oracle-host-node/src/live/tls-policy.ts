/**
 * The TLS policy → `tls.connect` option bag — ONE mapping for every
 * dial the node host makes: the HTTP dispatcher's connect bag, the
 * WebSocket connector, the gRPC HTTP/2 session, the MQTT socket. The
 * request kinds share one policy shape (verification, workspace trust
 * list, client certificate, version window, cipher list, SNI
 * override), so the bag they map onto is minted here and spread by
 * each transport beside its own dial fields (host, port, ALPN, socket
 * path). Pure — testable without a live socket.
 */

import { createSecureContext, type SecureVersion } from 'node:tls';
import type { TlsVersion } from '@openheaders/core/types';
import { caOptionFor } from './trusted-roots-ca';

/** The policy slice every transport request carries. */
export interface TlsPolicyRequest {
  sslVerification?: boolean;
  trustedRootsPem?: string[];
  clientCertificatePem?: string;
  clientCertificateKeyPem?: string;
  clientCertificatePassphrase?: string;
  tlsMinVersion?: TlsVersion;
  tlsMaxVersion?: TlsVersion;
  tlsCipherSuites?: string;
  sniServerName?: string;
}

/** The `tls.connect` options the policy maps onto — only the keys the
 *  policy set; a fully-default policy maps to an empty bag. */
export interface TlsPolicyOptions {
  rejectUnauthorized?: false;
  /** The runtime bundle plus the workspace trusted roots — always the
   *  additive concat (`caOptionFor`), never a replacement. */
  ca?: string[];
  cert?: string;
  key?: string;
  passphrase?: string;
  minVersion?: SecureVersion;
  maxVersion?: SecureVersion;
  ciphers?: string;
  servername?: string;
}

/** Seam value (`'1.2'`) → Node `tls.connect` version token (`'TLSv1.2'`). */
const TLS_VERSION_TOKEN: Record<TlsVersion, SecureVersion> = {
  '1.0': 'TLSv1',
  '1.1': 'TLSv1.1',
  '1.2': 'TLSv1.2',
  '1.3': 'TLSv1.3',
};

/**
 * Cipher list a lowered TLS floor needs on THIS runtime's TLS stack,
 * probed once. OpenSSL 3 disallows the legacy signature algorithms a
 * TLS < 1.2 handshake needs at its default security level, so a lowered
 * floor alone can never negotiate 1.0/1.1 (probed live:
 * ERR_SSL_LEGACY_SIGALG_DISALLOWED_OR_UNSUPPORTED) — `@SECLEVEL=0` on
 * the default suites is what makes the knob honorable. BoringSSL
 * (Electron's stack) REJECTS the `@SECLEVEL` syntax outright
 * (ERR_SSL_INVALID_COMMAND) and has no security-level gate — a lowered
 * floor negotiates plain there (both probed live in each runtime).
 */
let legacyFloorCiphers: string | null | undefined;
export function legacyFloorCipherDefault(): string | undefined {
  if (legacyFloorCiphers === undefined) {
    try {
      createSecureContext({ ciphers: 'DEFAULT@SECLEVEL=0' });
      legacyFloorCiphers = 'DEFAULT@SECLEVEL=0';
    } catch {
      legacyFloorCiphers = null;
    }
  }
  return legacyFloorCiphers ?? undefined;
}

/**
 * The option bag a request's TLS policy maps to. Verification stays on
 * unless the request opted out (the roots still ride); the workspace
 * roots append behind the runtime bundle; the client certificate pair
 * rides when the executor resolved it; the version window translates
 * to Node's tokens; an explicit cipher list wins verbatim, else a
 * lowered floor supplies what this stack needs to honor it; the SNI
 * override rides trimmed — a blank one is no override.
 */
export function tlsPolicyOptionsFor(request: TlsPolicyRequest): TlsPolicyOptions {
  const options: TlsPolicyOptions = {};
  if (request.sslVerification === false) options.rejectUnauthorized = false;
  const ca = caOptionFor(request.trustedRootsPem);
  if (ca !== undefined) options.ca = ca;
  if (request.clientCertificatePem !== undefined) options.cert = request.clientCertificatePem;
  if (request.clientCertificateKeyPem !== undefined) options.key = request.clientCertificateKeyPem;
  if (request.clientCertificatePassphrase !== undefined) options.passphrase = request.clientCertificatePassphrase;
  if (request.tlsMinVersion !== undefined) options.minVersion = TLS_VERSION_TOKEN[request.tlsMinVersion];
  if (request.tlsMaxVersion !== undefined) options.maxVersion = TLS_VERSION_TOKEN[request.tlsMaxVersion];
  if (request.tlsCipherSuites !== undefined) {
    options.ciphers = request.tlsCipherSuites;
  } else if (request.tlsMinVersion === '1.0' || request.tlsMinVersion === '1.1') {
    const legacy = legacyFloorCipherDefault();
    if (legacy !== undefined) options.ciphers = legacy;
  }
  const servername = request.sniServerName?.trim();
  if (servername !== undefined && servername !== '') options.servername = servername;
  return options;
}
