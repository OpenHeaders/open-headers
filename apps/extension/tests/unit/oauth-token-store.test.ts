/**
 * oauth-token-store — verifies workspace scoping + lock wrapping +
 * change-listener semantics. Storage is the same chrome.storage
 * Map-backing the rest of the store tests use.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/workspace/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'ws-oauth'),
}));

import { installBackingStorage, installHostStorage, snapshotStorage } from '../helpers/chrome-storage-backing';

class FifoLockRuntime {
  private queues = new Map<string, Array<() => void>>();
  private holders = new Set<string>();
  async request<T>(name: string, _options: unknown, callback: () => Promise<T> | T): Promise<T> {
    if (this.holders.has(name)) {
      await new Promise<void>((resolve) => {
        const q = this.queues.get(name) ?? [];
        q.push(resolve);
        this.queues.set(name, q);
      });
    }
    this.holders.add(name);
    try {
      return await callback();
    } finally {
      this.holders.delete(name);
      const q = this.queues.get(name);
      if (q && q.length > 0) q.shift()!();
    }
  }
}

let store: typeof import('@openheaders/oracle/entity/oauth-token-store');

beforeEach(async () => {
  installBackingStorage();
  vi.resetModules();
  await installHostStorage();
  const lockModule = await import('@openheaders/oracle/coordination');
  lockModule.setLockRuntime(new FifoLockRuntime());
  const { setOracleHostHooks } = await import('@openheaders/oracle/sync');
  setOracleHostHooks({ getActiveWorkspaceId: () => 'ws-oauth' });
  store = await import('@openheaders/oracle/entity/oauth-token-store');
});

afterEach(async () => {
  const lockModule = await import('@openheaders/oracle/coordination');
  lockModule.setLockRuntime(null);
});

function fixtureBundle(overrides: Partial<OAuth2TokenBundle> = {}): OAuth2TokenBundle {
  return {
    accessToken: 'at-xyz',
    tokenType: 'Bearer',
    scope: 'read',
    issuedAt: 1_000_000,
    expiresAt: 1_000_000 + 3600_000,
    ...overrides,
  };
}

describe('oauth-token-store', () => {
  it('putTokenBundle + getTokenBundle round-trip by credentialRef', async () => {
    await store.putTokenBundle('cred-1', fixtureBundle({ accessToken: 'first' }));
    const roundtrip = await store.getTokenBundle('cred-1');
    expect(roundtrip?.accessToken).toBe('first');
  });

  it('getTokenBundle returns null for unknown credentialRef', async () => {
    expect(await store.getTokenBundle('missing')).toBeNull();
  });

  it('listTokenBundles returns every credential as a map copy', async () => {
    await store.putTokenBundle('cred-1', fixtureBundle({ accessToken: 'one' }));
    await store.putTokenBundle('cred-2', fixtureBundle({ accessToken: 'two' }));
    const all = await store.listTokenBundles();
    expect(all['cred-1']?.accessToken).toBe('one');
    expect(all['cred-2']?.accessToken).toBe('two');
  });

  it('deleteTokenBundle returns true when removing, false when absent', async () => {
    await store.putTokenBundle('cred-1', fixtureBundle());
    expect(await store.deleteTokenBundle('cred-1')).toBe(true);
    expect(await store.deleteTokenBundle('cred-1')).toBe(false);
  });

  it('purgeOAuthForWorkspace drops every credential for the workspace', async () => {
    await store.putTokenBundle('cred-1', fixtureBundle());
    await store.putTokenBundle('cred-2', fixtureBundle());
    await store.purgeOAuthForWorkspace('ws-oauth');
    expect(await store.listTokenBundles()).toEqual({});
    // Storage key for the workspace should also be gone.
    expect(snapshotStorage()['oh.ws.ws-oauth.oauth']).toBeUndefined();
  });

  it('serializes concurrent puts through the per-workspace lock', async () => {
    const puts = Array.from({ length: 5 }, (_, i) =>
      store.putTokenBundle(`cred-${i}`, fixtureBundle({ accessToken: `t${i}` })),
    );
    await Promise.all(puts);
    const all = await store.listTokenBundles();
    expect(Object.keys(all)).toHaveLength(5);
  });

  it('fires onOAuthStoreChange listener after putTokenBundle', async () => {
    const spy = vi.fn();
    const unsub = store.onOAuthStoreChange(spy);
    await store.putTokenBundle('cred-1', fixtureBundle());
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('fires listener after successful delete; stays silent on no-op delete', async () => {
    await store.putTokenBundle('cred-1', fixtureBundle());
    const spy = vi.fn();
    const unsub = store.onOAuthStoreChange(spy);
    await store.deleteTokenBundle('cred-1');
    expect(spy).toHaveBeenCalledTimes(1);
    await store.deleteTokenBundle('missing');
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
  });
});
