/**
 * Phase B — collection cache subscribes to broadcast, re-projects to
 * V5.Collection[], persists to chrome.storage.local. Mirrors
 * environment-cache.test.ts.
 */

import { setCollectionVar } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { createCollectionCache } from '@/background/sync/collection-cache';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeCollection = (uid: string): V5.Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: `coll-${uid}`,
    path: `rules/${uid}`,
    variables: [{ name: 'A', value: '1', type: 'default' }],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    version: 1,
  }) as unknown as V5.Collection;

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

afterEach(() => {
  // No global state to reset.
});

describe('CollectionCache', () => {
  it('seeds the oracle from persisted collections and projects them back', async () => {
    const cache = createCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedCollections([makeCollection('a'), makeCollection('b')]);
    const colls = cache.getCollections();
    expect(colls.map((c) => c.uid).sort()).toEqual(['a', 'b']);
    expect(colls[0].variables[0].name).toBe('A');
    cache.dispose();
  });

  it('updates the cache when a new var is set via the catalog', async () => {
    const cache = createCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedCollections([makeCollection('a')]);
    const intent = setCollectionVar(ctxFactory(), { collectionUid: 'a', name: 'B', value: '2' });
    await oracle.apply(intent.batch, []);
    const colls = cache.getCollections();
    expect(colls[0].variables.map((v) => v.name).sort()).toEqual(['A', 'B']);
    cache.dispose();
  });

  it('ignores Rule envelopes — collection state stays empty when rules are committed', async () => {
    const cache = createCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    let listenerFires = 0;
    cache.onChange(() => {
      listenerFires += 1;
    });
    broadcast.publish({
      envelope: {
        mutationId: 'r1',
        hlc: { physicalMs: 1, logical: 0, nodeId: 'n0' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: 'ws-1',
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'rule', id: 'rule-x', path: 'name', value: 'x' },
      },
      outcome: { status: 'applied' },
    });
    expect(listenerFires).toBe(0);
    expect(cache.getCollections()).toEqual([]);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createCollectionCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedCollections([makeCollection('a')]);
    cache.dispose();
    const intent = setCollectionVar(ctxFactory(), { collectionUid: 'a', name: 'B', value: '2' });
    await oracle.apply(intent.batch, []);
    expect(cache.getCollections()[0].variables.map((v) => v.name)).toEqual(['A']);
  });
});
