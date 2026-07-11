/**
 * Dev/test license signing — mints a throwaway Ed25519 pair per signer
 * (via the shipped `generateLicenseSigningKeys`/`signLicense` composer)
 * so tests and dev hosts can produce locally signed licenses; real
 * private keys never enter this repo. `signRaw` signs arbitrary claims
 * (schema-drift cases); `sign` narrows to a well-formed `License`.
 */

import type { License, LicenseKeyRing } from '../../../src/licensing';
import { generateLicenseSigningKeys, signLicense } from '../../../src/licensing';

export const DEV_KID = 'oh-lic-2026dev';

export interface DevSigner {
  kid: string;
  /** Ring containing exactly this signer's public key — inject into `verifyLicense`. */
  ring: LicenseKeyRing;
  sign(license: License): Promise<string>;
  signRaw(claims: unknown): Promise<string>;
}

export async function createDevSigner(kid: string = DEV_KID): Promise<DevSigner> {
  const { privateKey, publicKeyBase64Url } = await generateLicenseSigningKeys();
  const signRaw = (claims: unknown): Promise<string> => signLicense(claims, privateKey);
  return {
    kid,
    ring: Object.freeze({ [kid]: publicKeyBase64Url }),
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
