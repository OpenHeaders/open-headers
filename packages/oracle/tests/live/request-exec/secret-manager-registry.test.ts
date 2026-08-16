/**
 * buildSecretManagerRegistry — the per-execution batch resolve over the
 * host's secret-provider registry. Exercised directly with fake
 * providers installed in core's (default-null) registry: values land in
 * the registry map, every failure mode lands typed in the failures map,
 * and nothing throws.
 */

import {
  registerSecretProvider,
  SECRET_PROVIDER_IDS,
  type SecretProvider,
  unregisterSecretProvider,
} from '@openheaders/core/secret-providers';
import type { Vault, VaultSecret } from '@openheaders/core/types';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSecretManagerRegistry } from '../../../src/live/request-exec/resolver-scope';

function vaultWith(secrets: VaultSecret[]): Vault {
  return { schemaVersion: 5, secrets };
}

function smEntry(uid: string, name: string, item = 'api.openheaders.io'): VaultSecret {
  return {
    uid,
    kind: 'secret-manager',
    name,
    locator: { provider: 'onepassword', vault: 'Engineering', item, field: 'token' },
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

afterEach(() => {
  for (const id of SECRET_PROVIDER_IDS) unregisterSecretProvider(id);
});

describe('buildSecretManagerRegistry', () => {
  it('returns empty maps for a vault with no secret-manager entries', async () => {
    const out = await buildSecretManagerRegistry(
      vaultWith([{ uid: 'aaaa1111', kind: 'string', name: 'X', value: 'v' }]),
    );
    expect(out.registry.size).toBe(0);
    expect(out.failures.size).toBe(0);
  });

  it('null registry (no provider installed) fails every entry typed `unavailable`', async () => {
    const out = await buildSecretManagerRegistry(vaultWith([smEntry('aaaa1111', 'ApiToken')]));
    expect(out.registry.size).toBe(0);
    expect(out.failures.get('ApiToken')).toBe('unavailable');
  });

  it('resolves entries through an installed provider', async () => {
    registerSecretProvider(fakeProvider());
    const out = await buildSecretManagerRegistry(vaultWith([smEntry('aaaa1111', 'ApiToken')]));
    expect(out.registry.get('ApiToken')).toBe('resolved-secret');
    expect(out.failures.size).toBe(0);
  });

  it('probe unavailable degrades to typed `unavailable` without calling resolve', async () => {
    let resolveCalled = false;
    registerSecretProvider(
      fakeProvider({
        probe: async () => ({ available: false, reason: 'not-installed' }),
        resolve: async () => {
          resolveCalled = true;
          return { ok: true, value: 'never' };
        },
      }),
    );
    const out = await buildSecretManagerRegistry(vaultWith([smEntry('aaaa1111', 'ApiToken')]));
    expect(out.failures.get('ApiToken')).toBe('unavailable');
    expect(resolveCalled).toBe(false);
  });

  it("the provider's own typed resolve failures pass through verbatim", async () => {
    registerSecretProvider(
      fakeProvider({
        resolve: async (locator) => {
          if (locator.provider === 'onepassword' && locator.item === 'missing.openheaders.io') {
            return { ok: false, reason: 'not-found' };
          }
          return { ok: false, reason: 'authorization-required' };
        },
      }),
    );
    const out = await buildSecretManagerRegistry(
      vaultWith([smEntry('aaaa1111', 'Gone', 'missing.openheaders.io'), smEntry('bbbb2222', 'Locked')]),
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
    const out = await buildSecretManagerRegistry(vaultWith([smEntry('aaaa1111', 'ApiToken')]));
    expect(out.failures.get('ApiToken')).toBe('unavailable');
  });

  it('per-entry granularity — one failure never blocks a sibling resolve', async () => {
    registerSecretProvider(
      fakeProvider({
        resolve: async (locator) =>
          locator.provider === 'onepassword' && locator.item === 'missing.openheaders.io'
            ? { ok: false, reason: 'not-found' }
            : { ok: true, value: 'sibling-ok' },
      }),
    );
    const out = await buildSecretManagerRegistry(
      vaultWith([smEntry('aaaa1111', 'Gone', 'missing.openheaders.io'), smEntry('bbbb2222', 'Fine')]),
    );
    expect(out.registry.get('Fine')).toBe('sibling-ok');
    expect(out.failures.get('Gone')).toBe('not-found');
  });
});
