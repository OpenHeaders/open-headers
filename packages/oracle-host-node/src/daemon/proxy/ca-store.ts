/**
 * Proxy CA lifecycle — mint, seal, project, and sign (PROXY_SECURITY.md
 * §2.1/§2.2/§2.7).
 *
 * The CA is generated on THIS machine at first trust, unique per
 * installation — never shipped, never shared, never transmitted. The
 * record persists in the `OH.proxyCa` sensitive slot, so the private
 * key is sealed by the host's `SecretCipher` and a cipher-less host
 * refuses the write outright (fail loud, never plaintext). Everything
 * that leaves this module for a surface is the derived public
 * projection; the key material stays inside the host process.
 *
 * Minting uses `@peculiar/x509` over Node's WebCrypto — a vetted
 * library, never a hand-rolled ASN.1 path. Modern parameters only:
 * ECDSA P-256 with SHA-256 for both CA and leaves. Leaf certs are
 * short-lived, per-host SANs, signed by the CA; the leaf key is
 * ephemeral (caller-held, per session) and never persisted.
 */

import 'reflect-metadata';
import { createHash } from 'node:crypto';
import * as net from 'node:net';
import { ProxyCaRecordSchema } from '@openheaders/core/schemas';
import { hostStorage, OH } from '@openheaders/core/storage';
import type { ProxyCaPublicInfo, ProxyCaRecord } from '@openheaders/core/types';
import * as x509 from '@peculiar/x509';

const { subtle } = globalThis.crypto;

x509.cryptoProvider.set(globalThis.crypto);

/** Subject CN — also the keychain/NSS lookup name and NSS nickname. */
export const PROXY_CA_COMMON_NAME = 'Open Headers Proxy CA';
export const PROXY_CA_SUBJECT = `CN=${PROXY_CA_COMMON_NAME}, O=Open Headers`;

/** CA validity — long-lived like every local MITM root; leaves are the
 *  short-lived artifact. */
const CA_VALIDITY_YEARS = 10;
/** Leaf validity — short-lived by law (§2.7). */
const LEAF_VALIDITY_DAYS = 7;
/** Leaf notBefore backdate — absorbs client/host clock skew. */
const LEAF_BACKDATE_MS = 5 * 60 * 1000;

const SIGNING_ALG: EcKeyGenParams & { hash: string } = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };

export interface CertFingerprints {
  sha256: string;
  sha1: string;
}

/** Hex fingerprints of a PEM certificate's DER bytes. */
export function certFingerprints(certPem: string): CertFingerprints {
  const der = Buffer.from(new x509.X509Certificate(certPem).rawData);
  return {
    sha256: createHash('sha256').update(der).digest('hex'),
    sha1: createHash('sha1').update(der).digest('hex'),
  };
}

/** Random positive serial — 16 bytes, top bit cleared so DER stays positive. */
function randomSerialHex(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[0] = bytes[0] & 0x7f;
  return Buffer.from(bytes).toString('hex');
}

/**
 * Public projection — the ONLY CA shape surfaces ever see. Derived
 * from the stored cert at consume time, never cached as truth.
 */
export function proxyCaPublicInfo(record: ProxyCaRecord): ProxyCaPublicInfo {
  const cert = new x509.X509Certificate(record.certPem);
  return {
    subject: cert.subject,
    fingerprintSha256: certFingerprints(record.certPem).sha256,
    notBeforeIso: cert.notBefore.toISOString(),
    notAfterIso: cert.notAfter.toISOString(),
    createdAt: record.createdAt,
  };
}

/** Mint a fresh per-machine CA record. Pure of storage — `ensureProxyCa` persists. */
export async function mintProxyCa(now: () => number = Date.now): Promise<ProxyCaRecord> {
  const keys = await subtle.generateKey(SIGNING_ALG, true, ['sign', 'verify']);
  const notBefore = new Date(now());
  const notAfter = new Date(now());
  notAfter.setFullYear(notAfter.getFullYear() + CA_VALIDITY_YEARS);
  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: randomSerialHex(),
    name: PROXY_CA_SUBJECT,
    notBefore,
    notAfter,
    signingAlgorithm: SIGNING_ALG,
    keys,
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
    ],
  });
  const pkcs8 = await subtle.exportKey('pkcs8', keys.privateKey);
  return {
    version: 1,
    certPem: cert.toString('pem'),
    privateKeyPkcs8B64: Buffer.from(pkcs8).toString('base64'),
    createdAt: now(),
  };
}

/**
 * Read the sealed CA slot. `null` = never minted; `'undecryptable'` =
 * a record exists but cannot be opened (cipher down or key lost) —
 * callers must surface that honestly, never remint over it.
 */
export async function readProxyCa(): Promise<ProxyCaRecord | 'undecryptable' | null> {
  const read = hostStorage.getValidatedGuarded;
  if (read) {
    const opened = await read(OH.proxyCa, ProxyCaRecordSchema);
    if (opened.status === 'undecryptable') return 'undecryptable';
    if (opened.status === 'absent') return null;
    return opened.value;
  }
  return (await hostStorage.getValidated(OH.proxyCa, ProxyCaRecordSchema)) ?? null;
}

/**
 * The first-trust mint: returns the existing CA or mints + seals a new
 * one. Throws when the sealed slot is present-but-undecryptable (a
 * remint would silently orphan whatever trust the old CA still holds)
 * and when the host has no cipher (the sensitive write refuses).
 */
export async function ensureProxyCa(now: () => number = Date.now): Promise<ProxyCaRecord> {
  const existing = await readProxyCa();
  if (existing === 'undecryptable') {
    throw new Error('proxy CA record exists but cannot be decrypted — refusing to mint a replacement over it');
  }
  if (existing !== null) return existing;
  const minted = await mintProxyCa(now);
  await hostStorage.set(OH.proxyCa, minted);
  return minted;
}

/** Drop the sealed CA slot — teardown-only, after every trust-store row is undone. */
export async function dropProxyCa(): Promise<void> {
  await hostStorage.remove(OH.proxyCa);
}

export interface LeafCertificate {
  certPem: string;
  privateKeyPkcs8B64: string;
}

/**
 * Mint a short-lived leaf for `hosts` (DNS names and/or IP literals),
 * signed by the CA. `leafKeys` lets one ephemeral session key back
 * every leaf (§2.7); omitted, a fresh pair is generated.
 */
export async function mintLeafCertificate(
  ca: ProxyCaRecord,
  hosts: readonly string[],
  leafKeys?: CryptoKeyPair,
  now: () => number = Date.now,
): Promise<LeafCertificate> {
  if (hosts.length === 0) throw new Error('leaf certificate needs at least one host');
  const caCert = new x509.X509Certificate(ca.certPem);
  const caKey = await subtle.importKey('pkcs8', Buffer.from(ca.privateKeyPkcs8B64, 'base64'), SIGNING_ALG, false, [
    'sign',
  ]);
  const keys = leafKeys ?? (await subtle.generateKey(SIGNING_ALG, true, ['sign', 'verify']));
  const cert = await x509.X509CertificateGenerator.create({
    serialNumber: randomSerialHex(),
    subject: `CN=${hosts[0]}`,
    issuer: caCert.subject,
    notBefore: new Date(now() - LEAF_BACKDATE_MS),
    notAfter: new Date(now() + LEAF_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
    signingAlgorithm: SIGNING_ALG,
    publicKey: keys.publicKey,
    signingKey: caKey,
    extensions: [
      new x509.BasicConstraintsExtension(false, undefined, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
      new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
      new x509.SubjectAlternativeNameExtension(
        hosts.map((host): x509.JsonGeneralName => ({ type: net.isIP(host) ? 'ip' : 'dns', value: host })),
      ),
      await x509.AuthorityKeyIdentifierExtension.create(caCert),
    ],
  });
  const pkcs8 = await subtle.exportKey('pkcs8', keys.privateKey);
  return {
    certPem: cert.toString('pem'),
    privateKeyPkcs8B64: Buffer.from(pkcs8).toString('base64'),
  };
}
