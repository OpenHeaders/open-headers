/**
 * The trusted-roots host law: additive behind the runtime bundle, the
 * system store between the bundle and the dial's own anchors when the
 * device opted in, and nothing to add leaves the `ca` option unset.
 */

import { rootCertificates } from 'node:tls';
import { setHostStorage } from '@openheaders/core/storage';
import {
  __resetDeviceTrustForTests,
  loadDeviceTrust,
  setSystemTrustEnabled,
} from '@openheaders/oracle/entity/device-trust-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { caOptionFor } from '../../src/live/trusted-roots-ca';
import { createHostStorageFake } from './_host-storage-fake';

const { systemCerts } = vi.hoisted(() => ({ systemCerts: [] as string[] }));
vi.mock('../../src/live/system-trust', () => ({
  isSystemTrustSupported: () => true,
  getSystemCaCertificates: () => systemCerts,
  refreshSystemCaCertificates: () => {},
}));

const ROOT_A = '-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----\n';
const ROOT_B = '-----BEGIN CERTIFICATE-----\nBBB\n-----END CERTIFICATE-----\n';
const SYSTEM = '-----BEGIN CERTIFICATE-----\nSYS\n-----END CERTIFICATE-----\n';

beforeEach(async () => {
  setHostStorage(createHostStorageFake());
  __resetDeviceTrustForTests();
  await loadDeviceTrust();
  systemCerts.splice(0, systemCerts.length, SYSTEM);
});

afterEach(() => {
  __resetDeviceTrustForTests();
});

describe('caOptionFor', () => {
  it('an absent or empty list leaves the option unset — the runtime default path untouched', () => {
    expect(caOptionFor(undefined)).toBeUndefined();
    expect(caOptionFor([])).toBeUndefined();
  });

  it('appends the workspace roots BEHIND the full runtime bundle, in order', () => {
    const ca = caOptionFor([ROOT_A, ROOT_B]);
    expect(ca).toBeDefined();
    expect(ca?.length).toBe(rootCertificates.length + 2);
    expect(ca?.slice(0, rootCertificates.length)).toEqual([...rootCertificates]);
    expect(ca?.slice(-2)).toEqual([ROOT_A, ROOT_B]);
  });

  it('never hands back the caller’s array', () => {
    const roots = [ROOT_A];
    const ca = caOptionFor(roots);
    expect(ca).not.toBe(roots);
  });

  it('with the system store on, seats its certificates between the bundle and the dial’s anchors', async () => {
    await setSystemTrustEnabled(true);
    const ca = caOptionFor([ROOT_A]);
    expect(ca?.slice(rootCertificates.length)).toEqual([SYSTEM, ROOT_A]);
    // Opted in with nothing else to add still applies the store.
    expect(caOptionFor(undefined)?.slice(rootCertificates.length)).toEqual([SYSTEM]);
  });

  it('with the system store on but empty, an anchorless dial keeps the default path', async () => {
    await setSystemTrustEnabled(true);
    systemCerts.splice(0);
    expect(caOptionFor(undefined)).toBeUndefined();
    expect(caOptionFor([ROOT_A])?.slice(rootCertificates.length)).toEqual([ROOT_A]);
  });
});
