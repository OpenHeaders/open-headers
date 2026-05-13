/**
 * Phase B Template-folder — cache subscribes to broadcast, re-projects
 * via parent-walk, persists. Mirrors request-folder-cache contract.
 */

import {
  createTemplateFolder,
  renameTemplateFolder,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { createTemplateFolderCache } from '@/background/sync/template-folder-cache';
import { seedTemplateCollection } from '@/shared/sync/template-collection-projection';
import {
  projectTemplateFolderByUid,
  projectTemplateFolderPostState,
} from '@/background/sync/template-folder-post-state';
import type { PersistedLocalFolder } from '@openheaders/oracle/storage';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeCollection = (uid: string): Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: `tcol-${uid}`,
    path: `templates/${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as Collection;

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

describe('TemplateFolderCache', () => {
  it('seeds folders into oracle and projects them with reconstructed paths', async () => {
    const coll = makeCollection('col-1');
    await oracle.apply(seedTemplateCollection(coll, ctxFactory()), []);

    const cache = createTemplateFolderCache('ws-1', oracle, broadcast, ctxFactory);
    const persisted: PersistedLocalFolder[] = [
      { schemaVersion: 5, uid: 'f-1', path: `${coll.path}/login-f-1`, name: 'Login' },
    ];
    await cache.seedFromPersistedTemplateFolders(persisted, [coll]);
    const folders = cache.getTemplateFolders();
    expect(folders.map((f) => f.uid)).toEqual(['f-1']);
    expect(folders[0].path).toBe(`${coll.path}/login-f-1`);
    cache.dispose();
  });

  it('updates the cache when a folder is renamed via the catalog', async () => {
    const coll = makeCollection('col-2');
    await oracle.apply(seedTemplateCollection(coll, ctxFactory()), []);
    const cache = createTemplateFolderCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplateFolders(
      [{ schemaVersion: 5, uid: 'f-r', path: `${coll.path}/old-f-r`, name: 'Old' }],
      [coll],
    );
    await oracle.apply(
      renameTemplateFolder(ctxFactory(), { folderUid: 'f-r', name: 'New name' }).batch,
      [],
    );
    const folders = cache.getTemplateFolders();
    expect(folders[0].name).toBe('New name');
    expect(folders[0].path).toBe(`${coll.path}/old-f-r`);
    cache.dispose();
  });

  it('updates when a folder is created via the catalog', async () => {
    const coll = makeCollection('col-3');
    await oracle.apply(seedTemplateCollection(coll, ctxFactory()), []);
    const cache = createTemplateFolderCache('ws-1', oracle, broadcast, ctxFactory);
    expect(cache.getTemplateFolders()).toEqual([]);

    const intent = createTemplateFolder(ctxFactory(), {
      folderUid: 'f-new',
      parent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: coll.uid },
      name: 'Fresh',
    });
    await oracle.apply(intent.batch, []);
    expect(cache.getTemplateFolders().map((f) => f.uid)).toEqual(['f-new']);
    cache.dispose();
  });

  it('refreshes on parent-slot envelopes (nested folders)', async () => {
    const coll = makeCollection('col-4');
    await oracle.apply(seedTemplateCollection(coll, ctxFactory()), []);
    const cache = createTemplateFolderCache('ws-1', oracle, broadcast, ctxFactory);

    await oracle.apply(
      createTemplateFolder(ctxFactory(), {
        folderUid: 'r',
        parent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'Root',
      }).batch,
      [],
    );
    await oracle.apply(
      createTemplateFolder(ctxFactory(), {
        folderUid: 'l',
        parent: { type: TEMPLATE_FOLDER_ENTITY_TYPE, uid: 'r' },
        name: 'Leaf',
      }).batch,
      [],
    );

    const folders = cache.getTemplateFolders();
    const byUid = new Map(folders.map((f) => [f.uid, f]));
    expect(byUid.get('r')?.path).toBe(`${coll.path}/root-r`);
    expect(byUid.get('l')?.path).toBe(`${coll.path}/root-r/leaf-l`);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const coll = makeCollection('col-5');
    await oracle.apply(seedTemplateCollection(coll, ctxFactory()), []);
    const cache = createTemplateFolderCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplateFolders(
      [{ schemaVersion: 5, uid: 'f-d', path: `${coll.path}/x-f-d`, name: 'X' }],
      [coll],
    );
    cache.dispose();
    await oracle.apply(
      renameTemplateFolder(ctxFactory(), { folderUid: 'f-d', name: 'Renamed' }).batch,
      [],
    );
    expect(cache.getTemplateFolders()[0].name).toBe('X');
  });
});

describe('projectTemplateFolderPostState', () => {
  it('returns post-state with reconstructed path', async () => {
    const coll = makeCollection('col-p');
    await oracle.apply(seedTemplateCollection(coll, ctxFactory()), []);
    const intent = createTemplateFolder(ctxFactory(), {
      folderUid: 'fp',
      parent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: coll.uid },
      name: 'P',
    });
    await oracle.apply(intent.batch, []);
    const env = intent.batch.mutations[0]; // create envelope
    const post = projectTemplateFolderPostState(oracle, env);
    expect(post?.folder.path).toBe(`${coll.path}/p-fp`);
  });

  it('returns null for non-template-folder envelopes', () => {
    const env = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: 'ws-1',
      mutatorVersion: 1,
      body: { kind: 'setField', type: 'rule', id: 'r', path: 'name', value: 'x' },
    } as const;
    expect(
      projectTemplateFolderPostState(oracle, env as Parameters<typeof projectTemplateFolderPostState>[1]),
    ).toBeNull();
  });

  it('returns null for unknown id', () => {
    expect(projectTemplateFolderByUid(oracle, 'nope')).toBeNull();
  });
});
