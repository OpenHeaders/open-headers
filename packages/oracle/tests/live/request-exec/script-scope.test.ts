/**
 * Script variable scope — what a script's `oh.variables.get` /
 * `oh.vault.get` read. `createScriptVariableScope` reads one reference
 * through a resolution's two halves (the pre-pass awaited first, then
 * the template resolve; any miss or a literal answer is `null`);
 * `scriptScopeOverResolver` is the HTTP pipeline's scope over the
 * resolver and context one send resolved with — every scope the
 * templates reach (vault, environment, collection, workspace, live,
 * step captures), a secret-manager entry asked of the host's broker on
 * first read and kept for the next.
 */

import type { SecretBrokerEntry } from '@openheaders/core/secret-providers';
import type { Environment, Vault } from '@openheaders/core/types';
import { type UnresolvedReferences, VariableResolver } from '@openheaders/core/variables';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveBatch = vi.fn(async (entries: readonly SecretBrokerEntry[]) => {
  return new Map(entries.map((entry) => [entry.name, { ok: true as const, value: `sm:${entry.name}` }]));
});
vi.mock('../../../src/live/request-exec/secret-manager-broker', () => ({
  getSecretManagerBroker: () => ({ resolveBatch: (entries: readonly SecretBrokerEntry[]) => resolveBatch(entries) }),
}));

import { createScriptVariableScope, scriptScopeOverResolver } from '../../../src/live/request-exec/script-scope';

const vault: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'sec00001', kind: 'string', name: 'api_key', value: 'k-1' },
    {
      uid: 'sec00002',
      kind: 'secret-manager',
      name: 'db_password',
      locator: { provider: 'onepassword', connectionId: 'conn0001', vault: 'Engineering', item: 'db', field: 'token' },
    },
  ],
};

const staging: Environment = {
  schemaVersion: 5,
  uid: 'env00001',
  name: 'Staging',
  variables: [{ uid: 'var00001', name: 'HOST', value: 'staging.openheaders.io', type: 'default' }],
};

function resolverUnderTest(): VariableResolver {
  const resolver = new VariableResolver();
  resolver.setVault(vault);
  resolver.setEnvironments([staging]);
  resolver.setActiveEnvironmentId(null);
  resolver.setDefaultEnvironmentId(null);
  resolver.setWorkspaceVariables({
    schemaVersion: 5,
    variables: [{ uid: 'var00002', name: 'region', value: 'eu', type: 'default' }],
  });
  resolver.setCollectionVariables('rcol0001', [
    { uid: 'var00003', name: 'BASE', value: 'https://api.openheaders.io/v2', type: 'default' },
  ]);
  resolver.setLiveRegistry(new Map([['token', { value: 'lt-9', workflowUid: 'wf00001' }]]));
  resolver.setStepCaptures(new Map([['s1', new Map([['id', '42']])]]));
  return resolver;
}

beforeEach(() => {
  resolveBatch.mockClear();
});

describe('createScriptVariableScope', () => {
  it('awaits the pre-pass over the reference, then resolves it; a miss or a literal answer is null', async () => {
    const order: string[] = [];
    const scope = createScriptVariableScope({
      prepare: (templates) => {
        order.push(`prepare ${templates.join(',')}`);
        return Promise.resolve();
      },
      resolve: (template, unresolved: UnresolvedReferences) => {
        order.push(`resolve ${template}`);
        if (template === '{{env.HOST}}') return 'staging.openheaders.io';
        if (template === '{{literal}}') return template;
        unresolved.set('nope', {
          reference: 'nope',
          reason: 'unset-in-scope',
          namespace: null,
          variableName: 'nope',
          activeEnvironmentId: null,
          defaultEnvironmentId: null,
          hint: '',
        });
        return 'partial';
      },
    });
    expect(await scope.readVariable('env.HOST')).toBe('staging.openheaders.io');
    expect(order).toEqual(['prepare {{env.HOST}}', 'resolve {{env.HOST}}']);
    expect(await scope.readVariable('nope')).toBeNull();
    expect(await scope.readVariable('literal')).toBeNull();
  });
});

describe('scriptScopeOverResolver', () => {
  it("reads every scope the send's templates reach, under the send's collection and environment", async () => {
    const scope = scriptScopeOverResolver(
      resolverUnderTest(),
      { collectionId: 'rcol0001', environmentId: 'env00001' },
      vault,
    );
    expect(await scope.readVariable('vault.api_key')).toBe('k-1');
    expect(await scope.readVariable('api_key')).toBe('k-1');
    expect(await scope.readVariable('env.HOST')).toBe('staging.openheaders.io');
    expect(await scope.readVariable('collection.BASE')).toBe('https://api.openheaders.io/v2');
    expect(await scope.readVariable('BASE')).toBe('https://api.openheaders.io/v2');
    expect(await scope.readVariable('workspace.region')).toBe('eu');
    expect(await scope.readVariable('live.token')).toBe('lt-9');
    expect(await scope.readVariable('step.s1.id')).toBe('42');
    expect(await scope.readVariable('nope')).toBeNull();
    expect(resolveBatch).not.toHaveBeenCalled();
  });

  it("another collection's variable and an unpinned environment's are out of scope", async () => {
    const scope = scriptScopeOverResolver(
      resolverUnderTest(),
      { collectionId: 'rcol0002', environmentId: null },
      vault,
    );
    expect(await scope.readVariable('collection.BASE')).toBeNull();
    expect(await scope.readVariable('env.HOST')).toBeNull();
    expect(await scope.readVariable('workspace.region')).toBe('eu');
  });

  it('asks the broker for a secret-manager entry on first read and keeps the value for the next', async () => {
    const scope = scriptScopeOverResolver(resolverUnderTest(), {}, vault);
    expect(await scope.readVariable('vault.db_password')).toBe('sm:db_password');
    expect(await scope.readVariable('db_password')).toBe('sm:db_password');
    expect(resolveBatch).toHaveBeenCalledTimes(1);
    expect(resolveBatch.mock.calls[0]?.[0].map((entry) => entry.name)).toEqual(['db_password']);
  });
});
