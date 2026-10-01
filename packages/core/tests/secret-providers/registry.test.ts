import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSecretConnectionConfig,
  buildSecretLocator,
  describeSecretConnection,
  formatSecretLocator,
  getSecretProvider,
  hasSecretLocatorConnection,
  isSecretConnectionConfigComplete,
  isSecretLocatorComplete,
  listSecretProviders,
  registerSecretProvider,
  SECRET_CONNECTION_FIELDS,
  SECRET_LOCATOR_FIELDS,
  SECRET_PROVIDER_IDS,
  type SecretProvider,
  secretConnectionConfigToFields,
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
    const locator = buildSecretLocator('onepassword', '', { vault: 'Engineering' });
    expect(locator).toEqual({ provider: 'onepassword', connectionId: '', vault: 'Engineering', item: '', field: '' });
    expect(isSecretLocatorComplete(locator)).toBe(false);
    expect(hasSecretLocatorConnection(locator)).toBe(false);
  });

  it('buildSecretLocator omits blank optional fields for byte-stable rows', () => {
    const locator = buildSecretLocator('awssm', 'conn0001', { name: 'db-password', stage: '' });
    expect(locator).toEqual({ provider: 'awssm', connectionId: 'conn0001', name: 'db-password' });
    expect(isSecretLocatorComplete(locator)).toBe(true);
    expect(hasSecretLocatorConnection(locator)).toBe(true);
  });

  it('secretLocatorToFields inverts buildSecretLocator over the path fields only', () => {
    const values = { mount: 'kv', path: 'apps/openheaders', key: 'token' };
    const locator = buildSecretLocator('hashivault', 'conn0001', values);
    expect(secretLocatorToFields(locator)).toEqual(values);
  });

  it('formatSecretLocator renders each provider path in its native idiom', () => {
    const cases: Array<[SecretLocator, string]> = [
      [
        { provider: 'onepassword', connectionId: 'c1', vault: 'Engineering', item: 'api.openheaders.io', field: 'token' },
        'op://Engineering/api.openheaders.io/token',
      ],
      [{ provider: 'bitwarden', connectionId: 'c1', secretId: 'bw-secret-id' }, 'bw-secret-id'],
      [{ provider: 'oskeychain', connectionId: 'c1', service: 'openheaders.io', account: 'daniel' }, 'openheaders.io/daniel'],
      [{ provider: 'awssm', connectionId: 'c1', name: 'db-password', stage: 'AWSCURRENT' }, 'db-password:AWSCURRENT'],
      [{ provider: 'azurekv', connectionId: 'c1', name: 'token', version: 'v2' }, 'token/v2'],
      [{ provider: 'hashivault', connectionId: 'c1', mount: 'kv', path: 'apps/openheaders', key: 'token' }, 'kv/apps/openheaders#token'],
    ];
    for (const [locator, expected] of cases) {
      expect(formatSecretLocator(locator)).toBe(expected);
    }
  });
});

describe('secret connection helpers', () => {
  it('every provider id has a connection field spec (possibly empty) whose keys mirror the config', () => {
    for (const id of SECRET_PROVIDER_IDS) {
      const specs = SECRET_CONNECTION_FIELDS[id];
      const config = buildSecretConnectionConfig(id, {});
      for (const spec of specs) {
        if (spec.required || spec.options) expect(config).toHaveProperty(spec.key);
      }
    }
  });

  it('buildSecretConnectionConfig is forgiving and defaults picklists', () => {
    expect(buildSecretConnectionConfig('onepassword', {})).toEqual({ provider: 'onepassword', account: '', auth: 'app' });
    expect(buildSecretConnectionConfig('onepassword', { account: ' work ', auth: 'service-account' })).toEqual({
      provider: 'onepassword',
      account: 'work',
      auth: 'service-account',
    });
    expect(buildSecretConnectionConfig('hashivault', { serverUrl: 'https://vault.openheaders.io', authMethod: 'bogus' })).toEqual({
      provider: 'hashivault',
      serverUrl: 'https://vault.openheaders.io',
      authMethod: 'token',
    });
    expect(buildSecretConnectionConfig('awssm', { profile: '', region: ' ' })).toEqual({ provider: 'awssm' });
  });

  it('isSecretConnectionConfigComplete gates on the required fields', () => {
    expect(isSecretConnectionConfigComplete(buildSecretConnectionConfig('onepassword', {}))).toBe(false);
    expect(isSecretConnectionConfigComplete(buildSecretConnectionConfig('onepassword', { account: 'work' }))).toBe(true);
    expect(isSecretConnectionConfigComplete(buildSecretConnectionConfig('oskeychain', {}))).toBe(true);
    expect(isSecretConnectionConfigComplete(buildSecretConnectionConfig('azurekv', {}))).toBe(false);
  });

  it('secretConnectionConfigToFields inverts buildSecretConnectionConfig', () => {
    const values = { serverUrl: 'https://vault.openheaders.io', namespace: 'team', authMethod: 'oidc' };
    expect(secretConnectionConfigToFields(buildSecretConnectionConfig('hashivault', values))).toEqual(values);
  });

  it('describeSecretConnection names the instance, never a credential', () => {
    expect(
      describeSecretConnection({ uid: 'conn0001', label: 'Work', config: { provider: 'onepassword', account: 'work', auth: 'app' } }),
    ).toBe('work');
    expect(
      describeSecretConnection({ uid: 'conn0002', label: 'Prod', config: { provider: 'awssm', profile: 'prod', region: 'eu-west-1' } }),
    ).toBe('prod · eu-west-1');
    expect(describeSecretConnection({ uid: 'conn0003', label: 'Local', config: { provider: 'oskeychain' } })).toBe('');
  });
});
