/**
 * Verification result contract. Hosts fold this into the entitlement
 * snapshot (`unlicensed` is a host-level state — "no file present" —
 * so it never appears here; the verifier only judges text it was given).
 */

import type { License } from './schema';

export type LicenseStatus = 'licensed' | 'grace' | 'expired' | 'invalid';

export type LicenseInvalidReason =
  /** Not the wire format at all: wrong prefix, wrong segment count, undecodable base64url, non-JSON payload. */
  | 'malformed'
  /** Decoded JSON does not satisfy `LicenseSchema`. */
  | 'schema-mismatch'
  /** `kid` has no usable entry in the key ring. */
  | 'unknown-kid'
  /** Well-formed but the Ed25519 signature does not verify — tampered or foreign. */
  | 'bad-signature';

export interface VerifiedLicense {
  status: 'licensed' | 'grace' | 'expired';
  license: License;
  /** ms-since-epoch when grace runs out (`validUntil` + `graceDays`). */
  graceEndsAt: number;
}

export interface InvalidLicense {
  status: 'invalid';
  reason: LicenseInvalidReason;
}

export type VerifyResult = VerifiedLicense | InvalidLicense;
