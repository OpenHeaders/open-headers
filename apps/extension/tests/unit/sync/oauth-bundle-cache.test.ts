/**
 * Phase B — oauth-bundle cache subscribes to broadcast, re-projects to
 * the persisted blob shape (Records keyed by credentialRef), and persists
 * to chrome.storage.local.
 */

import { setOAuthToken } from '@openheaders/core/sync';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { createOAuthBundleCache } from '@openheaders/oracle/sync/oauth-bundle-cache';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import type { OAuthBundleSnapshot } from '@openheaders/oracle/sync-builders/oauth-bundle-projection';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const ctxFactory = () => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: Date.now(), logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const empty = (): OAuthBundleSnapshot => ({
  schemaVersion: 5,
  tokens: {},
  configs: {},
  refreshErrors: {},
});

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

describe('OAuthBundleCache', () => {
  it('returns an empty default before seeding', () => {
    const cache = createOAuthBundleCache('ws-1', oracle, broadcast, ctxFactory);
    expect(cache.getSnapshot()).toEqual(empty());
    cache.dispose();
  });

  it('seeds the oracle from a persisted singleton and projects it back', async () => {
    const cache = createOAuthBundleCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedOAuthBundle({
      schemaVersion: 5,
      tokens: { 'cred-1': { accessToken: 'at' } },
      configs: { 'cred-1': { tokenEndpoint: 'https://oauth.openheaders.io/token' } },
      refreshErrors: {},
    });
    const snap = cache.getSnapshot();
    expect(Object.keys(snap.tokens)).toEqual(['cred-1']);
    expect(Object.keys(snap.configs)).toEqual(['cred-1']);
    cache.dispose();
  });

  it('updates the cache when a new token is set via the catalog', async () => {
    const cache = createOAuthBundleCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedOAuthBundle(empty());

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });

    const intent = setOAuthToken(ctxFactory(), {
      credentialRef: 'cred-1',
      bundle: { accessToken: 'at' },
    });
    await oracle.apply(intent.batch, []);
    expect(calls).toBeGreaterThan(0);
    expect(cache.getSnapshot().tokens).toMatchObject({ 'cred-1': { accessToken: 'at' } });
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createOAuthBundleCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedOAuthBundle(empty());

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });
    cache.dispose();

    const intent = setOAuthToken(ctxFactory(), { credentialRef: 'x', bundle: {} });
    await oracle.apply(intent.batch, []);
    expect(calls).toBe(0);
  });
});
