/**
 * The secret-manager connections store — this device's connections
 * under the host-local key: load, list / get, add / update / remove
 * with persist-first commits, a label trimmed, and the uid kept across
 * an update so references keep resolving.
 */

import { type HostStorage, OH, type StorageKey, setHostStorage } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetSecretManagerConnectionsForTests,
  addSecretManagerConnection,
  getSecretManagerConnection,
  isSecretManagerConnectionsLoaded,
  listSecretManagerConnections,
  loadSecretManagerConnections,
  removeSecretManagerConnection,
  updateSecretManagerConnection,
} from '../../src/entity/secret-manager-connections-store';

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
  } as unknown as HostStorage & { store: Map<string, unknown> };
}

let storage: ReturnType<typeof createHostStorageFake>;

beforeEach(async () => {
  storage = createHostStorageFake();
  setHostStorage(storage);
  __resetSecretManagerConnectionsForTests();
  await loadSecretManagerConnections();
});

afterEach(() => {
  __resetSecretManagerConnectionsForTests();
});

describe('secret-manager connections store', () => {
  it('loads empty and reports loaded', () => {
    expect(isSecretManagerConnectionsLoaded()).toBe(true);
    expect(listSecretManagerConnections()).toEqual([]);
  });

  it('add persists first and the snapshot follows; the label is trimmed', async () => {
    const added = await addSecretManagerConnection({
      label: '  Work  ',
      config: { provider: 'onepassword', account: 'work', auth: 'app' },
    });
    expect(added.label).toBe('Work');
    expect(added.uid).toMatch(/^[a-z0-9]{8}$/);
    expect(getSecretManagerConnection(added.uid)).toEqual(added);
    expect(storage.store.get(OH.secretManagerConnections.key)).toEqual({ connections: [added] });
  });

  it('a fresh load reads what was persisted', async () => {
    const added = await addSecretManagerConnection({
      label: 'Prod',
      config: { provider: 'hashivault', serverUrl: 'https://vault.openheaders.io', authMethod: 'token' },
    });
    __resetSecretManagerConnectionsForTests();
    await loadSecretManagerConnections();
    expect(listSecretManagerConnections()).toEqual([added]);
  });

  it('update keeps the uid and replaces label + config; an unknown uid answers undefined', async () => {
    const added = await addSecretManagerConnection({ label: 'Work', config: { provider: 'oskeychain' } });
    const updated = await updateSecretManagerConnection(added.uid, {
      label: 'Personal',
      config: { provider: 'onepassword', account: 'me', auth: 'service-account' },
    });
    expect(updated?.uid).toBe(added.uid);
    expect(listSecretManagerConnections()).toEqual([updated]);
    expect(await updateSecretManagerConnection('nope0000', { label: 'x', config: { provider: 'oskeychain' } })).toBe(
      undefined,
    );
  });

  it('remove answers whether anything was dropped', async () => {
    const added = await addSecretManagerConnection({ label: 'Work', config: { provider: 'oskeychain' } });
    expect(await removeSecretManagerConnection('nope0000')).toBe(false);
    expect(await removeSecretManagerConnection(added.uid)).toBe(true);
    expect(listSecretManagerConnections()).toEqual([]);
  });

  it('a malformed persisted record loads as empty rather than throwing', async () => {
    storage.store.set(OH.secretManagerConnections.key, { connections: [{ bogus: 1 }] });
    __resetSecretManagerConnectionsForTests();
    await loadSecretManagerConnections();
    expect(listSecretManagerConnections()).toEqual([]);
  });
});
