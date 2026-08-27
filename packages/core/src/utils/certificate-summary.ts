/**
 * Certificate summary — the read-side projection of a trusted root.
 *
 * Subject, issuer, SHA-256 fingerprint, validity window and the CA
 * flag are derived from `certPem` at read time and never stored (the
 * `ProxyCaPublicInfo` law). Platform-neutral: `@peculiar/x509` over
 * WebCrypto, so the workbench renders the same summary on every host.
 *
 * A PEM chain is ONE root row (the S1 chain law); the summary reports
 * the first certificate's identity plus `chainLength`.
 */

import 'reflect-metadata';
import * as x509 from '@peculiar/x509';

x509.cryptoProvider.set(globalThis.crypto);

export interface CertificateSummary {
  subject: string;
  issuer: string;
  /** Lowercase hex SHA-256 over the DER bytes of the first certificate. */
  fingerprintSha256: string;
  /** ISO-8601 validity window of the first certificate. */
  notBefore: string;
  notAfter: string;
  /** `true` when Basic Constraints marks the first certificate as a CA. */
  isCa: boolean;
  /** Number of PEM certificate blocks in the pasted material. */
  chainLength: number;
}

const PEM_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

/** Every `CERTIFICATE` PEM block in `pem`, in order; `[]` when none. */
export function splitPemChain(pem: string): string[] {
  return pem.match(PEM_BLOCK) ?? [];
}

/**
 * Summarize a PEM certificate (or chain). Rejects with the parser's
 * error on malformed input; an empty string / no PEM block rejects
 * with `no certificate block`.
 */
export async function summarizeCertificatePem(pem: string): Promise<CertificateSummary> {
  const blocks = splitPemChain(pem);
  if (blocks.length === 0) throw new Error('no certificate block');
  const cert = new x509.X509Certificate(blocks[0]);
  const digest = await crypto.subtle.digest('SHA-256', cert.rawData);
  return {
    subject: cert.subject,
    issuer: cert.issuer,
    fingerprintSha256: toHex(digest),
    notBefore: cert.notBefore.toISOString(),
    notAfter: cert.notAfter.toISOString(),
    isCa: cert.getExtension(x509.BasicConstraintsExtension)?.ca ?? false,
    chainLength: blocks.length,
  };
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}
