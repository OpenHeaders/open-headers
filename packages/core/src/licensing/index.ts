/**
 * `@openheaders/core/licensing` — license artifact model + pure offline
 * Ed25519 verification (`LICENSING_PLAN.md` §3). Zero platform deps;
 * host slots, the seat gate, and the refresh agent all consume this
 * module unchanged.
 */

export { decodeBase64Url, encodeBase64Url } from './encoding';
export { FREE_SEAT_LIMIT, RESERVED_ENTITLEMENTS, type ReservedEntitlement } from './entitlements';
export { LICENSE_PUBLIC_KEYS, type LicenseKeyRing } from './keys';
export {
  foldLicenseEmail,
  matchPersonalSeatIdentity,
  type PersonalSeatIdentityMismatchReason,
  type PersonalSeatIdentityResult,
} from './personal';
export { type License, type Licensee, LicenseeSchema, LicenseSchema } from './schema';
export { getLicenseSeatLimit, getLicenseSnapshot, setLicenseSnapshotProvider } from './seats';
export {
  exportLicenseSigningKey,
  generateLicenseSigningKeys,
  importLicenseSigningKey,
  publicKeyFromSigningKey,
  signLicense,
} from './sign';
export { snapshotFromVerifyResult } from './snapshot';
export type {
  InvalidLicense,
  LicensedSnapshot,
  LicenseInvalidReason,
  LicenseSnapshot,
  LicenseStatus,
  VerifiedLicense,
  VerifyResult,
} from './types';
export { LICENSE_PREFIX, verifyLicense } from './verify';
