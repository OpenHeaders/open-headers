/**
 * TLS facts off a ready socket — the negotiated protocol and cipher,
 * the peer's presented LEAF (subject, issuer, validity, SHA-256, the
 * PEM a trust gesture pins) and the runtime's own verdict on it:
 * `authorized`, or the verification code the dial proceeded past when
 * verification was off. Read once at readiness (the instrumented
 * dial's `completeConnectionRecord`), attribution only.
 *
 * Node hands the peer certificate as a parsed record with DER bytes;
 * the PEM is re-encoded here so the response surface and the device
 * trust store see the exact material the server presented.
 */

import type { DetailedPeerCertificate, PeerCertificate, TLSSocket } from 'node:tls';
import type { ExecutedPeerCertificate, ExecutedTlsFacts } from '@openheaders/core/types';

/** `{ CN, O, … }` → `CN=…, O=…` — CN first, the rest in Node's order. */
export function distinguishedNameOf(name: PeerCertificate['subject'] | undefined): string {
  if (name === undefined) return '';
  const entries = Object.entries(name as Record<string, string | string[]>);
  const ordered = [...entries.filter(([k]) => k === 'CN'), ...entries.filter(([k]) => k !== 'CN')];
  return ordered.map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('+') : v}`).join(', ');
}

/** DER → PEM, 64-column body. */
export function pemOfDer(der: Buffer): string {
  const body =
    der
      .toString('base64')
      .match(/.{1,64}/g)
      ?.join('\n') ?? '';
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
}

/** Node's `valid_from` / `valid_to` are RFC 2822-ish date strings. */
function isoOf(nodeDate: string): string {
  const ms = Date.parse(nodeDate);
  return Number.isNaN(ms) ? nodeDate : new Date(ms).toISOString();
}

/** `AB:CD:…` → lowercase hex. */
function hexOfFingerprint(fingerprint: string): string {
  return fingerprint.replace(/:/g, '').toLowerCase();
}

export function peerCertificateOf(cert: DetailedPeerCertificate | PeerCertificate): ExecutedPeerCertificate {
  const issuerFingerprint =
    'issuerCertificate' in cert && cert.issuerCertificate !== undefined
      ? cert.issuerCertificate.fingerprint256
      : undefined;
  return {
    subject: distinguishedNameOf(cert.subject),
    issuer: distinguishedNameOf(cert.issuer),
    notBefore: isoOf(cert.valid_from),
    notAfter: isoOf(cert.valid_to),
    fingerprintSha256: hexOfFingerprint(cert.fingerprint256),
    selfSigned:
      issuerFingerprint === undefined ? cert.fingerprint256 === undefined : issuerFingerprint === cert.fingerprint256,
    pem: pemOfDer(cert.raw),
  };
}

/** An empty record (no certificate negotiated) reads as "no facts". */
function presented(cert: DetailedPeerCertificate): boolean {
  return cert !== null && typeof cert === 'object' && Object.keys(cert).length > 0 && cert.raw !== undefined;
}

export function tlsFactsOf(socket: TLSSocket): ExecutedTlsFacts {
  const protocol = socket.getProtocol();
  const cipher = socket.getCipher();
  const cert = socket.getPeerCertificate(true);
  const authorizationError = socket.authorizationError as unknown as { code?: string } | string | null | undefined;
  const errorCode =
    typeof authorizationError === 'string'
      ? authorizationError
      : authorizationError && typeof authorizationError === 'object' && typeof authorizationError.code === 'string'
        ? authorizationError.code
        : undefined;
  return {
    ...(protocol !== null ? { protocol } : {}),
    ...(cipher?.name !== undefined ? { cipher: cipher.name } : {}),
    authorized: socket.authorized,
    ...(errorCode !== undefined ? { authorizationError: errorCode } : {}),
    ...(presented(cert) ? { certificate: peerCertificateOf(cert) } : {}),
  };
}
