/**
 * buildSecretManagerRegistry — the per-execution batch resolve of the
 * REFERENCED secret-manager entries through their connections and the
 * host's provider registry. Exercised directly with fake providers
 * installed in core's (default-null) registry and an injected
 * connection lookup: values land in the registry map, every failure
 * mode lands typed in the failures map, an unreferenced entry is never
 * touched, a connection is never probed (a send is a new attempt, the
 * provider's resolve its authority), and nothing throws.
 */

import {
  registerSecretProvider,
  SECRET_PROVIDER_IDS,
  type SecretProvider,
  unregisterSecretProvider,
} from '@openheaders/core/secret-providers';
import type { SecretManagerConnection, Vault, VaultSecret } from '@openheaders/core/types';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSecretManagerRegistry } from '../../../src/live/request-exec/resolver-scope';

const WORK: SecretManagerConnection = {
  uid: 'conn0001',
  label: 'Work',
  config: { provider: 'onepassword', account: 'work', auth: 'app' },
};

const CONNECTIONS = new Map<string, SecretManagerConnection>([[WORK.uid, WORK]]);
const lookup = (uid: string) => CONNECTIONS.get(uid);

function vaultWith(secrets: VaultSecret[]): Vault {
  return { schemaVersion: 5, secrets };
}

function smEntry(uid: string, name: string, item = 'api.openheaders.io', connectionId = WORK.uid): VaultSecret {
  return {
    uid,
    kind: 'secret-manager',
    name,
    locator: { provider: 'onepassword', connectionId, vault: 'Engineering', item, field: 'token' },
  };
}

function fakeProvider(overrides: Partial<SecretProvider> = {}): SecretProvider {
  return {
    id: 'onepassword',
    yields: 'concealed-string',
    probe: async () => ({ available: true }),
    resolve: async () => ({ ok: true, value: 'resolved-secret' }),
    ...overrides,
  };
}

const all = (...names: string[]) => new Set(names);

afterEach(() => {
  for (const id of SECRET_PROVIDER_IDS) unregisterSecretProvider(id);
});

describe('buildSecretManagerRegistry', () => {
  it('returns empty maps for a vault with no secret-manager entries', async () => {
    const out = await buildSecretManagerRegistry(
      vaultWith([{ uid: 'aaaa1111', kind: 'string', name: 'X', value: 'v' }]),
      all('X'),
      lookup,
    );
    expect(out.registry.size).toBe(0);
    expect(out.failures.size).toBe(0);
  });

  it('an unreferenced entry is never resolved or failed', async () => {
    let probes = 0;
    let resolves = 0;
    registerSecretProvider(
      fakeProvider({
        probe: async () => {
          probes++;
          return { available: true };
        },
        resolve: async () => {
          resolves++;
          return { ok: true, value: 'v' };
        },
      }),
    );
    const out = await buildSecretManagerRegistry(
      vaultWith([smEntry('aaaa1111', 'Used'), smEntry('bbbb2222', 'Unused')]),
      all('Used'),
      lookup,
    );
    expect(out.registry.get('Used')).toBe('v');
    expect(out.registry.has('Unused')).toBe(false);
    expect(out.failures.has('Unused')).toBe(false);
    expect(probes).toBe(0);
    expect(resolves).toBe(1);
  });

  it('null registry (no provider installed) fails every referenced entry typed `unavailable`', async () => {
    const out = await buildSecretManagerRegistry(vaultWith([smEntry('aaaa1111', 'ApiToken')]), all('ApiToken'), lookup);
    expect(out.registry.size).toBe(0);
    expect(out.failures.get('ApiToken')).toBe('unavailable');
  });

  it('an entry naming no connection, or a connection this device lacks, fails `unavailable` without a probe', async () => {
    let probes = 0;
    registerSecretProvider(
      fakeProvider({
        probe: async () => {
          probes++;
          return { available: true };
        },
      }),
    );
    const out = await buildSecretManagerRegistry(
      vaultWith([smEntry('aaaa1111', 'Blank', 'x', ''), smEntry('bbbb2222', 'Gone', 'x', 'conn9999')]),
      all('Blank', 'Gone'),
      lookup,
    );
    expect(out.failures.get('Blank')).toBe('unavailable');
    expect(out.failures.get('Gone')).toBe('unavailable');
    expect(probes).toBe(0);
  });

  it('resolves entries through the connection and an installed provider', async () => {
    let seen: SecretManagerConnection | null = null;
    registerSecretProvider(
      fakeProvider({
        resolve: async (connection) => {
          seen = connection;
          return { ok: true, value: 'resolved-secret' };
        },
      }),
    );
    const out = await buildSecretManagerRegistry(vaultWith([smEntry('aaaa1111', 'ApiToken')]), all('ApiToken'), lookup);
    expect(out.registry.get('ApiToken')).toBe('resolved-secret');
    expect(out.failures.size).toBe(0);
    expect(seen).toBe(WORK);
  });

  it('a connection whose probe reads a standing failure still resolves — the send is a new attempt', async () => {
    let probes = 0;
    let resolves = 0;
    registerSecretProvider(
      fakeProvider({
        probe: async () => {
          probes++;
          return { available: false, reason: 'denied', detail: 'Denied authorization for SDK client' };
        },
        resolve: async () => {
          resolves++;
          return { ok: false, reason: 'authorization-required', detail: 'Denied authorization for SDK client' };
        },
      }),
    );
    const out = await buildSecretManagerRegistry(vaultWith([smEntry('aaaa1111', 'ApiToken')]), all('ApiToken'), lookup);
    expect(out.failures.get('ApiToken')).toBe('authorization-required');
    expect(resolves).toBe(1);
    expect(probes).toBe(0);
  });

  it('a send referencing several entries of one connection never probes it', async () => {
    let probes = 0;
    registerSecretProvider(
      fakeProvider({
        probe: async () => {
          probes++;
          return { available: true };
        },
      }),
    );
    const out = await buildSecretManagerRegistry(
      vaultWith([smEntry('aaaa1111', 'A'), smEntry('bbbb2222', 'B'), smEntry('cccc3333', 'C')]),
      all('A', 'B', 'C'),
      lookup,
    );
    expect(out.registry.size).toBe(3);
    expect(probes).toBe(0);
  });

  it("the provider's own typed resolve failures pass through verbatim", async () => {
    registerSecretProvider(
      fakeProvider({
        resolve: async (_connection, locator) => {
          if (locator.provider === 'onepassword' && locator.item === 'missing.openheaders.io') {
            return { ok: false, reason: 'not-found' };
          }
          return { ok: false, reason: 'authorization-required' };
        },
      }),
    );
    const out = await buildSecretManagerRegistry(
      vaultWith([smEntry('aaaa1111', 'Gone', 'missing.openheaders.io'), smEntry('bbbb2222', 'Locked')]),
      all('Gone', 'Locked'),
      lookup,
    );
    expect(out.failures.get('Gone')).toBe('not-found');
    expect(out.failures.get('Locked')).toBe('authorization-required');
    expect(out.registry.size).toBe(0);
  });

  it('a throwing provider (contract bug) degrades to typed `unavailable` instead of rejecting', async () => {
    registerSecretProvider(
      fakeProvider({
        resolve: async () => {
          throw new Error('sdk exploded');
        },
      }),
    );
    const out = await buildSecretManagerRegistry(vaultWith([smEntry('aaaa1111', 'ApiToken')]), all('ApiToken'), lookup);
    expect(out.failures.get('ApiToken')).toBe('unavailable');
  });

  it('per-entry granularity — one failure never blocks a sibling resolve', async () => {
    registerSecretProvider(
      fakeProvider({
        resolve: async (_connection, locator) =>
          locator.provider === 'onepassword' && locator.item === 'missing.openheaders.io'
            ? { ok: false, reason: 'not-found' }
            : { ok: true, value: 'sibling-ok' },
      }),
    );
    const out = await buildSecretManagerRegistry(
      vaultWith([smEntry('aaaa1111', 'Gone', 'missing.openheaders.io'), smEntry('bbbb2222', 'Fine')]),
      all('Gone', 'Fine'),
      lookup,
    );
    expect(out.registry.get('Fine')).toBe('sibling-ok');
    expect(out.failures.get('Gone')).toBe('not-found');
  });
});
