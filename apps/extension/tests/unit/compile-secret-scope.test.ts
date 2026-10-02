/**
 * The rule compile's secret-manager scope: the rules naming a
 * secret-manager entry are the session-only set; the pre-pass asks the
 * loopback broker once for what the rules reference and retains the
 * answer across compiles; a failed entry is asked again only on a
 * compile a person caused; a changed vault row recreates the scope;
 * the desktop app's wire losing or gaining readiness resets it and
 * rebuilds, and tells the pages who answers now.
 */

import type { SecretBrokerEntry, SecretResolution } from '@openheaders/core/secret-providers';
import type { HeaderRule, Vault, VaultSecret } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveBatch, vaultRef } = vi.hoisted(() => ({
  mockResolveBatch: vi.fn<(entries: readonly SecretBrokerEntry[]) => Promise<ReadonlyMap<string, SecretResolution>>>(
    async () => new Map(),
  ),
  vaultRef: { current: { schemaVersion: 5, secrets: [] } as Vault },
}));

vi.mock('@/background/modules/secret-manager/loopback-broker', () => ({
  createLoopbackSecretManagerBroker: () => ({ resolveBatch: mockResolveBatch }),
  subscribeDesktopWireReady: () => () => undefined,
}));
vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getVault: () => vaultRef.current,
}));

import {
  getCompileSecretManagerSnapshot,
  installCompileSecretManagerLifecycle,
  prepareCompileSecretManagerScope,
  resetCompileSecretManagerScope,
  secretBearingRuleUids,
} from '@/background/modules/secret-manager/compile-secret-scope';

function smEntry(name: string, field = 'token'): VaultSecret {
  return {
    uid: `sec-${name}`,
    kind: 'secret-manager',
    name,
    locator: { provider: 'onepassword', connectionId: 'conn0001', vault: 'Demo', item: 'api.openheaders.io', field },
  };
}

function headerRule(uid: string, value: string): HeaderRule {
  return {
    schemaVersion: 5,
    uid,
    path: `rules/${uid}`,
    name: uid,
    type: 'header',
    enabled: true,
    published: true,
    conditions: [{ uid: 'c1', type: 'request-domains', values: ['*.openheaders.io'] }],
    action: {
      requestHeaders: [{ uid: 'h1', operation: 'override', headerName: 'Authorization', value }],
      responseHeaders: [],
    },
  };
}

const ok = (value: string): SecretResolution => ({ ok: true, value });

beforeEach(() => {
  mockResolveBatch.mockReset();
  mockResolveBatch.mockImplementation(async () => new Map());
  vaultRef.current = {
    schemaVersion: 5,
    secrets: [smEntry('ApiToken'), { uid: 'sec-plain', kind: 'string', name: 'Plain', value: 'p' }],
  };
  resetCompileSecretManagerScope();
});

describe('secretBearingRuleUids', () => {
  it('names the rules whose templates reach a secret-manager entry — explicit or flat — and no other', () => {
    const uids = secretBearingRuleUids([
      headerRule('r-explicit', 'Bearer {{vault.ApiToken}}'),
      headerRule('r-flat', 'Bearer {{ApiToken}}'),
      headerRule('r-plain', 'Bearer {{vault.Plain}}'),
      headerRule('r-env', 'Bearer {{env.ApiToken}}'),
      headerRule('r-none', 'Bearer literal'),
    ]);
    expect([...uids].sort()).toEqual(['r-explicit', 'r-flat']);
  });

  it('is empty when the vault holds no secret-manager row', () => {
    vaultRef.current = { schemaVersion: 5, secrets: [] };
    expect(secretBearingRuleUids([headerRule('r1', '{{vault.ApiToken}}')]).size).toBe(0);
  });
});

describe('prepareCompileSecretManagerScope', () => {
  const rules = [headerRule('r1', 'Bearer {{vault.ApiToken}}'), headerRule('r2', '{{vault.Plain}}')];

  it('asks once for the referenced entries, installs the snapshot, and never asks again for a retained value', async () => {
    mockResolveBatch.mockResolvedValueOnce(new Map([['ApiToken', ok('v1')]]));
    await prepareCompileSecretManagerScope(rules, { retryFailed: true });
    expect(mockResolveBatch).toHaveBeenCalledTimes(1);
    expect(mockResolveBatch.mock.calls[0]?.[0].map((e) => e.name)).toEqual(['ApiToken']);
    expect(getCompileSecretManagerSnapshot().registry.get('ApiToken')).toBe('v1');
    // A later compile: nothing to ask, synchronously.
    expect(prepareCompileSecretManagerScope(rules, { retryFailed: false })).toBeNull();
    expect(prepareCompileSecretManagerScope(rules, { retryFailed: true })).toBeNull();
    expect(mockResolveBatch).toHaveBeenCalledTimes(1);
  });

  it('answers null without asking when the rules reference no secret-manager entry', () => {
    expect(prepareCompileSecretManagerScope([headerRule('r2', '{{vault.Plain}}')], { retryFailed: true })).toBeNull();
    expect(mockResolveBatch).not.toHaveBeenCalled();
    expect(getCompileSecretManagerSnapshot().registry.size).toBe(0);
  });

  it("a failed entry stands on a timer's compile and is asked again on a person's", async () => {
    mockResolveBatch.mockResolvedValueOnce(new Map([['ApiToken', { ok: false, reason: 'authorization-required' }]]));
    await prepareCompileSecretManagerScope(rules, { retryFailed: true });
    expect(getCompileSecretManagerSnapshot().failures.get('ApiToken')).toBe('authorization-required');
    expect(prepareCompileSecretManagerScope(rules, { retryFailed: false })).toBeNull();
    expect(mockResolveBatch).toHaveBeenCalledTimes(1);
    mockResolveBatch.mockResolvedValueOnce(new Map([['ApiToken', ok('v2')]]));
    await prepareCompileSecretManagerScope(rules, { retryFailed: true });
    expect(mockResolveBatch).toHaveBeenCalledTimes(2);
    expect(getCompileSecretManagerSnapshot().registry.get('ApiToken')).toBe('v2');
    expect(getCompileSecretManagerSnapshot().failures.has('ApiToken')).toBe(false);
  });

  it('a changed secret-manager row recreates the scope — the retained value goes, the row is asked afresh', async () => {
    mockResolveBatch.mockResolvedValueOnce(new Map([['ApiToken', ok('v1')]]));
    await prepareCompileSecretManagerScope(rules, { retryFailed: true });
    vaultRef.current = { ...vaultRef.current, secrets: [smEntry('ApiToken', 'password')] };
    mockResolveBatch.mockResolvedValueOnce(new Map([['ApiToken', ok('v-password')]]));
    await prepareCompileSecretManagerScope(rules, { retryFailed: false });
    expect(mockResolveBatch).toHaveBeenCalledTimes(2);
    expect(mockResolveBatch.mock.calls[1]?.[0][0]?.locator).toMatchObject({ field: 'password' });
    expect(getCompileSecretManagerSnapshot().registry.get('ApiToken')).toBe('v-password');
  });
});

describe('installCompileSecretManagerLifecycle', () => {
  it("the desktop app's wire losing readiness strips and gaining it re-asks, telling the pages who answers", async () => {
    const rules = [headerRule('r1', 'Bearer {{vault.ApiToken}}')];
    let onReady: ((ready: boolean) => void) | null = null;
    const rebuild = vi.fn();
    const onBrokerChange = vi.fn();
    const dispose = installCompileSecretManagerLifecycle({
      rebuild,
      onBrokerChange,
      subscribeReady: (cb) => {
        onReady = cb;
        return () => undefined;
      },
    });
    if (onReady === null) throw new Error('the lifecycle never subscribed');
    const ready = onReady as (ready: boolean) => void;

    mockResolveBatch.mockResolvedValueOnce(new Map([['ApiToken', ok('v1')]]));
    await prepareCompileSecretManagerScope(rules, { retryFailed: true });
    expect(getCompileSecretManagerSnapshot().registry.get('ApiToken')).toBe('v1');

    // The strip: the retained value goes; the rebuild's ask reads the
    // broker's own away answer; the pages hear who answers now.
    ready(false);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(onBrokerChange).toHaveBeenLastCalledWith('unreachable');
    expect(getCompileSecretManagerSnapshot().registry.size).toBe(0);
    mockResolveBatch.mockResolvedValueOnce(new Map([['ApiToken', { ok: false, reason: 'broker-unreachable' }]]));
    await prepareCompileSecretManagerScope(rules, { retryFailed: true });
    expect(getCompileSecretManagerSnapshot().failures.get('ApiToken')).toBe('broker-unreachable');

    // The re-ask once HELLO is accepted.
    ready(true);
    expect(rebuild).toHaveBeenCalledTimes(2);
    expect(onBrokerChange).toHaveBeenLastCalledWith('desktop-app');
    mockResolveBatch.mockResolvedValueOnce(new Map([['ApiToken', ok('v3')]]));
    await prepareCompileSecretManagerScope(rules, { retryFailed: false });
    expect(getCompileSecretManagerSnapshot().registry.get('ApiToken')).toBe('v3');
    dispose();
  });
});
