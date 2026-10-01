/**
 * createSecretManagerScope — the secret-manager scope a session
 * retains: each pass asks only for the referenced secret-manager
 * entries it has no value for, a resolved value stays for the
 * session, a failed entry is asked again on its next reference, a
 * name the vault lacks or holds under another kind is never asked,
 * concurrent passes ask once, and the resolver reads the merged
 * registry and failures after every pass.
 */

import { describe, expect, it, vi } from 'vitest';
import type { SecretBrokerEntry, SecretResolution } from '../../src/secret-providers/types';
import type { Vault, VaultSecret } from '../../src/types';
import { createSecretManagerScope, VariableResolver } from '../../src/variables';

function smEntry(name: string, item = 'api.openheaders.io'): VaultSecret {
  return {
    uid: `sec-${name}`,
    kind: 'secret-manager',
    name,
    locator: { provider: 'onepassword', connectionId: 'conn0001', vault: 'Engineering', item, field: 'token' },
  };
}

const VAULT: Vault = {
  schemaVersion: 5,
  secrets: [
    smEntry('ApiToken'),
    smEntry('Other', 'other.openheaders.io'),
    { uid: 'sec-plain', kind: 'string', name: 'Plain', value: 'p' },
  ],
};

function rig(answer: (entries: readonly SecretBrokerEntry[]) => ReadonlyMap<string, SecretResolution>) {
  const resolver = new VariableResolver();
  resolver.setVault(VAULT);
  const resolveBatch = vi.fn(async (entries: readonly SecretBrokerEntry[]) => answer(entries));
  const scope = createSecretManagerScope(resolver, VAULT, resolveBatch);
  return { resolver, resolveBatch, scope };
}

const ok = (value: string): SecretResolution => ({ ok: true, value });

describe('createSecretManagerScope', () => {
  it('asks only for the referenced secret-manager entries and installs their values', async () => {
    const { resolver, resolveBatch, scope } = rig(() => new Map([['ApiToken', ok('v1')]]));
    await scope.ensure(new Set(['ApiToken', 'Plain', 'Missing']));
    expect(resolveBatch).toHaveBeenCalledTimes(1);
    expect(resolveBatch.mock.calls[0]?.[0].map((e) => e.name)).toEqual(['ApiToken']);
    expect(resolver.resolve('ApiToken')?.value).toBe('v1');
    expect(resolver.resolve('Plain')?.value).toBe('p');
  });

  it('a resolved value stays for the session — the next reference never asks again', async () => {
    const { resolveBatch, scope } = rig(() => new Map([['ApiToken', ok('v1')]]));
    await scope.ensure(new Set(['ApiToken']));
    await scope.ensure(new Set(['ApiToken']));
    expect(resolveBatch).toHaveBeenCalledTimes(1);
  });

  it('a failed entry reads its typed reason and is asked again on its next reference', async () => {
    let attempt = 0;
    const { resolver, resolveBatch, scope } = rig(() => {
      attempt += 1;
      return new Map([['ApiToken', attempt === 1 ? { ok: false, reason: 'authorization-required' } : ok('v2')]]);
    });
    await scope.ensure(new Set(['ApiToken']));
    expect(resolver.resolveScopedWithDiagnostics('ApiToken', 'vault')).toEqual({
      resolved: null,
      failureReason: 'secret-authorization-required',
    });
    await scope.ensure(new Set(['ApiToken']));
    expect(resolveBatch).toHaveBeenCalledTimes(2);
    expect(resolver.resolve('ApiToken')?.value).toBe('v2');
    expect(resolver.resolveScopedWithDiagnostics('ApiToken', 'vault').failureReason).toBeUndefined();
  });

  it('an entry the broker left unanswered reads unavailable', async () => {
    const { resolver, scope } = rig(() => new Map());
    await scope.ensure(new Set(['ApiToken']));
    expect(resolver.resolveScopedWithDiagnostics('ApiToken', 'vault').failureReason).toBe('secret-unavailable');
  });

  it('later passes only ask for what is new — the earlier values are kept', async () => {
    const { resolver, resolveBatch, scope } = rig(
      (entries) => new Map(entries.map((e) => [e.name, ok(`value-of-${e.name}`)])),
    );
    await scope.ensure(new Set(['ApiToken']));
    await scope.ensure(new Set(['ApiToken', 'Other']));
    expect(resolveBatch).toHaveBeenCalledTimes(2);
    expect(resolveBatch.mock.calls[1]?.[0].map((e) => e.name)).toEqual(['Other']);
    expect(resolver.resolve('ApiToken')?.value).toBe('value-of-ApiToken');
    expect(resolver.resolve('Other')?.value).toBe('value-of-Other');
  });

  it('concurrent passes naming the same entry ask for it once', async () => {
    const { resolveBatch, scope } = rig(() => new Map([['ApiToken', ok('v1')]]));
    await Promise.all([scope.ensure(new Set(['ApiToken'])), scope.ensure(new Set(['ApiToken']))]);
    expect(resolveBatch).toHaveBeenCalledTimes(1);
  });

  it('a pass naming nothing of the kind answers null synchronously and never touches the broker', async () => {
    const { resolveBatch, scope } = rig(() => new Map([['ApiToken', ok('v1')]]));
    expect(scope.ensure(new Set(['Plain', 'Missing']))).toBeNull();
    expect(scope.ensure(new Set())).toBeNull();
    expect(resolveBatch).not.toHaveBeenCalled();
    await scope.ensure(new Set(['ApiToken']));
    // Once resolved, the entry's next reference has nothing to ask either.
    expect(scope.ensure(new Set(['ApiToken']))).toBeNull();
  });

  it('a broker that throws fails that pass alone — the next pass runs', async () => {
    let first = true;
    const { resolver, scope } = rig(() => {
      if (first) {
        first = false;
        throw new Error('wire fell');
      }
      return new Map([['ApiToken', ok('v1')]]);
    });
    await expect(scope.ensure(new Set(['ApiToken']))).rejects.toThrow('wire fell');
    await scope.ensure(new Set(['ApiToken']));
    expect(resolver.resolve('ApiToken')?.value).toBe('v1');
  });
});
