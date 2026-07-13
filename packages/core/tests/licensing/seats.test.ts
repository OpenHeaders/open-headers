import { afterEach, describe, expect, it } from 'vitest';
import {
  FREE_SEAT_LIMIT,
  getLicenseSeatLimit,
  getLicenseSnapshot,
  type LicensedSnapshot,
  type LicenseSnapshot,
  setLicenseSnapshotProvider,
} from '../../src/licensing';

const LICENSED_BASE: Omit<LicensedSnapshot, 'status'> = {
  licenseId: 'lic-0001',
  licensee: { name: 'Ada Example', org: 'OpenHeaders', email: 'ada@openheaders.io' },
  seats: 40,
  entitlements: [],
  validUntil: Date.UTC(2026, 6, 1),
  graceEndsAt: Date.UTC(2026, 6, 22),
};

afterEach(() => {
  setLicenseSnapshotProvider(null);
});

describe('license seat seam', () => {
  it('defaults to unlicensed / the free limit with no provider installed', () => {
    expect(getLicenseSnapshot()).toEqual({ status: 'unlicensed' });
    expect(getLicenseSeatLimit()).toBe(FREE_SEAT_LIMIT);
  });

  it('admits the licensed seats while licensed and in grace', () => {
    for (const status of ['licensed', 'grace'] as const) {
      setLicenseSnapshotProvider(() => ({ status, ...LICENSED_BASE }));
      expect(getLicenseSeatLimit()).toBe(40);
    }
  });

  it('reverts to the free limit on expired, invalid, and unlicensed', () => {
    const cases: LicenseSnapshot[] = [
      { status: 'expired', ...LICENSED_BASE },
      { status: 'invalid', reason: 'unknown-kid' },
      { status: 'unlicensed' },
    ];
    for (const snapshot of cases) {
      setLicenseSnapshotProvider(() => snapshot);
      expect(getLicenseSeatLimit()).toBe(FREE_SEAT_LIMIT);
    }
  });

  it('never lets a personal-seat artifact feed the pool limit', () => {
    for (const status of ['licensed', 'grace'] as const) {
      setLicenseSnapshotProvider(() => ({ status, ...LICENSED_BASE, kind: 'personal-seat', seats: 1 }));
      expect(getLicenseSeatLimit()).toBe(FREE_SEAT_LIMIT);
    }
  });

  it('derives at consume time — a provider swap changes the next read', () => {
    let snapshot: LicenseSnapshot = { status: 'licensed', ...LICENSED_BASE };
    setLicenseSnapshotProvider(() => snapshot);
    expect(getLicenseSeatLimit()).toBe(40);
    snapshot = { status: 'expired', ...LICENSED_BASE };
    expect(getLicenseSeatLimit()).toBe(FREE_SEAT_LIMIT);
  });
});
