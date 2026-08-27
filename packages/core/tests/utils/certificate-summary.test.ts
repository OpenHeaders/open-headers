import 'reflect-metadata';
import * as x509 from '@peculiar/x509';
import { beforeAll, describe, expect, it } from 'vitest';
import { splitPemChain, summarizeCertificatePem } from '../../src/utils/certificate-summary';

x509.cryptoProvider.set(globalThis.crypto);

const ALG: EcKeyGenParams & { hash: string } = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };

let caPem = '';
let leafPem = '';

beforeAll(async () => {
  const caKeys = await globalThis.crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const ca = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: '01',
    name: 'CN=OpenHeaders Test Root, O=openheaders.io',
    notBefore: new Date('2026-01-01T00:00:00Z'),
    notAfter: new Date('2036-01-01T00:00:00Z'),
    signingAlgorithm: ALG,
    keys: caKeys,
    extensions: [new x509.BasicConstraintsExtension(true, 0, true)],
  });
  caPem = ca.toString('pem');
  const leafKeys = await globalThis.crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const leaf = await x509.X509CertificateGenerator.create({
    serialNumber: '02',
    subject: 'CN=broker.openheaders.io',
    issuer: ca.subject,
    notBefore: new Date('2026-01-01T00:00:00Z'),
    notAfter: new Date('2027-01-01T00:00:00Z'),
    signingAlgorithm: ALG,
    publicKey: leafKeys.publicKey,
    signingKey: caKeys.privateKey,
    extensions: [new x509.BasicConstraintsExtension(false, undefined, true)],
  });
  leafPem = leaf.toString('pem');
});

describe('summarizeCertificatePem', () => {
  it('reports a CA root with its subject, window and a hex SHA-256 fingerprint', async () => {
    const summary = await summarizeCertificatePem(caPem);
    expect(summary.isCa).toBe(true);
    expect(summary.subject).toContain('CN=OpenHeaders Test Root');
    expect(summary.issuer).toBe(summary.subject);
    expect(summary.notBefore).toBe('2026-01-01T00:00:00.000Z');
    expect(summary.notAfter).toBe('2036-01-01T00:00:00.000Z');
    expect(summary.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(summary.chainLength).toBe(1);
  });

  it('flags a leaf as not a CA', async () => {
    const summary = await summarizeCertificatePem(leafPem);
    expect(summary.isCa).toBe(false);
    expect(summary.subject).toBe('CN=broker.openheaders.io');
    expect(summary.issuer).toContain('CN=OpenHeaders Test Root');
  });

  it('a pasted chain is one root: the first certificate summarized, chainLength counted', async () => {
    const chain = `${leafPem}\n${caPem}`;
    const summary = await summarizeCertificatePem(chain);
    expect(summary.chainLength).toBe(2);
    expect(summary.subject).toBe('CN=broker.openheaders.io');
    expect(splitPemChain(chain)).toHaveLength(2);
  });

  it('rejects material without a certificate block', async () => {
    await expect(summarizeCertificatePem('not a cert')).rejects.toThrow('no certificate block');
    expect(splitPemChain('')).toEqual([]);
  });
});
