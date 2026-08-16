import { describe, expect, it } from 'vitest';
import type { Vault, VaultSecret } from '../../src/types';
import { EMPTY_SECRET_MANAGER_REGISTRY, VariableResolver } from '../../src/variables';

function vaultWith(secrets: Vault['secrets']): Vault {
  return { schemaVersion: 5, secrets };
}

function smEntry(name: string): VaultSecret {
  return {
    uid: 'sec-sm01',
    kind: 'secret-manager',
    name,
    locator: { provider: 'onepassword', vault: 'Engineering', item: 'api.openheaders.io', field: 'token' },
  };
}

describe('VariableResolver — secret-manager vault kind', () => {
  it('returns null when no secret-manager registry is installed (compile-path gate)', () => {
    // Same architectural gate as TOTP: the DNR compile pipeline never
    // installs a registry, so a provider-resolved value can never be
    // baked into a persistent rule.
    const r = new VariableResolver();
    r.setVault(vaultWith([smEntry('ApiToken')]));
    expect(r.resolve('ApiToken')).toBeNull();
  });

  it('resolves to the provider-fetched value from the registry', () => {
    const r = new VariableResolver();
    r.setVault(vaultWith([smEntry('ApiToken')]));
    r.setSecretManagerRegistry(new Map([['ApiToken', 'live-secret-value']]));
    const out = r.resolve('ApiToken');
    expect(out?.value).toBe('live-secret-value');
    expect(out?.scope).toBe('vault');
    expect(out?.isSensitive).toBe(true);
  });

  it('clearing the registry re-gates the entry', () => {
    const r = new VariableResolver();
    r.setVault(vaultWith([smEntry('ApiToken')]));
    r.setSecretManagerRegistry(new Map([['ApiToken', 'live-secret-value']]));
    expect(r.resolve('ApiToken')?.value).toBe('live-secret-value');
    r.setSecretManagerRegistry(EMPTY_SECRET_MANAGER_REGISTRY);
    expect(r.resolve('ApiToken')).toBeNull();
  });

  it('deferred mode reports the entry as resolvable without a value (renderer existence check)', () => {
    const r = new VariableResolver();
    r.setVault(vaultWith([smEntry('ApiToken')]));
    r.setDeferredVaultMode('defer');
    const out = r.resolve('ApiToken');
    expect(out?.deferred).toBe(true);
    expect(out?.value).toBe('');
  });

  it('explicit `{{vault.X}}` resolves through the registry', () => {
    const r = new VariableResolver();
    r.setVault(vaultWith([smEntry('ApiToken')]));
    r.setSecretManagerRegistry(new Map([['ApiToken', 'op-value']]));
    const tpl = r.resolveTemplate('Bearer {{vault.ApiToken}}');
    expect(tpl.result).toBe('Bearer op-value');
    expect(tpl.errors).toEqual([]);
  });

  it('registry miss without a recorded failure surfaces as `unset-in-scope`', () => {
    const r = new VariableResolver();
    r.setVault(vaultWith([smEntry('ApiToken')]));
    const tpl = r.resolveTemplate('Bearer {{vault.ApiToken}}');
    expect(tpl.result).toBe('Bearer {{vault.ApiToken}}');
    expect(tpl.errors).toHaveLength(1);
    expect(tpl.errors[0]?.reason).toBe('unset-in-scope');
  });

  it('typed failures surface as secret-* resolution errors on explicit refs', () => {
    const r = new VariableResolver();
    r.setVault(vaultWith([smEntry('ApiToken')]));
    r.setSecretManagerRegistry(new Map(), new Map([['ApiToken', 'authorization-required']]));
    const tpl = r.resolveTemplate('Bearer {{vault.ApiToken}}');
    expect(tpl.result).toBe('Bearer {{vault.ApiToken}}');
    expect(tpl.errors).toHaveLength(1);
    expect(tpl.errors[0]?.reason).toBe('secret-authorization-required');
    expect(tpl.errors[0]?.namespace).toBe('vault');
    expect(tpl.errors[0]?.hint).toContain('authorization');
  });

  it('each typed failure reason maps to its own error reason', () => {
    for (const [failure, reason] of [
      ['not-found', 'secret-not-found'],
      ['unavailable', 'secret-unavailable'],
    ] as const) {
      const r = new VariableResolver();
      r.setVault(vaultWith([smEntry('ApiToken')]));
      r.setSecretManagerRegistry(new Map(), new Map([['ApiToken', failure]]));
      const tpl = r.resolveTemplate('{{vault.ApiToken}}');
      expect(tpl.errors[0]?.reason).toBe(reason);
    }
  });

  it('failures never leak into flat-walk fall-through resolution', () => {
    // Flat `{{X}}` mirrors the TOTP reject semantics: an unprojectable
    // vault entry falls through to lower scopes.
    const r = new VariableResolver();
    r.setVault(vaultWith([smEntry('ApiToken')]));
    r.setSecretManagerRegistry(new Map(), new Map([['ApiToken', 'unavailable']]));
    r.setWorkspaceVariables({
      schemaVersion: 5,
      variables: [{ uid: 'var-0001', name: 'ApiToken', value: 'ws-fallback', type: 'default' }],
    });
    const out = r.resolve('ApiToken');
    expect(out?.value).toBe('ws-fallback');
    expect(out?.scope).toBe('workspace');
  });
});
