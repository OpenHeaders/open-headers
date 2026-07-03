/**
 * Phase B — pause-markers cache subscribes to broadcast, re-projects
 * to the persisted record shape, and persists to chrome.storage.local
 * via `extensionStorage` (mocked in the in-memory broadcast bus
 * fixture).
 */

import { setPauseMarker } from '@openheaders/core/sync';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { createPauseMarkersCache } from '@openheaders/oracle/sync/caches/pause-markers-cache';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const ctxFactory = () => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: Date.now(), logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
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

describe('PauseMarkersCache', () => {
  it('returns an empty default before seeding', () => {
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    expect(cache.getSnapshot()).toEqual({ markers: {} });
    cache.dispose();
  });

  it('seeds the oracle from a persisted record and projects it back', async () => {
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedPauseMarkers({
      'collections/auth': 'paused',
      'collections/auth/folder': 'unpaused',
    });
    expect(cache.getSnapshot().markers).toEqual({
      'collections/auth': 'paused',
      'collections/auth/folder': 'unpaused',
    });
    cache.dispose();
  });

  it('updates the cache when a new marker is set via the catalog', async () => {
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedPauseMarkers({});

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });

    const intent = setPauseMarker(ctxFactory(), { path: 'collections/x', marker: 'paused' });
    await oracle.apply(intent.batch, []);
    expect(calls).toBeGreaterThan(0);
    expect(cache.getSnapshot().markers).toEqual({ 'collections/x': 'paused' });
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedPauseMarkers({});

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });
    cache.dispose();

    const intent = setPauseMarker(ctxFactory(), { path: 'collections/x', marker: 'paused' });
    await oracle.apply(intent.batch, []);
    expect(calls).toBe(0);
  });
});
