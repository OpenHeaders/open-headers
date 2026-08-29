/**
 * The TLS policy one session dial carries — the executor-side twin of
 * the request kinds' shared `TlsPolicy` fields: verification, the
 * workspace trust list, the client certificate resolved from the
 * vault, the version window, the cipher list, and the SNI override
 * resolved through the session's template scope. One composer for the
 * WebSocket, gRPC and MQTT executors (the HTTP resolver composes its
 * own resolved shape but shares the certificate step), so every
 * session hands its transport the same keys with the same absent-means-
 * default discipline.
 */

import type { TlsPolicy, TlsVersion, Vault } from '@openheaders/core/types';

export interface ResolvedClientCertificate {
  /** The vault entry NAME — always passes through when set, even
   *  unresolved, so the honoring transport fails the dial loudly
   *  instead of silently connecting without a certificate. */
  clientCertificateRef?: string;
  /** PEM material, present only when the named entry exists on this
   *  device with the right kind. */
  clientCertificatePem?: string;
  clientCertificateKeyPem?: string;
  clientCertificatePassphrase?: string;
}

/** The policy slice a session transport request carries. */
export interface SessionTlsPolicy extends ResolvedClientCertificate {
  sslVerification?: boolean;
  trustedRootsPem?: string[];
  tlsMinVersion?: TlsVersion;
  tlsMaxVersion?: TlsVersion;
  tlsCipherSuites?: string;
  sniServerName?: string;
}

/**
 * Resolve a `clientCertificateRef` against the local vault. The ref
 * always passes through when set — even unresolved — so the honoring
 * transport can fail the send loudly instead of silently dialing
 * without a certificate; the PEM material attaches only when the named
 * entry exists on this device with the right kind. A host-injected
 * resolution carries no vault: the ref then passes through bare.
 */
export function resolveClientCertificate(ref: string | undefined, vault: Vault | undefined): ResolvedClientCertificate {
  if (ref === undefined) return {};
  const entry = vault?.secrets.find((s) => s.kind === 'client-certificate' && s.name === ref);
  if (entry?.kind !== 'client-certificate') return { clientCertificateRef: ref };
  return {
    clientCertificateRef: ref,
    clientCertificatePem: entry.cert,
    clientCertificateKeyPem: entry.key,
    ...(entry.passphrase !== undefined ? { clientCertificatePassphrase: entry.passphrase } : {}),
  };
}

export interface SessionTlsPolicyInput {
  request: TlsPolicy;
  /** The dial's trust list, already composed for the run. */
  trustedRootsPem: string[] | undefined;
  /** The vault the certificate ref resolves against — absent under a
   *  host-injected resolution. */
  vault: Vault | undefined;
  /** The session's template resolver — the SNI override is a template. */
  resolve: (template: string) => string;
}

/**
 * Compose the transport-facing policy: only the knobs the request set
 * ride (absent = the runtime default at the dial), the certificate ref
 * resolves to its PEM pair, the SNI override resolves and trims — an
 * empty resolution reads as no override.
 */
export function sessionTlsPolicy(input: SessionTlsPolicyInput): SessionTlsPolicy {
  const { request, trustedRootsPem, vault, resolve } = input;
  const sniServerName = request.sniServerName !== undefined ? resolve(request.sniServerName).trim() : '';
  return {
    ...(request.sslVerification !== undefined ? { sslVerification: request.sslVerification } : {}),
    ...(trustedRootsPem !== undefined ? { trustedRootsPem } : {}),
    ...resolveClientCertificate(request.clientCertificateRef, vault),
    ...(request.tlsMinVersion !== undefined ? { tlsMinVersion: request.tlsMinVersion } : {}),
    ...(request.tlsMaxVersion !== undefined ? { tlsMaxVersion: request.tlsMaxVersion } : {}),
    ...(request.tlsCipherSuites !== undefined ? { tlsCipherSuites: request.tlsCipherSuites } : {}),
    ...(sniServerName !== '' ? { sniServerName } : {}),
  };
}

const SESSION_TLS_POLICY_KEYS = [
  'sslVerification',
  'trustedRootsPem',
  'clientCertificateRef',
  'clientCertificatePem',
  'clientCertificateKeyPem',
  'clientCertificatePassphrase',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'sniServerName',
] as const;

/** The policy slice of a wider params object, defined keys only — a
 *  composed policy re-seated on a transport request downstream. */
export function pickSessionTlsPolicy(source: SessionTlsPolicy): SessionTlsPolicy {
  const out: Record<string, unknown> = {};
  for (const key of SESSION_TLS_POLICY_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out as SessionTlsPolicy;
}
