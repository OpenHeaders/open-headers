/**
 * Node-tier environment-plane install — mode → registration over the P2
 * registry (Off / Env / Manual, Env the tier default), config seeding
 * onto the per-device slot, malformed-slot tolerance, per-resolve
 * vault-ref credentials, and the honest refusal of the desktop-only
 * modes (docs/REQUEST_ENGINE_PROXY_DESIGN.md P4).
 */

import { OH, type StorageKey } from '@openheaders/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NODE_ENVIRONMENT_PROXY_SETTINGS,
  installNodeEnvironmentProxy,
} from '../../../src/daemon/environment-proxy-install';
import {
  environmentProxyResolver,
  registerEnvironmentProxyResolver,
} from '../../../src/live/environment-proxy/registry';

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getVault: () => ({ secrets: [{ kind: 'string', name: 'corp-proxy', value: 'user:secret' }] }),
}));

function makeStore(initial?: unknown) {
  const slots = new Map<string, unknown>();
  if (initial !== undefined) slots.set(OH.environmentProxy.key, initial);
  return {
    slots,
    get<T>(spec: StorageKey<T>): Promise<T | undefined> {
      return Promise.resolve(slots.get(spec.key) as T | undefined);
    },
    set<T>(spec: StorageKey<T>, value: T): Promise<void> {
      slots.set(spec.key, value);
      return Promise.resolve();
    },
  };
}

afterEach(() => {
  // Restore the run-wide hermeticity posture (setup-environment-proxy).
  registerEnvironmentProxyResolver(null);
  delete process.env.http_proxy;
});

describe('installNodeEnvironmentProxy', () => {
  it('defaults to Env — the HTTP_PROXY-family variables answer per resolve', async () => {
    const effective = await installNodeEnvironmentProxy({ hostStorage: makeStore() });
    expect(effective).toEqual(DEFAULT_NODE_ENVIRONMENT_PROXY_SETTINGS);
    process.env.http_proxy = 'http://corp.openheaders.io:3128';
    await expect(environmentProxyResolver()?.resolve('http://api.openheaders.io/v1')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:3128' }],
      source: 'env',
    });
  });

  it("seeds the slot from a configured answer — the config surface is this tier's UI", async () => {
    const store = makeStore();
    const effective = await installNodeEnvironmentProxy({
      hostStorage: store,
      configured: { version: 1, mode: 'off' },
    });
    expect(effective).toEqual({ version: 1, mode: 'off' });
    expect(store.slots.get(OH.environmentProxy.key)).toEqual({ version: 1, mode: 'off' });
    expect(environmentProxyResolver()).toBeNull();
  });

  it('manual mode rides the host-neutral resolver with per-resolve vault credentials and bypass', async () => {
    await installNodeEnvironmentProxy({
      hostStorage: makeStore(),
      configured: {
        version: 1,
        mode: 'manual',
        manualProxyUrl: 'corp.openheaders.io:8080',
        manualCredentialRef: 'corp-proxy',
        manualBypassList: '.internal.openheaders.io',
      },
    });
    const resolver = environmentProxyResolver();
    await expect(resolver?.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:8080', credential: 'user:secret' }],
      source: 'manual',
    });
    await expect(resolver?.resolve('https://build.internal.openheaders.io/')).resolves.toBeNull();
  });

  it('applies a stored slot when no config answer rides the boot', async () => {
    const effective = await installNodeEnvironmentProxy({
      hostStorage: makeStore({ version: 1, mode: 'off' }),
    });
    expect(effective).toEqual({ version: 1, mode: 'off' });
    expect(environmentProxyResolver()).toBeNull();
  });

  it('reads a malformed slot as the tier default — never a boot failure', async () => {
    const effective = await installNodeEnvironmentProxy({ hostStorage: makeStore({ mode: 'sideways' }) });
    expect(effective).toEqual(DEFAULT_NODE_ENVIRONMENT_PROXY_SETTINGS);
    expect(environmentProxyResolver()).not.toBeNull();
  });

  it('refuses the desktop-only modes with the honest error naming env and manual', async () => {
    await expect(
      installNodeEnvironmentProxy({ hostStorage: makeStore({ version: 1, mode: 'pac', pacSource: '/etc/p.pac' }) }),
    ).rejects.toThrow(/mode 'pac' is not available on this tier.*'env'.*'manual'/s);
    await expect(
      installNodeEnvironmentProxy({ hostStorage: makeStore({ version: 1, mode: 'system' }) }),
    ).rejects.toThrow(/mode 'system' is not available on this tier/);
  });

  it('manual with nothing configured stands the plane off, mirroring the desktop', async () => {
    await installNodeEnvironmentProxy({ hostStorage: makeStore({ version: 1, mode: 'manual' }) });
    expect(environmentProxyResolver()).toBeNull();
  });
});
