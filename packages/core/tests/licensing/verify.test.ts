import { describe, expect, it } from 'vitest';
import { LICENSE_PREFIX, verifyLicense } from '../../src/licensing';
import { createDevSigner, DEV_KID, makeLicense } from './helpers/dev-license';

const DAY = 86_400_000;

const VALID_UNTIL = Date.UTC(2026, 6, 1);
const GRACE_END = VALID_UNTIL + 21 * DAY;
const IN_TERM = new Date(Date.UTC(2026, 3, 1));

describe('verifyLicense — happy path', () => {
  it('verifies a freshly signed license and carries the claims', async () => {
    const signer = await createDevSigner();
    const license = makeLicense();
    const result = await verifyLicense(await signer.sign(license), IN_TERM, signer.ring);
    expect(result).toEqual({ status: 'licensed', license, graceEndsAt: GRACE_END });
  });

  it('accepts whitespace-wrapped text (file with newlines, pasted with spaces)', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense());
    const wrapped = `  ${text.slice(0, 40)}\n${text.slice(40, 90)}\r\n\t${text.slice(90)} \n`;
    const result = await verifyLicense(wrapped, IN_TERM, signer.ring);
    expect(result.status).toBe('licensed');
  });

  it('carries offline + entitlements claims through', async () => {
    const signer = await createDevSigner();
    const license = makeLicense({ offline: true, entitlements: ['mock-server', 'workflows'] });
    const result = await verifyLicense(await signer.sign(license), IN_TERM, signer.ring);
    expect(result.status).toBe('licensed');
    if (result.status !== 'licensed') return;
    expect(result.license.offline).toBe(true);
    expect(result.license.entitlements).toEqual(['mock-server', 'workflows']);
  });

  it('tolerates unknown future claims (forward compatibility)', async () => {
    const signer = await createDevSigner();
    const result = await verifyLicense(
      await signer.signRaw({ ...makeLicense(), perpetualForVersionsBefore: '2027.1.0' }),
      IN_TERM,
      signer.ring,
    );
    expect(result.status).toBe('licensed');
  });
});

describe('verifyLicense — expiry ladder', () => {
  it('is licensed exactly at validUntil', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense());
    const result = await verifyLicense(text, new Date(VALID_UNTIL), signer.ring);
    expect(result.status).toBe('licensed');
  });

  it('enters grace one ms past validUntil', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense());
    const result = await verifyLicense(text, new Date(VALID_UNTIL + 1), signer.ring);
    expect(result.status).toBe('grace');
    if (result.status !== 'grace') return;
    expect(result.graceEndsAt).toBe(GRACE_END);
  });

  it('stays in grace exactly at graceEndsAt', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense());
    const result = await verifyLicense(text, new Date(GRACE_END), signer.ring);
    expect(result.status).toBe('grace');
  });

  it('is expired one ms past graceEndsAt', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense());
    const result = await verifyLicense(text, new Date(GRACE_END + 1), signer.ring);
    expect(result.status).toBe('expired');
  });

  it('skips grace entirely when graceDays is 0', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense({ graceDays: 0 }));
    const result = await verifyLicense(text, new Date(VALID_UNTIL + 1), signer.ring);
    expect(result.status).toBe('expired');
  });

  it('still reports claims on an expired license (UI shows what lapsed)', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense());
    const result = await verifyLicense(text, new Date(GRACE_END + 365 * DAY), signer.ring);
    expect(result.status).toBe('expired');
    if (result.status !== 'expired') return;
    expect(result.license.seats).toBe(25);
    expect(result.license.licensee.email).toBe('ada@openheaders.io');
  });
});

describe('verifyLicense — tampering', () => {
  it('rejects a payload edited after signing', async () => {
    const signer = await createDevSigner();
    const honest = await signer.sign(makeLicense({ seats: 11 }));
    const forged = await signer.signRaw(makeLicense({ seats: 10_000 }));
    const [prefix, , signature] = honest.split('.');
    const [, forgedPayload] = forged.split('.');
    const result = await verifyLicense(`${prefix}.${forgedPayload}.${signature}`, IN_TERM, signer.ring);
    expect(result).toEqual({ status: 'invalid', reason: 'bad-signature' });
  });

  it('rejects a signature from a different key under the same kid', async () => {
    const alice = await createDevSigner();
    const mallory = await createDevSigner();
    const result = await verifyLicense(await mallory.sign(makeLicense()), IN_TERM, alice.ring);
    expect(result).toEqual({ status: 'invalid', reason: 'bad-signature' });
  });
});

describe('verifyLicense — key ring', () => {
  it('rejects a kid absent from the ring', async () => {
    const signer = await createDevSigner('oh-lic-2031a');
    const text = await signer.sign(makeLicense({ kid: 'oh-lic-2031a' }));
    const other = await createDevSigner();
    const result = await verifyLicense(text, IN_TERM, other.ring);
    expect(result).toEqual({ status: 'invalid', reason: 'unknown-kid' });
  });

  it('defaults to the (empty) production ring', async () => {
    const signer = await createDevSigner();
    const result = await verifyLicense(await signer.sign(makeLicense()), IN_TERM);
    expect(result).toEqual({ status: 'invalid', reason: 'unknown-kid' });
  });

  it('rejects a ring entry that is not a 32-byte key', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense());
    const result = await verifyLicense(text, IN_TERM, { [DEV_KID]: 'dG9vLXNob3J0' });
    expect(result).toEqual({ status: 'invalid', reason: 'unknown-kid' });
  });
});

describe('verifyLicense — malformed input', () => {
  const CASES: Array<[string, () => Promise<string> | string]> = [
    ['empty string', () => ''],
    ['random prose', () => 'not a license at all'],
    ['wrong prefix', async () => (await signedText()).replace(LICENSE_PREFIX, 'oh-nonsense')],
    ['missing signature segment', async () => (await signedText()).split('.').slice(0, 2).join('.')],
    ['extra segment', async () => `${await signedText()}.AAAA`],
    ['non-base64url payload', async () => injectSegment(await signedText(), 1, 'not/base64+url=')],
    ['truncated signature', async () => (await signedText()).slice(0, -8)],
    ['payload decodes to non-JSON', async () => injectSegment(await signedText(), 1, 'bm90LWpzb24')],
  ];

  async function signedText(): Promise<string> {
    const signer = await createDevSigner();
    return signer.sign(makeLicense());
  }

  function injectSegment(text: string, index: number, replacement: string): string {
    const segments = text.split('.');
    segments[index] = replacement;
    return segments.join('.');
  }

  for (const [label, make] of CASES) {
    it(`rejects ${label}`, async () => {
      const signer = await createDevSigner();
      const result = await verifyLicense(await make(), IN_TERM, signer.ring);
      expect(result).toEqual({ status: 'invalid', reason: 'malformed' });
    });
  }
});

describe('verifyLicense — schema drift', () => {
  const CASES: Array<[string, Record<string, unknown>]> = [
    ['unsupported schemaVersion', { ...makeLicense(), schemaVersion: 2 }],
    ['missing seats', (({ seats: _seats, ...rest }) => rest)(makeLicense())],
    ['zero seats', { ...makeLicense(), seats: 0 }],
    ['fractional seats', { ...makeLicense(), seats: 12.5 }],
    ['negative graceDays', { ...makeLicense(), graceDays: -1 }],
    ['string validUntil', { ...makeLicense(), validUntil: '2026-07-01' }],
    ['empty licensee name', { ...makeLicense(), licensee: { name: '' } }],
    ['offline: false (marker is presence-only)', { ...makeLicense(), offline: false }],
    ['non-string entitlement', { ...makeLicense(), entitlements: [42] }],
  ];

  for (const [label, claims] of CASES) {
    it(`rejects ${label}`, async () => {
      const signer = await createDevSigner();
      const result = await verifyLicense(await signer.signRaw(claims), IN_TERM, signer.ring);
      expect(result).toEqual({ status: 'invalid', reason: 'schema-mismatch' });
    });
  }
});
