/**
 * Verification result contract. Hosts fold this into the entitlement
 * snapshot (`unlicensed` is a host-level state — "no file present" —
 * so it never appears here; the verifier only judges text it was given).
 */

import type { License, Licensee } from './schema';

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

/**
 * The entitlement snapshot hosts push to their surfaces (IPC broadcast,
 * admin RPC): the verifier vocabulary plus the host-level `unlicensed`
 * ("no license file present"). Claims are projected flat — surfaces
 * render state and never verify; the signing `kid` stays host-side.
 */
export interface LicensedSnapshot {
  status: 'licensed' | 'grace' | 'expired';
  licenseId: string;
  licensee: Licensee;
  seats: number;
  entitlements: string[];
  kind?: 'personal-seat';
  offline?: true;
  /** ms-since-epoch after which the license enters grace. */
  validUntil: number;
  /** ms-since-epoch when grace runs out. */
  graceEndsAt: number;
}

export type LicenseSnapshot =
  | { status: 'unlicensed' }
  | { status: 'invalid'; reason: LicenseInvalidReason }
  | LicensedSnapshot;
