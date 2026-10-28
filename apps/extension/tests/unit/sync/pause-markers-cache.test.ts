/**
 * Phase B — pause-markers cache subscribes to broadcast, re-projects
 * to the persisted record shape, and persists to chrome.storage.local
 * via `extensionStorage` (mocked in the in-memory broadcast bus
 * fixture). Slice 4: the record is keyed by container uid; a version-1
 * (path-keyed) record at rest seeds and migrates on read.
 *
 * The boot pass over a replayed log (the workspace-list scope epic,
 * slice 11): a live version-1 member is retired when a version-2 add or
 * tombstone of its container is the later statement, re-keyed by uid
 * when it is the container's latest word, retired when no container
 * answers to it; the batch is logged once and a later boot mints
 * nothing.
 */

import {
  COLLECTION_ENTITY_TYPE,
  clearPauseMarker,
  type MutationEnvelope,
  type MutatorContext,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  setPauseMarker,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedPauseMarkers } from '@openheaders/core/sync-builders/projections/pause-markers-projection';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { createPauseMarkersCache } from '@openheaders/oracle/sync/caches/pause-markers-cache';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { beforeEach, describe, expect, it } from 'vitest';
import { installBackingStorage, installHostStorage } from '../../helpers/chrome-storage-backing';

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
    await oracle.apply(intent.batch);
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
    await oracle.apply(intent.batch);
    expect(calls).toBe(0);
  });
});

describe('PauseMarkersCache boot pass: the version-1 member migration over a replayed log', () => {
  const FLD = 'rules/api-col00001/login-fld00001';
  const at = (ms: number): MutatorContext => ({
    workspaceId: 'ws-1',
    hlc: { physicalMs: ms, logical: 0, nodeId: 'history' },
    surfaceId: 'sw',
    deviceId: 'history',
  });
  /** A version-1 member as 2026.8.x minted it and the first 9.0 boot re-minted it: the create plus one path-keyed add. */
  const legacyPause = (ms: number, path: string, marker: 'paused' | 'unpaused' = 'paused'): MutationEnvelope[] =>
    seedPauseMarkers({ [path]: marker }, at(ms)).mutations;
  const uidPause = (ms: number): MutationEnvelope[] =>
    setPauseMarker(at(ms), { type: 'folder', uid: 'fld00001', marker: 'paused', path: FLD }).batch.mutations;
  const uidClear = (ms: number): MutationEnvelope[] => clearPauseMarker(at(ms), { uid: 'fld00001' }).batch.mutations;

  let log: InMemoryMutationLog;

  async function rowCount(): Promise<number> {
    let rows = 0;
    for await (const _ of log.readAll()) rows += 1;
    return rows;
  }

  /** A process boot: a fresh oracle replays the log, then the cache's boot pass runs. */
  async function boot() {
    const bus = new InMemoryBroadcast();
    const replayed = new EntityOracle({
      workspaceId: 'ws-1',
      lock,
      log,
      intents: new InMemoryPendingIntents(),
      broadcast: bus,
    });
    await replayed.hydrate(log.readAll());
    const cache = createPauseMarkersCache('ws-1', replayed, bus, ctxFactory);
    await cache.hydrateFromStorage();
    return { oracle: replayed, cache };
  }

  const liveKeys = (o: EntityOracle): string[] =>
    o.liveSetItems(PAUSE_MARKERS_ENTITY_TYPE, PAUSE_MARKERS_ID, PAUSE_MARKERS_PATH).map((e) => e.itemId);

  beforeEach(async () => {
    installBackingStorage();
    await installHostStorage();
    log = new InMemoryMutationLog();
  });

  it('unpauses a folder paused on 8.x and cleared under version 2, once; the next boot appends nothing', async () => {
    // t1 the 8.x pause; t2 the first 9.0 boot's path-keyed re-mint; t3 the
    // uid-keyed re-mint; t4 the user's clear. The uid member is tombstoned,
    // the path member is live, and the fold alone would show F paused.
    await log.appendAll([...legacyPause(1, FLD), ...legacyPause(2, FLD), ...uidPause(3), ...uidClear(4)]);
    const before = await rowCount();

    const first = await boot();

    expect(first.cache.getSnapshot()).toEqual({ markers: {}, entries: [] });
    expect(liveKeys(first.oracle)).toEqual([]);
    expect(await rowCount()).toBe(before + 1);

    const second = await boot();
    expect(second.cache.getSnapshot()).toEqual({ markers: {}, entries: [] });
    expect(await rowCount()).toBe(before + 1);
  });

  it('re-keys a folder paused on 8.x that version 2 never spoke about (the direct upgrade), keeping it paused', async () => {
    await log.appendAll(legacyPause(1, FLD));
    const before = await rowCount();

    const first = await boot();

    expect(first.cache.getSnapshot()).toEqual({
      markers: { fld00001: 'paused' },
      entries: [{ type: 'folder', uid: 'fld00001', marker: 'paused', path: FLD }],
    });
    expect(liveKeys(first.oracle)).toEqual(['fld00001']);
    expect(await rowCount()).toBe(before + 2);

    const second = await boot();
    expect(second.cache.getSnapshot().markers).toEqual({ fld00001: 'paused' });
    expect(await rowCount()).toBe(before + 2);
  });

  it('retires the path member of a folder whose uid member carries the pause itself (never cleared)', async () => {
    await log.appendAll([...legacyPause(1, FLD), ...legacyPause(2, FLD), ...uidPause(3)]);
    const before = await rowCount();

    const { oracle: replayed, cache } = await boot();

    expect(cache.getSnapshot().markers).toEqual({ fld00001: 'paused' });
    expect(liveKeys(replayed)).toEqual(['fld00001']);
    expect(await rowCount()).toBe(before + 1);
  });

  it('honours a path member an old peer wrote after the version-2 clear: re-keyed, the later word wins', async () => {
    await log.appendAll([...uidPause(3), ...uidClear(4), ...legacyPause(7, FLD, 'unpaused')]);
    const before = await rowCount();

    const { oracle: replayed, cache } = await boot();

    expect(cache.getSnapshot().markers).toEqual({ fld00001: 'unpaused' });
    expect(liveKeys(replayed)).toEqual(['fld00001']);
    expect(await rowCount()).toBe(before + 2);
  });

  it('retires a path member no container answers to', async () => {
    await log.appendAll(legacyPause(1, 'requests/not-a-rules-tree'));
    const before = await rowCount();

    const { oracle: replayed, cache } = await boot();

    expect(cache.getSnapshot()).toEqual({ markers: {}, entries: [] });
    expect(liveKeys(replayed)).toEqual([]);
    expect(await rowCount()).toBe(before + 1);
  });

  it('mints nothing over a log of version-2 members only', async () => {
    await log.appendAll([...seedPauseMarkers({ markers: {}, entries: [] }, at(1)).mutations, ...uidPause(3)]);
    const before = await rowCount();

    const { cache } = await boot();

    expect(cache.getSnapshot().markers).toEqual({ fld00001: 'paused' });
    expect(await rowCount()).toBe(before);
  });
});
