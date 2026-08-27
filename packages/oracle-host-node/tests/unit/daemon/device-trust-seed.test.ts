/**
 * The daemon's boot seed for the system-trust-store opt-in: writes the
 * configured answer into the host-local device-trust record, keeps the
 * pins already there, treats a malformed record as empty, and leaves
 * an already-matching record untouched.
 */

import { OH } from '@openheaders/core/storage';
import { describe, expect, it } from 'vitest';
import { seedDeviceTrustPosture } from '../../../src/daemon/device-trust-seed';
import { createHostStorageFake } from '../_host-storage-fake';

const PIN = {
  uid: 'pin00001',
  name: 'localhost',
  certPem: '-----BEGIN CERTIFICATE-----\nP\n-----END CERTIFICATE-----',
  addedAt: '2026-08-27T00:00:00.000Z',
};

describe('seedDeviceTrustPosture', () => {
  it('writes the opt-in beside the existing pins', async () => {
    const hostStorage = createHostStorageFake();
    await hostStorage.set(OH.deviceTrust, { certificates: [PIN], useSystemCa: false });
    await seedDeviceTrustPosture({ hostStorage, useSystemCa: true });
    expect(await hostStorage.get(OH.deviceTrust)).toEqual({ certificates: [PIN], useSystemCa: true });
  });

  it('an absent or malformed record seeds an empty one', async () => {
    const hostStorage = createHostStorageFake();
    await seedDeviceTrustPosture({ hostStorage, useSystemCa: true });
    expect(await hostStorage.get(OH.deviceTrust)).toEqual({ certificates: [], useSystemCa: true });
    await hostStorage.set(OH.deviceTrust, { certificates: 'nope', useSystemCa: false } as never);
    await seedDeviceTrustPosture({ hostStorage, useSystemCa: true });
    expect(await hostStorage.get(OH.deviceTrust)).toEqual({ certificates: [], useSystemCa: true });
  });

  it('a matching record is not rewritten', async () => {
    const hostStorage = createHostStorageFake();
    let writes = 0;
    const original = hostStorage.set.bind(hostStorage);
    hostStorage.set = async (spec, value) => {
      writes += 1;
      await original(spec, value);
    };
    await hostStorage.set(OH.deviceTrust, { certificates: [], useSystemCa: true });
    await seedDeviceTrustPosture({ hostStorage, useSystemCa: true });
    expect(writes).toBe(1);
  });
});
