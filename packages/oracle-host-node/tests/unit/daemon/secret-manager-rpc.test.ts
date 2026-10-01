/**
 * The `oh.secretManager.*` routes: list / add / update / remove over the
 * oracle store with the change broadcast, the config gate on add and
 * update, the side-effect-free probe through the installed provider
 * (and the honest answers when no provider or connection exists), and
 * the authorization gesture.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { SECRET_MANAGER_SAME_DEVICE_MESSAGE } from '@openheaders/core/protocol';
import {
  registerSecretProvider,
  SECRET_PROVIDER_IDS,
  type SecretProvider,
  unregisterSecretProvider,
} from '@openheaders/core/secret-providers';
import { setHostStorage } from '@openheaders/core/storage';
import {
  __resetSecretManagerConnectionsForTests,
  loadSecretManagerConnections,
} from '@openheaders/oracle/entity/secret-manager-connections-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSecretManagerPeerRpc,
  handleSecretManagerRpc,
  isSecretManagerRpc,
} from '../../../src/daemon/secret-manager-rpc';
import { createHostStorageFake } from '../_host-storage-fake';

const broadcast = vi.fn();
const bridge: HostBridge = {
  call: () => Promise.reject(new Error('unused')),
  broadcast: (...args: unknown[]) => broadcast(...args),
  subscribe: () => () => {},
  presence: () => () => {},
};

const ONEPASSWORD = { provider: 'onepassword', account: 'work', auth: 'app' };

function fakeProvider(overrides: Partial<SecretProvider> = {}): SecretProvider {
  return {
    id: 'onepassword',
    yields: 'concealed-string',
    probe: async () => ({ available: true }),
    resolve: async () => ({ ok: true, value: 'v' }),
    ...overrides,
  };
}

async function addWork(): Promise<string> {
  const added = (await handleSecretManagerRpc('oh.secretManager.add', { label: 'Work', config: ONEPASSWORD })) as {
    ok: boolean;
    connection?: { uid: string };
  };
  expect(added.ok).toBe(true);
  return added.connection?.uid ?? '';
}

beforeEach(async () => {
  setHostStorage(createHostStorageFake());
  setHostBridge(bridge);
  broadcast.mockReset();
  __resetSecretManagerConnectionsForTests();
  await loadSecretManagerConnections();
});

afterEach(() => {
  for (const id of SECRET_PROVIDER_IDS) unregisterSecretProvider(id);
});

describe('secret-manager rpc', () => {
  it('routes only its own family', () => {
    expect(isSecretManagerRpc('oh.secretManager.list')).toBe(true);
    expect(isSecretManagerRpc('oh.secretManager.authorize')).toBe(true);
    expect(isSecretManagerRpc('oh.deviceTrust.list')).toBe(false);
    expect(isSecretManagerRpc(42)).toBe(false);
  });

  it('adds, lists, updates and removes a connection — broadcasting each change; a blank label takes the description', async () => {
    const added = (await handleSecretManagerRpc('oh.secretManager.add', { label: '', config: ONEPASSWORD })) as {
      ok: boolean;
      connection?: { uid: string; label: string };
    };
    expect(added.ok).toBe(true);
    expect(added.connection?.label).toBe('work');
    expect(broadcast).toHaveBeenCalledWith('secretManagerConnectionsChanged', { count: 1 });

    const listed = (await handleSecretManagerRpc('oh.secretManager.list', {})) as { connections: unknown[] };
    expect(listed.connections).toHaveLength(1);

    const updated = (await handleSecretManagerRpc('oh.secretManager.update', {
      uid: added.connection?.uid,
      label: 'Personal',
      config: { provider: 'onepassword', account: 'me', auth: 'service-account' },
    })) as { ok: boolean; connection?: { uid: string; label: string; config: { account: string } } };
    expect(updated.ok).toBe(true);
    expect(updated.connection?.uid).toBe(added.connection?.uid);
    expect(updated.connection?.config.account).toBe('me');
    expect(broadcast).toHaveBeenCalledTimes(2);

    expect(await handleSecretManagerRpc('oh.secretManager.remove', { uid: added.connection?.uid })).toEqual({
      ok: true,
    });
    expect(broadcast).toHaveBeenLastCalledWith('secretManagerConnectionsChanged', { count: 0 });
    expect(await handleSecretManagerRpc('oh.secretManager.remove', { uid: 'nope' })).toMatchObject({ ok: false });
  });

  it('refuses a config the schema rejects, on add and on update', async () => {
    expect(
      await handleSecretManagerRpc('oh.secretManager.add', { label: 'x', config: { provider: 'bogus' } }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('Not a valid') });
    const uid = await addWork();
    expect(
      await handleSecretManagerRpc('oh.secretManager.update', { uid, label: 'x', config: { provider: 'azurekv' } }),
    ).toMatchObject({ ok: false });
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it("probe answers not-installed without a provider or a connection, and the provider's own verdict with one", async () => {
    expect(await handleSecretManagerRpc('oh.secretManager.probe', { uid: 'nope' })).toMatchObject({
      available: false,
      reason: 'not-installed',
    });
    const uid = await addWork();
    expect(await handleSecretManagerRpc('oh.secretManager.probe', { uid })).toEqual({
      available: false,
      reason: 'not-installed',
    });
    let seen: unknown = null;
    registerSecretProvider(
      fakeProvider({
        probe: async (connection) => {
          seen = connection;
          return { available: false, reason: 'integration-disabled', detail: 'off' };
        },
      }),
    );
    expect(await handleSecretManagerRpc('oh.secretManager.probe', { uid })).toEqual({
      available: false,
      reason: 'integration-disabled',
      detail: 'off',
    });
    expect(seen).toMatchObject({ uid, label: 'Work' });
  });

  it('authorize rides the provider gesture, or the probe for an ambient provider', async () => {
    const uid = await addWork();
    expect(await handleSecretManagerRpc('oh.secretManager.authorize', { uid })).toMatchObject({ ok: false });
    registerSecretProvider(fakeProvider({ authorize: async () => ({ ok: false, detail: 'denied' }) }));
    expect(await handleSecretManagerRpc('oh.secretManager.authorize', { uid })).toEqual({
      ok: false,
      detail: 'denied',
    });
    registerSecretProvider(fakeProvider());
    expect(await handleSecretManagerRpc('oh.secretManager.authorize', { uid })).toEqual({ ok: true });
    // An ambient provider's refusal carries the probe's reason, so the
    // Test toast can name the fix beside the detail.
    registerSecretProvider(
      fakeProvider({ probe: async () => ({ available: false, reason: 'no-credentials', detail: 'no profile' }) }),
    );
    expect(await handleSecretManagerRpc('oh.secretManager.authorize', { uid })).toEqual({
      ok: false,
      reason: 'no-credentials',
      detail: 'no profile',
    });
  });

  it('list names its broker as this host', async () => {
    await addWork();
    expect(await handleSecretManagerRpc('oh.secretManager.list', {})).toMatchObject({ broker: 'local' });
  });

  it("resolveBatch answers every referenced entry typed through this host's broker; a malformed entry is dropped", async () => {
    const uid = await addWork();
    registerSecretProvider(
      fakeProvider({
        resolve: async (_connection, locator) =>
          locator.provider === 'onepassword' && locator.item === 'missing.openheaders.io'
            ? { ok: false, reason: 'not-found' }
            : { ok: true, value: 'resolved' },
      }),
    );
    const locator = (item: string) => ({
      provider: 'onepassword',
      connectionId: uid,
      vault: 'Demo',
      item,
      field: 'token',
    });
    const out = (await handleSecretManagerRpc('oh.secretManager.resolveBatch', {
      entries: [
        { name: 'ApiToken', locator: locator('api.openheaders.io') },
        { name: 'Gone', locator: locator('missing.openheaders.io') },
        { name: 'Broken', locator: { provider: 'nope' } },
        { name: 'Orphan', locator: { ...locator('x'), connectionId: 'conn9999' } },
      ],
    })) as { results: Record<string, { ok: boolean; reason?: string; value?: string }> };
    expect(out.results.ApiToken).toEqual({ ok: true, value: 'resolved' });
    expect(out.results.Gone).toMatchObject({ ok: false, reason: 'not-found' });
    expect(out.results.Orphan).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(out.results.Broken).toBeUndefined();
  });
});

describe('the secret-manager peer plane', () => {
  const allowAll = {
    allowed: async () => true,
    assert: async () => undefined,
    read: async () => ({ remote: false, hostKind: 'desktop' as const }),
    setRemote: async () => undefined,
  };

  it('owns the reads and gestures, never a mutation', () => {
    const plane = createSecretManagerPeerRpc({ peerExecute: allowAll });
    for (const type of [
      'oh.secretManager.list',
      'oh.secretManager.probe',
      'oh.secretManager.authorize',
      'oh.secretManager.resolveBatch',
    ]) {
      expect(plane.owns(type)).toBe(true);
    }
    for (const type of ['oh.secretManager.add', 'oh.secretManager.update', 'oh.secretManager.remove']) {
      expect(plane.owns(type)).toBe(false);
    }
  });

  it('refuses an off-device peer by name before the opt-in, and answers a loopback peer', async () => {
    let asserted = 0;
    const plane = createSecretManagerPeerRpc({
      peerExecute: {
        ...allowAll,
        assert: async () => {
          asserted++;
        },
      },
    });
    await expect(
      plane.dispatch({ type: 'oh.secretManager.list' }, { userId: 'u1', isLoopback: false }),
    ).rejects.toThrow(SECRET_MANAGER_SAME_DEVICE_MESSAGE);
    expect(asserted).toBe(0);
    await addWork();
    expect(await plane.dispatch({ type: 'oh.secretManager.list' }, { userId: 'u1', isLoopback: true })).toMatchObject({
      broker: 'local',
    });
    expect(asserted).toBe(1);
  });

  it('a loopback peer the local opt-in refuses meets that refusal', async () => {
    const plane = createSecretManagerPeerRpc({
      peerExecute: {
        ...allowAll,
        assert: async () => {
          throw new Error('local peer execute off');
        },
      },
    });
    await expect(
      plane.dispatch({ type: 'oh.secretManager.probe', uid: 'x' }, { userId: 'u1', isLoopback: true }),
    ).rejects.toThrow('local peer execute off');
  });
});
