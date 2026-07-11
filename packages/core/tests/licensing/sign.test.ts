import { describe, expect, it } from 'vitest';
import {
  exportLicenseSigningKey,
  generateLicenseSigningKeys,
  importLicenseSigningKey,
  publicKeyFromSigningKey,
  signLicense,
  verifyLicense,
} from '../../src/licensing';
import { createDevSigner, DEV_KID, makeLicense } from './helpers/dev-license';

const IN_TERM = new Date(Date.UTC(2026, 3, 1));

describe('signing-key serialization', () => {
  it('round-trips a key through export/import and still signs verifiably', async () => {
    const { privateKey, publicKeyBase64Url } = await generateLicenseSigningKeys();
    const stored = await exportLicenseSigningKey(privateKey);
    const restored = await importLicenseSigningKey(stored);
    const text = await signLicense(makeLicense(), restored);
    const result = await verifyLicense(text, IN_TERM, { [DEV_KID]: publicKeyBase64Url });
    expect(result.status).toBe('licensed');
  });

  it('tolerates surrounding whitespace in the stored key', async () => {
    const { privateKey } = await generateLicenseSigningKeys();
    const stored = await exportLicenseSigningKey(privateKey);
    await expect(importLicenseSigningKey(`\n  ${stored}  \n`)).resolves.toBeDefined();
  });

  it('refuses non-base64url key text', async () => {
    await expect(importLicenseSigningKey('not/base64+url=')).rejects.toThrow('base64url');
  });

  it('derives the ring-entry public half from the private key alone', async () => {
    const { privateKey, publicKeyBase64Url } = await generateLicenseSigningKeys();
    expect(await publicKeyFromSigningKey(privateKey)).toBe(publicKeyBase64Url);
  });

  it('derives the same public half after an export/import round trip', async () => {
    const { privateKey, publicKeyBase64Url } = await generateLicenseSigningKeys();
    const restored = await importLicenseSigningKey(await exportLicenseSigningKey(privateKey));
    expect(await publicKeyFromSigningKey(restored)).toBe(publicKeyBase64Url);
  });
});

describe('subscriptionRef claim', () => {
  it('verifies and carries subscriptionRef through', async () => {
    const signer = await createDevSigner();
    const license = makeLicense({ subscriptionRef: 'f2a45b1c-0d3e-4c5f-8a6b-7c8d9e0f1a2b' });
    const result = await verifyLicense(await signer.sign(license), IN_TERM, signer.ring);
    expect(result.status).toBe('licensed');
    if (result.status !== 'licensed') return;
    expect(result.license.subscriptionRef).toBe('f2a45b1c-0d3e-4c5f-8a6b-7c8d9e0f1a2b');
  });

  it('rejects an empty subscriptionRef', async () => {
    const signer = await createDevSigner();
    const result = await verifyLicense(
      await signer.signRaw({ ...makeLicense(), subscriptionRef: '' }),
      IN_TERM,
      signer.ring,
    );
    expect(result).toEqual({ status: 'invalid', reason: 'schema-mismatch' });
  });
});
