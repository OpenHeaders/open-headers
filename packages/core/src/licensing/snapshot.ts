/**
 * Verifier result → entitlement snapshot projection — the one mapping
 * every host slot uses, so the flat shape surfaces render can never
 * drift between hosts. `unlicensed` (no file) is the host's own case;
 * it never passes through here.
 */

import type { LicenseSnapshot, VerifyResult } from './types';

export function snapshotFromVerifyResult(result: VerifyResult): LicenseSnapshot {
  if (result.status === 'invalid') return { status: 'invalid', reason: result.reason };
  const { license } = result;
  return {
    status: result.status,
    licenseId: license.licenseId,
    licensee: license.licensee,
    seats: license.seats,
    entitlements: license.entitlements,
    ...(license.kind === 'personal-seat' ? { kind: 'personal-seat' as const } : {}),
    ...(license.offline === true ? { offline: true } : {}),
    validUntil: license.validUntil,
    graceEndsAt: result.graceEndsAt,
  };
}
