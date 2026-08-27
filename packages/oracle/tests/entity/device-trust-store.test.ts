/**
 * Device-trust store — this machine's pinned certificates: loaded once
 * from the host-local key, read synchronously by the executors, mutated
 * persist-first. Refuses non-certificate material and byte-identical
 * duplicates; a self-signed leaf is welcome.
 */

import { type HostStorage, OH, type StorageKey, setHostStorage } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetDeviceTrustForTests,
  addDeviceTrustedCertificate,
  getDeviceTrustPems,
  isDeviceTrustLoaded,
  isSystemTrustEnabled,
  listDeviceTrustedCertificates,
  loadDeviceTrust,
  removeDeviceTrustedCertificate,
  setSystemTrustEnabled,
} from '../../src/entity/device-trust-store';

const PIN = '-----BEGIN CERTIFICATE-----\nPIN\n-----END CERTIFICATE-----';

function createHostStorageFake(): HostStorage & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
      return store.get(spec.key) as T | undefined;
    },
    async getMany() {
      throw new Error('unused');
    },
    async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
      store.set(spec.key, value);
    },
    async remove<T>(spec: StorageKey<T>): Promise<void> {
      store.delete(spec.key);
    },
    subscribe() {
      return () => {};
    },
    async getValidated() {
      throw new Error('unused');
    },
    async getManyValidated() {
      throw new Error('unused');
    },
  } as unknown as HostStorage & { store: Map<string, unknown> };
}

let storage: ReturnType<typeof createHostStorageFake>;

beforeEach(() => {
  storage = createHostStorageFake();
  setHostStorage(storage);
});

afterEach(() => {
  __resetDeviceTrustForTests();
});

describe('device-trust-store', () => {
  it('loads the persisted list once and reads it synchronously; a malformed record reads as empty', async () => {
    storage.store.set(OH.deviceTrust.key, {
      certificates: [{ uid: 'pin00001', name: 'localhost', certPem: PIN, addedAt: '2026-08-27T00:00:00.000Z' }],
    });
    expect(isDeviceTrustLoaded()).toBe(false);
    await loadDeviceTrust();
    expect(isDeviceTrustLoaded()).toBe(true);
    expect(getDeviceTrustPems()).toEqual([PIN]);

    __resetDeviceTrustForTests();
    storage.store.set(OH.deviceTrust.key, { certificates: 'nope' });
    await loadDeviceTrust();
    expect(getDeviceTrustPems()).toEqual([]);
  });

  it('pins persist-first with a minted uid and the origin, then read back', async () => {
    await loadDeviceTrust();
    const added = await addDeviceTrustedCertificate({
      certPem: `${PIN}\n`,
      name: ' localhost ',
      origin: '127.0.0.1:3443',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.certificate.name).toBe('localhost');
    expect(added.certificate.origin).toBe('127.0.0.1:3443');
    expect(added.certificate.certPem).toBe(PIN);
    const persisted = storage.store.get(OH.deviceTrust.key) as { certificates: unknown[] };
    expect(persisted.certificates).toHaveLength(1);
    expect(listDeviceTrustedCertificates()).toEqual([added.certificate]);
  });

  it('refuses material without a certificate block and a byte-identical duplicate', async () => {
    await loadDeviceTrust();
    expect(await addDeviceTrustedCertificate({ certPem: 'not a cert', name: 'x' })).toEqual({
      ok: false,
      error: 'no-certificate',
    });
    await addDeviceTrustedCertificate({ certPem: PIN, name: 'a' });
    expect(await addDeviceTrustedCertificate({ certPem: `  ${PIN}  `, name: 'b' })).toEqual({
      ok: false,
      error: 'duplicate',
    });
  });

  it('removes by uid and reports an unknown uid honestly', async () => {
    await loadDeviceTrust();
    const added = await addDeviceTrustedCertificate({ certPem: PIN, name: 'a' });
    if (!added.ok) throw new Error('add failed');
    expect(await removeDeviceTrustedCertificate('nope')).toBe(false);
    expect(await removeDeviceTrustedCertificate(added.certificate.uid)).toBe(true);
    expect(getDeviceTrustPems()).toEqual([]);
    expect((storage.store.get(OH.deviceTrust.key) as { certificates: unknown[] }).certificates).toEqual([]);
  });

  it('the system-store opt-in defaults off, persists with the pins, and survives a pin mutation', async () => {
    storage.store.set(OH.deviceTrust.key, { certificates: [] });
    await loadDeviceTrust();
    expect(isSystemTrustEnabled()).toBe(false);
    await setSystemTrustEnabled(true);
    expect(isSystemTrustEnabled()).toBe(true);
    expect((storage.store.get(OH.deviceTrust.key) as { useSystemCa: boolean }).useSystemCa).toBe(true);
    const added = await addDeviceTrustedCertificate({ certPem: PIN, name: 'a' });
    if (!added.ok) throw new Error('add failed');
    expect(isSystemTrustEnabled()).toBe(true);
    await removeDeviceTrustedCertificate(added.certificate.uid);
    const persisted = storage.store.get(OH.deviceTrust.key) as { certificates: unknown[]; useSystemCa: boolean };
    expect(persisted).toEqual({ certificates: [], useSystemCa: true });
    await setSystemTrustEnabled(false);
    expect(isSystemTrustEnabled()).toBe(false);
  });
});
