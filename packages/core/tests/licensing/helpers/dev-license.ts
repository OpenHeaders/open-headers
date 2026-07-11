/**
 * Dev/test license signing — test-side only, never shipped. Mints a
 * throwaway Ed25519 pair per signer so slices 2–4 (and these tests) can
 * produce locally signed licenses; real private keys never enter this
 * repo. `signRaw` signs arbitrary claims (schema-drift cases);
 * `sign` narrows to a well-formed `License`.
 */

import type { License, LicenseKeyRing } from '../../../src/licensing';
import { encodeBase64Url, LICENSE_PREFIX } from '../../../src/licensing';

export const DEV_KID = 'oh-lic-2026dev';

export interface DevSigner {
  kid: string;
  /** Ring containing exactly this signer's public key — inject into `verifyLicense`. */
  ring: LicenseKeyRing;
  sign(license: License): Promise<string>;
  signRaw(claims: unknown): Promise<string>;
}

export async function createDevSigner(kid: string = DEV_KID): Promise<DevSigner> {
  const generated = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  if (!('privateKey' in generated)) throw new Error('Ed25519 generateKey did not return a key pair');
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', generated.publicKey));

  const signRaw = async (claims: unknown): Promise<string> => {
    const payloadSegment = encodeBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
    const signature = await crypto.subtle.sign(
      'Ed25519',
      generated.privateKey,
      new TextEncoder().encode(payloadSegment),
    );
    return `${LICENSE_PREFIX}.${payloadSegment}.${encodeBase64Url(new Uint8Array(signature))}`;
  };

  return {
    kid,
    ring: Object.freeze({ [kid]: encodeBase64Url(publicKeyBytes) }),
    sign: signRaw,
    signRaw,
  };
}

export function makeLicense(overrides: Partial<License> = {}): License {
  return {
    schemaVersion: 1,
    licenseId: 'lic-0001',
    licensee: { name: 'Ada Example', org: 'OpenHeaders', email: 'ada@openheaders.io' },
    seats: 25,
    entitlements: [],
    issuedAt: Date.UTC(2026, 0, 1),
    validUntil: Date.UTC(2026, 6, 1),
    graceDays: 21,
    kid: DEV_KID,
    ...overrides,
  };
}
