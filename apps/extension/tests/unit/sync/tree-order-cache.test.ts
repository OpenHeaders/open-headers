/**
 * Tree-order cache — every container's children of the three trees —
 * `folders` and `items` MERGED by key — fold into one persisted
 * record; the cache stays quiet until its hydrate (the re-seed reads
 * the record first) and then follows every containment write; ranks
 * read back per child, a legacy entry ranking folders before items.
 */

import { hostStorage } from '@openheaders/core/storage';
import {
  COLLECTION_ENTITY_TYPE,
  createFolder,
  createRule,
  deleteFolder,
  FOLDER_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedGrpcRequest } from '@openheaders/core/sync-builders/projections/grpc-request-projection';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import type { Collection, GrpcRequest, Request } from '@openheaders/core/types';
import { wsKeys } from '@openheaders/oracle/storage';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import {
  createTreeOrderCache,
  loadTreeOrderRanks,
  projectTreeOrder,
  treeOrderRanks,
} from '@openheaders/oracle/sync/caches/tree-order-cache';
import { buildSchemaRegistry, WORKSPACE_REGISTRY } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { beforeEach, describe, expect, it } from 'vitest';
import { installBackingStorage } from '../../helpers/chrome-storage-backing';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

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

const makeCollection = (uid: string, tree: 'rules' | 'requests'): Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: uid,
    path: `${tree}/api-${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as Collection;

const http = (uid: string, parent: string): Request =>
  ({
    schemaVersion: 5,
    uid,
    path: `${parent}/get-${uid}`,
    name: uid,
    method: 'GET',
    url: '',
    headers: [],
    params: [],
  }) as unknown as Request;
const grpc = (uid: string, parent: string): GrpcRequest =>
  ({ schemaVersion: 5, uid, path: `${parent}/call-${uid}`, name: uid, metadata: [] }) as unknown as GrpcRequest;

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  installBackingStorage();
  hlcCounter = 0;
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
  });
});

describe('tree-order cache', () => {
  it('folds every container of every tree as one merged order and skips empty containers', async () => {
    const rules = makeCollection('col00001', 'rules');
    const requests = makeCollection('col00002', 'requests');
    await oracle.apply(seedCollection(rules, ctxFactory()), [], 'inbound');
    await oracle.apply(seedRequestCollection(requests, ctxFactory()), [], 'inbound');
    const ruleParent = { type: COLLECTION_ENTITY_TYPE, uid: rules.uid } as const;
    // The folder is keyed AFTER the rule: the record lists the rule first.
    await oracle.apply(
      createFolder(ctxFactory(), { folderUid: 'fol00001', parent: ruleParent, name: 'Sub', orderKey: 's' }).batch,
      [],
    );
    await oracle.apply(
      createRule(ctxFactory(), { ruleUid: 'rul00001', parent: ruleParent, payload: { name: 'r' }, orderKey: 'm' })
        .batch,
      [],
    );
    const requestParent = { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: requests.uid } as const;
    await oracle.apply(
      seedGrpcRequest(grpc('grq00001', requests.path), ctxFactory(), { parent: requestParent, orderKey: 'a' }),
      [],
    );
    await oracle.apply(
      seedRequest(http('req00001', requests.path), ctxFactory(), { parent: requestParent, orderKey: 'b' }),
      [],
    );

    const record = projectTreeOrder(oracle);
    expect(record.containers).toEqual({
      'collection:col00001': { children: ['rul00001', 'fol00001'] },
      'request-collection:col00002': { children: ['grq00001', 'req00001'] },
    });
    expect(Object.fromEntries(treeOrderRanks(record))).toEqual({ rul00001: 0, fol00001: 1, grq00001: 0, req00001: 1 });
  });

  it('ranks a legacy entry folders first, then items', () => {
    const ranks = treeOrderRanks({
      schemaVersion: 5,
      containers: { 'collection:col00001': { folders: ['fol00001'], items: ['rul00001', 'rul00002'] } },
    });
    expect(Object.fromEntries(ranks)).toEqual({ fol00001: 0, rul00001: 1, rul00002: 2 });
  });

  it('stays quiet until hydrate, then persists on every containment write and drops a deleted container', async () => {
    const rules = makeCollection('col00001', 'rules');
    await oracle.apply(seedCollection(rules, ctxFactory()), [], 'inbound');
    const cache = createTreeOrderCache('ws-1', oracle, broadcast);
    const parent = { type: COLLECTION_ENTITY_TYPE, uid: rules.uid } as const;
    await oracle.apply(createFolder(ctxFactory(), { folderUid: 'fol00001', parent, name: 'A' }).batch, []);
    expect(await hostStorage.get(wsKeys('ws-1').treeOrder)).toBeUndefined();

    await cache.hydrateFromStorage();
    expect(cache.getTreeOrder().containers).toEqual({ 'collection:col00001': { children: ['fol00001'] } });
    await oracle.apply(
      createFolder(ctxFactory(), { folderUid: 'fol00002', parent, name: 'B', orderKey: 's' }).batch,
      [],
    );
    expect((await hostStorage.get(wsKeys('ws-1').treeOrder))?.containers).toEqual({
      'collection:col00001': { children: ['fol00001', 'fol00002'] },
    });
    await oracle.apply(
      createFolder(ctxFactory(), {
        folderUid: 'fol00003',
        parent: { type: FOLDER_ENTITY_TYPE, uid: 'fol00002' },
        name: 'C',
      }).batch,
      [],
    );
    expect(cache.getTreeOrder().containers['folder:fol00002']).toEqual({ children: ['fol00003'] });
    await oracle.apply(deleteFolder(ctxFactory(), { folderUid: 'fol00002', parent }).batch, []);
    expect(cache.getTreeOrder().containers).toEqual({ 'collection:col00001': { children: ['fol00001'] } });
    expect(Object.fromEntries(await loadTreeOrderRanks('ws-1'))).toEqual({ fol00001: 0 });
    cache.dispose();
  });

  it('reads no ranks when nothing is persisted or the record fails the schema', async () => {
    expect((await loadTreeOrderRanks('ws-1')).size).toBe(0);
    await hostStorage.set(wsKeys('ws-1').treeOrder, {
      schemaVersion: 5,
      containers: { x: { folders: 'no' } },
    } as never);
    expect((await loadTreeOrderRanks('ws-1')).size).toBe(0);
  });
});
