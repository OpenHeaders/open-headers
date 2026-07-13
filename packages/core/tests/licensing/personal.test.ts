import { describe, expect, it } from 'vitest';
import { foldLicenseEmail, matchPersonalSeatIdentity, verifyLicense } from '../../src/licensing';
import { createDevSigner, makeLicense } from './helpers/dev-license';

const HOLDER = { name: 'Ada Example', email: 'ada@openheaders.io' };

describe('matchPersonalSeatIdentity', () => {
  it('admits the holder — folded email returned as canonical provenance', () => {
    const result = matchPersonalSeatIdentity({ kind: 'personal-seat', licensee: HOLDER }, 'ada@openheaders.io');
    expect(result).toEqual({ ok: true, email: 'ada@openheaders.io' });
  });

  it('folds case and whitespace on both sides — the SSO join fold', () => {
    const result = matchPersonalSeatIdentity(
      { kind: 'personal-seat', licensee: { name: 'Ada', email: '  Ada@OpenHeaders.IO ' } },
      ' ADA@openheaders.io\n',
    );
    expect(result).toEqual({ ok: true, email: 'ada@openheaders.io' });
  });

  it('refuses someone else — the anti-sharing mechanism', () => {
    const result = matchPersonalSeatIdentity({ kind: 'personal-seat', licensee: HOLDER }, 'grace@openheaders.io');
    expect(result).toEqual({ ok: false, reason: 'identity-mismatch' });
  });

  it('refuses an org license outright', () => {
    expect(matchPersonalSeatIdentity({ licensee: HOLDER }, 'ada@openheaders.io')).toEqual({
      ok: false,
      reason: 'not-personal-seat',
    });
  });

  it('refuses a personal seat issued without a licensee email', () => {
    expect(matchPersonalSeatIdentity({ kind: 'personal-seat', licensee: { name: 'Ada' } }, 'ada@openheaders.io')).toEqual(
      { ok: false, reason: 'licensee-email-missing' },
    );
  });

  it('refuses a presenter without a verified email — bare local users cannot redeem', () => {
    for (const presented of [undefined, null, '', '   ']) {
      expect(matchPersonalSeatIdentity({ kind: 'personal-seat', licensee: HOLDER }, presented)).toEqual({
        ok: false,
        reason: 'presented-email-missing',
      });
    }
  });
});

describe('foldLicenseEmail', () => {
  it('trims and lowercases', () => {
    expect(foldLicenseEmail(' Ada@OpenHeaders.IO ')).toBe('ada@openheaders.io');
  });
});

describe('kind claim on the wire', () => {
  it('a signed personal-seat artifact verifies and carries the kind', async () => {
    const signer = await createDevSigner();
    const text = await signer.sign(makeLicense({ kind: 'personal-seat', seats: 1 }));
    const result = await verifyLicense(text, new Date(Date.UTC(2026, 3, 1)), signer.ring);
    expect(result.status).toBe('licensed');
    if (result.status === 'invalid') return;
    expect(result.license.kind).toBe('personal-seat');
  });

  it('an artifact without the claim stays an org license', async () => {
    const signer = await createDevSigner();
    const result = await verifyLicense(await signer.sign(makeLicense()), new Date(Date.UTC(2026, 3, 1)), signer.ring);
    expect(result.status).toBe('licensed');
    if (result.status === 'invalid') return;
    expect(result.license.kind).toBeUndefined();
  });

  it('a kind outside the vocabulary is a schema mismatch', async () => {
    const signer = await createDevSigner();
    const result = await verifyLicense(
      await signer.signRaw({ ...makeLicense(), kind: 'site-wide' }),
      new Date(Date.UTC(2026, 3, 1)),
      signer.ring,
    );
    expect(result).toEqual({ status: 'invalid', reason: 'schema-mismatch' });
  });
});
