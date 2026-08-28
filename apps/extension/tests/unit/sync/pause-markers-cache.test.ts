/**
 * Phase B — pause-markers cache subscribes to broadcast, re-projects
 * to the persisted record shape, and persists to chrome.storage.local
 * via `extensionStorage` (mocked in the in-memory broadcast bus
 * fixture). Slice 4: the record is keyed by container uid; a version-1
 * (path-keyed) record at rest seeds and migrates on read.
 */

import { COLLECTION_ENTITY_TYPE, setPauseMarker } from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { createPauseMarkersCache } from '@openheaders/oracle/sync/caches/pause-markers-cache';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { beforeEach, describe, expect, it } from 'vitest';

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
    expect(cache.getSnapshot()).toEqual({ markers: {}, entries: [] });
    cache.dispose();
  });

  it('seeds the oracle from a persisted record and projects it back', async () => {
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedPauseMarkers({
      markers: { col00001: 'paused', fld00001: 'unpaused' },
      entries: [
        { type: 'collection', uid: 'col00001', marker: 'paused', path: 'rules/auth-col00001' },
        { type: 'folder', uid: 'fld00001', marker: 'unpaused' },
      ],
    });
    expect(cache.getSnapshot()).toEqual({
      markers: { col00001: 'paused', fld00001: 'unpaused' },
      entries: [
        { type: 'collection', uid: 'col00001', marker: 'paused', path: 'rules/auth-col00001' },
        { type: 'folder', uid: 'fld00001', marker: 'unpaused' },
      ],
    });
    cache.dispose();
  });

  it('migrates a version-1 path-keyed record on read through the path tail', async () => {
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedPauseMarkers({
      'rules/auth-col00001': 'paused',
      'rules/auth-col00001/login-fld00001': 'unpaused',
    });
    expect(cache.getSnapshot()).toEqual({
      markers: { col00001: 'paused', fld00001: 'unpaused' },
      entries: [
        { type: 'collection', uid: 'col00001', marker: 'paused', path: 'rules/auth-col00001' },
        { type: 'folder', uid: 'fld00001', marker: 'unpaused', path: 'rules/auth-col00001/login-fld00001' },
      ],
    });
    cache.dispose();
  });

  it('migrates a version-1 path through the live container list when the path carries no uid tail', async () => {
    await oracle.apply(
      seedCollection(
        {
          schemaVersion: 5,
          uid: 'col00002',
          name: 'Legacy',
          path: 'rules/legacy',
          variables: [],
          pinnedEnvironmentIds: [],
          defaultEnvironmentId: null,
        },
        ctxFactory(),
      ),
      [],
    );
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedPauseMarkers({ 'rules/legacy': 'paused', 'rules/nowhere': 'paused' });
    expect(cache.getSnapshot().entries).toEqual([
      { type: COLLECTION_ENTITY_TYPE, uid: 'col00002', marker: 'paused', path: 'rules/legacy' },
    ]);
    cache.dispose();
  });

  it('updates the cache when a new marker is set via the catalog', async () => {
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedPauseMarkers({ markers: {}, entries: [] });

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });

    const intent = setPauseMarker(ctxFactory(), { type: 'collection', uid: 'col-x', marker: 'paused' });
    await oracle.apply(intent.batch, []);
    expect(calls).toBeGreaterThan(0);
    expect(cache.getSnapshot().markers).toEqual({ 'col-x': 'paused' });
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createPauseMarkersCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedPauseMarkers({ markers: {}, entries: [] });

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });
    cache.dispose();

    const intent = setPauseMarker(ctxFactory(), { type: 'collection', uid: 'col-x', marker: 'paused' });
    await oracle.apply(intent.batch, []);
    expect(calls).toBe(0);
  });
});
