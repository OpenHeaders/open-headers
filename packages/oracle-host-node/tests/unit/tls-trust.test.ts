/**
 * The device-trust host seam, end to end over a live TLS server:
 * socket facts read at readiness (protocol, cipher, presented leaf,
 * the runtime's verdict), the presented-chain probe, the verification
 * vocabulary and the trust-certificate remedy the wire classifier
 * attaches, and the real dial — an unverified send stamps the facts,
 * a verified send against an untrusted server fails WITH the remedy,
 * and the same send with the CA pinned verifies clean.
 */

import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import {
  createServer as createTlsServer,
  type TLSSocket,
  type Server as TlsServer,
  connect as tlsConnect,
} from 'node:tls';
import { TransportError } from '@openheaders/oracle/live/request-exec/transport';
import { afterEach, describe, expect, it } from 'vitest';
import { mintLeafCertificate, mintProxyCa } from '../../src/daemon/proxy/ca-store';
import { createNodeRequestTransport } from '../../src/live/node-request-transport';
import { presentedChainPems, probeServerCertificate } from '../../src/live/probe-server-certificate';
import { classifiedWireError } from '../../src/live/request-transport/classify-error';
import { distinguishedNameOf, pemOfDer, tlsFactsOf } from '../../src/live/tls-facts';
import { isTlsVerificationCode, trustCertificateHintFor } from '../../src/live/tls-verification';
import { makeRequest } from './request-transport/helpers';

function keyPem(pkcs8B64: string): string {
  const body = pkcs8B64.match(/.{1,64}/g)?.join('\n') ?? pkcs8B64;
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

const servers: TlsServer[] = [];

/** A TLS server whose leaf chains to a fresh private CA; `presentCa`
 *  appends the CA to the served chain (the usual deployment). */
async function startPrivateCaServer(presentCa: boolean): Promise<{ port: number; caPem: string; leafPem: string }> {
  const ca = await mintProxyCa();
  const leaf = await mintLeafCertificate(ca, ['127.0.0.1']);
  const server = createTlsServer(
    {
      key: keyPem(leaf.privateKeyPkcs8B64),
      cert: presentCa ? `${leaf.certPem.trim()}\n${ca.certPem.trim()}\n` : leaf.certPem,
    },
    (socket) => {
      socket.on('data', () => {
        socket.end('HTTP/1.1 200 OK\r\ncontent-length: 2\r\nconnection: close\r\n\r\nok');
      });
    },
  );
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return { port: (server.address() as AddressInfo).port, caPem: ca.certPem, leafPem: leaf.certPem };
}

function handshake(port: number, ca?: string[]): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host: '127.0.0.1', port, rejectUnauthorized: false, ...(ca ? { ca } : {}) });
    socket.once('secureConnect', () => resolve(socket));
    socket.once('error', reject);
  });
}

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe('tls-facts', () => {
  it('formats a distinguished name CN-first and re-encodes DER as 64-column PEM', () => {
    expect(distinguishedNameOf({ O: 'Open Headers', CN: 'localhost' } as never)).toBe('CN=localhost, O=Open Headers');
    expect(distinguishedNameOf(undefined)).toBe('');
    const pem = pemOfDer(Buffer.alloc(100, 1));
    expect(pem.startsWith('-----BEGIN CERTIFICATE-----\n')).toBe(true);
    expect(pem.endsWith('-----END CERTIFICATE-----\n')).toBe(true);
    expect(pem.split('\n')[1]).toHaveLength(64);
  });

  it('reads the presented leaf and the runtime verdict off a ready socket', async () => {
    const { port, caPem, leafPem } = await startPrivateCaServer(true);
    const untrusted = await handshake(port);
    const facts = tlsFactsOf(untrusted);
    untrusted.end();
    expect(facts.authorized).toBe(false);
    expect(facts.authorizationError).toBe('SELF_SIGNED_CERT_IN_CHAIN');
    expect(facts.protocol).toMatch(/^TLSv1\./);
    expect(facts.cipher).toBeDefined();
    expect(facts.certificate?.subject).toContain('CN=127.0.0.1');
    expect(facts.certificate?.selfSigned).toBe(false);
    expect(facts.certificate?.pem.replace(/\s/g, '')).toBe(leafPem.replace(/\s/g, ''));
    expect(facts.certificate?.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/);

    const trusted = await handshake(port, [caPem]);
    const verified = tlsFactsOf(trusted);
    trusted.end();
    expect(verified.authorized).toBe(true);
    expect(verified.authorizationError).toBeUndefined();
  });
});

describe('probeServerCertificate', () => {
  it('returns the presented chain leaf first, the self-signed root last, without trusting anything', async () => {
    const { port, caPem, leafPem } = await startPrivateCaServer(true);
    const chain = await probeServerCertificate({ host: '127.0.0.1', port });
    expect(chain).toHaveLength(2);
    expect(chain[0]?.pem.replace(/\s/g, '')).toBe(leafPem.replace(/\s/g, ''));
    expect(chain[0]?.selfSigned).toBe(false);
    expect(chain[0]?.summary.isCa).toBe(false);
    expect(chain[1]?.pem.replace(/\s/g, '')).toBe(caPem.replace(/\s/g, ''));
    expect(chain[1]?.selfSigned).toBe(true);
    expect(chain[1]?.summary.isCa).toBe(true);
  });

  it('a server that presents only its leaf yields a one-link chain', async () => {
    const { port } = await startPrivateCaServer(false);
    const chain = await probeServerCertificate({ host: '127.0.0.1', port });
    expect(chain).toHaveLength(1);
    expect(chain[0]?.selfSigned).toBe(false);
  });

  it('a closed port rejects instead of hanging', async () => {
    const { port } = await startPrivateCaServer(false);
    for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
    await expect(probeServerCertificate({ host: '127.0.0.1', port })).rejects.toThrow();
  });

  it('presentedChainPems stops at a self-referential issuer link', () => {
    const root = { raw: Buffer.from('r'), fingerprint256: 'R' } as never;
    (root as { issuerCertificate: unknown }).issuerCertificate = root;
    const leaf = { raw: Buffer.from('l'), fingerprint256: 'L', issuerCertificate: root } as never;
    expect(presentedChainPems(leaf)).toHaveLength(2);
    expect(presentedChainPems(root)).toHaveLength(1);
  });
});

describe('tls-verification', () => {
  it('names the verification family and leaves hostname mismatches out', () => {
    expect(isTlsVerificationCode('DEPTH_ZERO_SELF_SIGNED_CERT')).toBe(true);
    expect(isTlsVerificationCode('SELF_SIGNED_CERT_IN_CHAIN')).toBe(true);
    expect(isTlsVerificationCode('CERT_HAS_EXPIRED')).toBe(true);
    expect(isTlsVerificationCode('ERR_TLS_CERT_ALTNAME_INVALID')).toBe(false);
    expect(isTlsVerificationCode('ECONNREFUSED')).toBe(false);
    expect(isTlsVerificationCode(undefined)).toBe(false);
  });

  it('the remedy targets the URL endpoint, or the pinned address with the hostname as SNI', () => {
    expect(trustCertificateHintFor('https://api.openheaders.io/v1', 'CERT_HAS_EXPIRED')).toEqual({
      kind: 'trust-certificate',
      certificate: true,
      host: 'api.openheaders.io',
      port: 443,
      code: 'CERT_HAS_EXPIRED',
      netError: 'CERT_HAS_EXPIRED',
    });
    expect(trustCertificateHintFor('https://api.openheaders.io:8443/', 'CERT_UNTRUSTED', '10.0.0.5')).toMatchObject({
      host: '10.0.0.5',
      port: 8443,
      servername: 'api.openheaders.io',
    });
    expect(trustCertificateHintFor('wss://[::1]:3443/ws', 'DEPTH_ZERO_SELF_SIGNED_CERT')).toMatchObject({
      host: '::1',
      port: 3443,
    });
    expect(trustCertificateHintFor('not a url', 'CERT_UNTRUSTED')).toBeUndefined();
    expect(trustCertificateHintFor('ftp://x/', 'CERT_UNTRUSTED')).toBeUndefined();
  });

  it('the wire classifier attaches the remedy only for the verification family', () => {
    const verify = Object.assign(new Error('fetch failed'), {
      cause: Object.assign(new Error('self signed'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }),
    });
    const classified = classifiedWireError('https://127.0.0.1:3443/echo', verify, makeRequest());
    expect(classified).toBeInstanceOf(TransportError);
    expect(classified.hint).toMatchObject({ kind: 'trust-certificate', host: '127.0.0.1', port: 3443 });
    const refused = Object.assign(new Error('fetch failed'), {
      cause: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }),
    });
    expect(classifiedWireError('https://127.0.0.1:3443/echo', refused, makeRequest()).hint).toBeUndefined();
  });
});

describe('node transport — trust on the wire', () => {
  it('an unverified send stamps the TLS facts with the honest verdict; a verified one fails with the remedy; the pinned CA verifies', async () => {
    const { port, caPem } = await startPrivateCaServer(true);
    const transport = createNodeRequestTransport();
    const url = `https://127.0.0.1:${port}/echo`;

    const unverified = await transport.send(makeRequest({ url, captureNetwork: true, sslVerification: false }));
    expect(unverified.status).toBe(200);
    expect(unverified.network?.tls?.authorized).toBe(false);
    expect(unverified.network?.tls?.authorizationError).toBe('SELF_SIGNED_CERT_IN_CHAIN');
    expect(unverified.network?.tls?.certificate?.subject).toContain('CN=127.0.0.1');

    let failure: unknown;
    try {
      await transport.send(makeRequest({ url, captureNetwork: true, sslVerification: true }));
    } catch (err) {
      failure = err;
    }
    expect(failure).toBeInstanceOf(TransportError);
    expect((failure as TransportError).hint).toMatchObject({
      kind: 'trust-certificate',
      host: '127.0.0.1',
      port,
      code: 'SELF_SIGNED_CERT_IN_CHAIN',
    });

    const verified = await transport.send(
      makeRequest({ url, captureNetwork: true, sslVerification: true, trustedRootsPem: [caPem] }),
    );
    expect(verified.status).toBe(200);
    expect(verified.network?.tls?.authorized).toBe(true);
    expect(verified.network?.tls?.authorizationError).toBeUndefined();
  });
});
