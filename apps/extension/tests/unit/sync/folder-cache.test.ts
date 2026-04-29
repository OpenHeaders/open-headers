/**
 * Phase B Folder — folder cache subscribes to broadcast, re-projects
 * via parent-walk, persists to chrome.storage.local. Mirrors
 * collection-cache.test.ts.
 */

import {
  COLLECTION_ENTITY_TYPE,
  createFolder,
  FOLDER_ENTITY_TYPE,
  renameFolder,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { createFolderCache } from '@/background/sync/folder-cache';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { seedCollection } from '@/shared/sync/collection-projection';
import type { PersistedLocalFolder } from '@/shared/storage';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeCollection = (uid: string): V5.Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: `coll-${uid}`,
    path: `rules/${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as V5.Collection;

let hlcCounter = 0;
const ctxFactory = () => {
  hlcCounter += 1;
  return {
    workspaceId: 'ws-1',
    hlc: { physicalMs: 1_000 + hlcCounter, logical: 0, nodeId: 'n0' },
    surfaceId: 's',
    deviceId: 'd',
  };
};

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  hlcCounter = 0;
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

describe('FolderCache', () => {
  it('seeds folders into oracle and projects them with reconstructed paths', async () => {
    const coll = makeCollection('col-1');
    await oracle.apply(seedCollection(coll, ctxFactory()), []);

    const cache = createFolderCache('ws-1', oracle, broadcast, ctxFactory);
    const persisted: PersistedLocalFolder[] = [
      { schemaVersion: 5, uid: 'f-1', path: `${coll.path}/login-f-1`, name: 'Login' },
    ];
    await cache.seedFromPersistedFolders(persisted, [coll]);
    const folders = cache.getFolders();
    expect(folders.map((f) => f.uid)).toEqual(['f-1']);
    expect(folders[0].path).toBe(`${coll.path}/login-f-1`);
    cache.dispose();
  });

  it('updates the cache when a folder is renamed via the catalog', async () => {
    const coll = makeCollection('col-2');
    await oracle.apply(seedCollection(coll, ctxFactory()), []);
    const cache = createFolderCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedFolders(
      [{ schemaVersion: 5, uid: 'f-r', path: `${coll.path}/old-f-r`, name: 'Old' }],
      [coll],
    );

    const intent = renameFolder(ctxFactory(), { folderUid: 'f-r', name: 'New name' });
    await oracle.apply(intent.batch, []);
    const folders = cache.getFolders();
    expect(folders[0].name).toBe('New name');
    // Path stays stable across rename — legacy invariant via persisted pathSegment.
    expect(folders[0].path).toBe(`${coll.path}/old-f-r`);
    cache.dispose();
  });

  it('updates when a folder is created via the catalog (parent slot landed)', async () => {
    const coll = makeCollection('col-3');
    await oracle.apply(seedCollection(coll, ctxFactory()), []);
    const cache = createFolderCache('ws-1', oracle, broadcast, ctxFactory);
    expect(cache.getFolders()).toEqual([]);

    const intent = createFolder(ctxFactory(), {
      folderUid: 'f-new',
      parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
      name: 'Fresh',
    });
    await oracle.apply(intent.batch, []);
    expect(cache.getFolders().map((f) => f.uid)).toEqual(['f-new']);
    cache.dispose();
  });

  it('refreshes on parent-slot envelopes (nested folders)', async () => {
    const coll = makeCollection('col-4');
    await oracle.apply(seedCollection(coll, ctxFactory()), []);
    const cache = createFolderCache('ws-1', oracle, broadcast, ctxFactory);

    const root = createFolder(ctxFactory(), {
      folderUid: 'r',
      parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
      name: 'Root',
    });
    await oracle.apply(root.batch, []);
    const leaf = createFolder(ctxFactory(), {
      folderUid: 'l',
      parent: { type: FOLDER_ENTITY_TYPE, uid: 'r' },
      name: 'Leaf',
    });
    await oracle.apply(leaf.batch, []);

    const folders = cache.getFolders();
    const byUid = new Map(folders.map((f) => [f.uid, f]));
    expect(byUid.get('r')?.path).toBe(`${coll.path}/root-r`);
    expect(byUid.get('l')?.path).toBe(`${coll.path}/root-r/leaf-l`);
    cache.dispose();
  });

  it('ignores rule envelopes', () => {
    const cache = createFolderCache('ws-1', oracle, broadcast, ctxFactory);
    let fires = 0;
    cache.onChange(() => {
      fires += 1;
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
    expect(fires).toBe(0);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const coll = makeCollection('col-5');
    await oracle.apply(seedCollection(coll, ctxFactory()), []);
    const cache = createFolderCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedFolders(
      [{ schemaVersion: 5, uid: 'f-d', path: `${coll.path}/x-f-d`, name: 'X' }],
      [coll],
    );
    cache.dispose();

    const intent = renameFolder(ctxFactory(), { folderUid: 'f-d', name: 'Renamed' });
    await oracle.apply(intent.batch, []);
    expect(cache.getFolders()[0].name).toBe('X');
  });
});
