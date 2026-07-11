import { describe, expect, it } from 'vitest';
import { snapshotFromVerifyResult, verifyLicense } from '../../src/licensing';
import { createDevSigner, makeLicense } from './helpers/dev-license';

const IN_TERM = new Date(Date.UTC(2026, 3, 1));

describe('snapshotFromVerifyResult', () => {
  it('projects a licensed result flat, without the signing kid', async () => {
    const signer = await createDevSigner();
    const result = await verifyLicense(await signer.sign(makeLicense()), IN_TERM, signer.ring);
    const snapshot = snapshotFromVerifyResult(result);
    expect(snapshot).toEqual({
      status: 'licensed',
      licenseId: 'lic-0001',
      licensee: { name: 'Ada Example', org: 'OpenHeaders', email: 'ada@openheaders.io' },
      seats: 25,
      entitlements: [],
      validUntil: Date.UTC(2026, 6, 1),
      graceEndsAt: Date.UTC(2026, 6, 1) + 21 * 86_400_000,
    });
  });

  it('carries the offline marker only when present', async () => {
    const signer = await createDevSigner();
    const result = await verifyLicense(await signer.sign(makeLicense({ offline: true })), IN_TERM, signer.ring);
    const snapshot = snapshotFromVerifyResult(result);
    expect(snapshot.status).toBe('licensed');
    if (snapshot.status !== 'licensed') return;
    expect(snapshot.offline).toBe(true);
  });

  it('projects invalid results as reason-only', () => {
    expect(snapshotFromVerifyResult({ status: 'invalid', reason: 'unknown-kid' })).toEqual({
      status: 'invalid',
      reason: 'unknown-kid',
    });
  });
});
