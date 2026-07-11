/**
 * `@openheaders/core/licensing` — license artifact model + pure offline
 * Ed25519 verification (`LICENSING_PLAN.md` §3). Zero platform deps;
 * host slots, the seat gate, and the refresh agent all consume this
 * module unchanged.
 */

export { decodeBase64Url, encodeBase64Url } from './encoding';
export { FREE_SEAT_LIMIT, RESERVED_ENTITLEMENTS, type ReservedEntitlement } from './entitlements';
export { LICENSE_PUBLIC_KEYS, type LicenseKeyRing } from './keys';
export { type License, type Licensee, LicenseeSchema, LicenseSchema } from './schema';
export type { InvalidLicense, LicenseInvalidReason, LicenseStatus, VerifiedLicense, VerifyResult } from './types';
export { LICENSE_PREFIX, verifyLicense } from './verify';
