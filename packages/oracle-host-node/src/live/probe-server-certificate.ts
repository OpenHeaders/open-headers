/**
 * Presented-chain probe — the trust-on-failure primitive. Dials
 * `host:port` with verification OFF, reads the chain the server
 * presents once the handshake completes, and closes: no request bytes
 * are ever written, nothing is trusted by the probe itself. The chain
 * comes back leaf first with each certificate's PEM and derived
 * summary, so the response surface can show what a trust gesture
 * would pin before the user decides.
 */

import { connect, type DetailedPeerCertificate } from 'node:tls';
import type { PresentedCertificateWire } from '@openheaders/core/bridge';
import { summarizeCertificatePem } from '@openheaders/core/utils';
import { pemOfDer } from './tls-facts';

const PROBE_TIMEOUT_MS = 5_000;

export interface ProbeTarget {
  host: string;
  port: number;
  servername?: string;
}

/** Walk `issuerCertificate` links until the chain ends or loops back on itself. */
export function presentedChainPems(leaf: DetailedPeerCertificate): string[] {
  const pems: string[] = [];
  const seen = new Set<string>();
  let current: DetailedPeerCertificate | undefined = leaf;
  while (current !== undefined && current.raw !== undefined && !seen.has(current.fingerprint256)) {
    seen.add(current.fingerprint256);
    pems.push(pemOfDer(current.raw));
    const issuer: DetailedPeerCertificate | undefined = current.issuerCertificate;
    current = issuer !== undefined && issuer.fingerprint256 === current.fingerprint256 ? undefined : issuer;
  }
  return pems;
}

export async function probeServerCertificate(target: ProbeTarget): Promise<PresentedCertificateWire[]> {
  const pems = await new Promise<string[]>((resolve, reject) => {
    const socket = connect({
      host: target.host,
      port: target.port,
      servername: target.servername ?? (/^[\d.]+$|:/.test(target.host) ? undefined : target.host),
      rejectUnauthorized: false,
    });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Probe of ${target.host}:${target.port} timed out.`));
    }, PROBE_TIMEOUT_MS);
    socket.once('secureConnect', () => {
      clearTimeout(timer);
      const leaf = socket.getPeerCertificate(true);
      socket.end();
      resolve(presentedChainPems(leaf));
    });
    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  const chain: PresentedCertificateWire[] = [];
  for (const [index, pem] of pems.entries()) {
    const summary = await summarizeCertificatePem(pem);
    chain.push({ pem, summary, selfSigned: summary.subject === summary.issuer && index === pems.length - 1 });
  }
  return chain;
}
