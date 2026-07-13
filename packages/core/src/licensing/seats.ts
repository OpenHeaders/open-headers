/**
 * Seat-limit seam — how the license slot's snapshot reaches the seat
 * gate in `identity/daemon-users.ts` without core depending on any
 * host module. Same pattern as `setAuditSink`: the host installs a
 * provider at boot (the daemon spine wires the license slot; the
 * offline CLI wires a one-shot read); unset, the free tier holds.
 *
 * The limit is derived at consume time, never cached: `licensed` and
 * `grace` admit the licensed seats (grace is a renewal courtesy, not a
 * degradation), everything else — `unlicensed`, `invalid`, `expired`
 * past grace — reverts NEW growth to `FREE_SEAT_LIMIT`. Existing users
 * are never touched by this number; only create/re-admit consults it.
 */

import { FREE_SEAT_LIMIT } from './entitlements';
import type { LicenseSnapshot } from './types';

let provider: (() => LicenseSnapshot) | null = null;

export function setLicenseSnapshotProvider(next: (() => LicenseSnapshot) | null): void {
  provider = next;
}

/** The host's current entitlement snapshot; `unlicensed` when no provider is installed. */
export function getLicenseSnapshot(): LicenseSnapshot {
  return provider?.() ?? { status: 'unlicensed' };
}

/**
 * Active directory users the seat gate admits right now. A
 * `personal-seat` artifact never feeds the pool — it is an admission
 * ticket held by one user, so were it installed into the daemon's own
 * slot, its `seats` claim must not shrink (or grow) the pool limit.
 */
export function getLicenseSeatLimit(): number {
  const snapshot = getLicenseSnapshot();
  if ((snapshot.status === 'licensed' || snapshot.status === 'grace') && snapshot.kind !== 'personal-seat') {
    return snapshot.seats;
  }
  return FREE_SEAT_LIMIT;
}
