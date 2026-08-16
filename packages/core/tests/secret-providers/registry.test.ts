import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSecretLocator,
  formatSecretLocator,
  getSecretProvider,
  isSecretLocatorComplete,
  listSecretProviders,
  registerSecretProvider,
  SECRET_LOCATOR_FIELDS,
  SECRET_PROVIDER_IDS,
  type SecretProvider,
  secretLocatorToFields,
  unregisterSecretProvider,
} from '../../src/secret-providers';
import type { SecretLocator } from '../../src/types';

function fakeProvider(overrides: Partial<SecretProvider> = {}): SecretProvider {
  return {
    id: 'onepassword',
    yields: 'concealed-string',
    probe: async () => ({ available: true }),
    resolve: async () => ({ ok: true, value: 'v' }),
    ...overrides,
  };
}

describe('secret-provider registry', () => {
  afterEach(() => {
    for (const id of SECRET_PROVIDER_IDS) unregisterSecretProvider(id);
  });

  it('starts null — no provider installed', () => {
    expect(listSecretProviders()).toEqual([]);
    expect(getSecretProvider('onepassword')).toBeUndefined();
  });

  it('register / get / list / unregister round-trips', () => {
    const p = fakeProvider();
    registerSecretProvider(p);
    expect(getSecretProvider('onepassword')).toBe(p);
    expect(listSecretProviders()).toEqual([p]);
    unregisterSecretProvider('onepassword');
    expect(getSecretProvider('onepassword')).toBeUndefined();
  });

  it('re-registering replaces the prior implementation', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registerSecretProvider(first);
    registerSecretProvider(second);
    expect(getSecretProvider('onepassword')).toBe(second);
    expect(listSecretProviders()).toHaveLength(1);
  });
});

describe('secret locator helpers', () => {
  it('every provider id has a field spec with at least one required field', () => {
    for (const id of SECRET_PROVIDER_IDS) {
      const specs = SECRET_LOCATOR_FIELDS[id];
      expect(specs.length).toBeGreaterThan(0);
      expect(specs.some((s) => s.required)).toBe(true);
    }
  });

  it('buildSecretLocator is forgiving — missing required fields become empty strings', () => {
    const locator = buildSecretLocator('onepassword', { vault: 'Engineering' });
    expect(locator).toEqual({ provider: 'onepassword', vault: 'Engineering', item: '', field: '' });
    expect(isSecretLocatorComplete(locator)).toBe(false);
  });

  it('buildSecretLocator omits blank optional fields for byte-stable rows', () => {
    const locator = buildSecretLocator('awssm', { name: 'db-password', stage: '', region: ' ' });
    expect(locator).toEqual({ provider: 'awssm', name: 'db-password' });
    expect(isSecretLocatorComplete(locator)).toBe(true);
  });

  it('secretLocatorToFields inverts buildSecretLocator', () => {
    const values = { mount: 'kv', path: 'apps/openheaders', key: 'token', serverUrl: 'https://vault.openheaders.io' };
    const locator = buildSecretLocator('hashivault', values);
    expect(secretLocatorToFields(locator)).toEqual(values);
  });

  it('formatSecretLocator renders each provider in its native idiom', () => {
    const cases: Array<[SecretLocator, string]> = [
      [
        { provider: 'onepassword', vault: 'Engineering', item: 'api.openheaders.io', field: 'token' },
        'op://Engineering/api.openheaders.io/token',
      ],
      [{ provider: 'bitwarden', secretId: 'bw-secret-id' }, 'bw-secret-id'],
      [{ provider: 'oskeychain', service: 'openheaders.io', account: 'daniel' }, 'openheaders.io/daniel'],
      [{ provider: 'awssm', name: 'db-password', stage: 'AWSCURRENT', region: 'eu-west-1' }, 'db-password:AWSCURRENT (eu-west-1)'],
      [
        { provider: 'azurekv', vaultUrl: 'https://oh.vault.azure.net', name: 'token' },
        'https://oh.vault.azure.net/secrets/token',
      ],
      [{ provider: 'hashivault', mount: 'kv', path: 'apps/openheaders', key: 'token' }, 'kv/apps/openheaders#token'],
    ];
    for (const [locator, expected] of cases) {
      expect(formatSecretLocator(locator)).toBe(expected);
    }
  });
});
