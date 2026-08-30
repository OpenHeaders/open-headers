/**
 * `treeDescendants` — what a container cascade takes with it, read
 * off the parent-owned sets: every leaf kind the `items` slots name,
 * nested folders deepest-first, a slot-less leaf under the container
 * its stored path names, and the S13 claim rule (a child in two live
 * slots counts under the one its projected path names).
 */

import {
  createRequestFolder,
  GRPC_REQUEST_ENTITY_TYPE,
  grpcRequestChild,
  MQTT_REQUEST_ENTITY_TYPE,
  mintBatch,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { seedGrpcRequest } from '@openheaders/core/sync-builders/projections/grpc-request-projection';
import { seedMqttRequest } from '@openheaders/core/sync-builders/projections/mqtt-request-projection';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import { seedWebSocketRequest } from '@openheaders/core/sync-builders/projections/websocket-request-projection';
import type { Collection, GrpcRequest, MqttRequest, Request, WebSocketRequest } from '@openheaders/core/types';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { buildSchemaRegistry, WORKSPACE_REGISTRY } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { REQUEST_TREE } from '@openheaders/oracle/sync/post-state/request-folder-post-state';
import { treeDescendants } from '@openheaders/oracle/sync/tree-child-slots';
import { beforeEach, describe, expect, it } from 'vitest';

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

const collection = (uid: string): Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: uid,
    path: `requests/api-${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as Collection;
const http = (uid: string, parentPath: string): Request =>
  ({
    schemaVersion: 5,
    uid,
    path: `${parentPath}/get-${uid}`,
    name: uid,
    method: 'GET',
    url: '',
    headers: [],
    params: [],
  }) as unknown as Request;
const grpc = (uid: string, parentPath: string): GrpcRequest =>
  ({ schemaVersion: 5, uid, path: `${parentPath}/call-${uid}`, name: uid, metadata: [] }) as unknown as GrpcRequest;
const ws = (uid: string, parentPath: string): WebSocketRequest =>
  ({
    schemaVersion: 5,
    uid,
    path: `${parentPath}/socket-${uid}`,
    name: uid,
    headers: [],
    params: [],
  }) as unknown as WebSocketRequest;
const mqtt = (uid: string, parentPath: string): MqttRequest =>
  ({
    schemaVersion: 5,
    uid,
    path: `${parentPath}/topic-${uid}`,
    name: uid,
    topics: [],
    savedMessages: [],
    userProperties: [],
  }) as unknown as MqttRequest;

const colA = collection('col0000a');
const colB = collection('col0000b');
const A = { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: colA.uid } as const;
const B = { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: colB.uid } as const;
const F = { type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'fol0000f' } as const;
const G = { type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'fol0000g' } as const;
const F_PATH = `${colA.path}/f-fol0000f`;
const G_PATH = `${F_PATH}/g-fol0000g`;

let oracle: EntityOracle;

beforeEach(async () => {
  hlcCounter = 0;
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
  });
  for (const coll of [colA, colB]) await oracle.apply(seedRequestCollection(coll, ctxFactory()), [], 'inbound');
  await oracle.apply(
    createRequestFolder(ctxFactory(), { folderUid: F.uid, parent: A, name: 'F', pathSegment: 'f-fol0000f' }).batch,
    [],
    'inbound',
  );
  await oracle.apply(
    createRequestFolder(ctxFactory(), { folderUid: G.uid, parent: F, name: 'G', pathSegment: 'g-fol0000g' }).batch,
    [],
    'inbound',
  );
});

const sortedLeaves = (leaves: ReadonlyArray<{ type: string; uid: string }>) =>
  [...leaves].sort((a, b) => a.uid.localeCompare(b.uid));

describe('treeDescendants', () => {
  it('takes every request kind under the container, nested folders deepest-first, and a slot-less leaf by its stored path', async () => {
    await oracle.apply(seedRequest(http('req00001', colA.path), ctxFactory(), { parent: A }), [], 'inbound');
    await oracle.apply(seedGrpcRequest(grpc('grq00001', F_PATH), ctxFactory(), { parent: F }), [], 'inbound');
    await oracle.apply(seedWebSocketRequest(ws('wsr00001', G_PATH), ctxFactory(), { parent: G }), [], 'inbound');
    // An old-client create: stored path under F, no slot yet.
    await oracle.apply(seedMqttRequest(mqtt('mqr00001', F_PATH), ctxFactory()), [], 'inbound');
    // Another collection's leaf is nobody's business here.
    await oracle.apply(seedRequest(http('req00002', colB.path), ctxFactory(), { parent: B }), [], 'inbound');

    const under = treeDescendants(oracle, REQUEST_TREE, A);
    expect(under.folders).toEqual([G.uid, F.uid]);
    expect(sortedLeaves(under.leaves)).toEqual([
      { type: GRPC_REQUEST_ENTITY_TYPE, uid: 'grq00001' },
      { type: MQTT_REQUEST_ENTITY_TYPE, uid: 'mqr00001' },
      { type: REQUEST_ENTITY_TYPE, uid: 'req00001' },
      { type: WEBSOCKET_REQUEST_ENTITY_TYPE, uid: 'wsr00001' },
    ]);

    const underF = treeDescendants(oracle, REQUEST_TREE, F);
    expect(underF.folders).toEqual([G.uid]);
    expect(sortedLeaves(underF.leaves).map((leaf) => leaf.uid)).toEqual(['grq00001', 'mqr00001', 'wsr00001']);
  });

  it('follows the slots, not a stale path: a leaf dragged out is spared, one dragged in is taken', async () => {
    await oracle.apply(seedGrpcRequest(grpc('grq00001', colA.path), ctxFactory(), { parent: A }), [], 'inbound');
    await oracle.apply(seedGrpcRequest(grpc('grq00002', colB.path), ctxFactory(), { parent: B }), [], 'inbound');
    // grq00001 moves A → B; grq00002 moves B → A. Neither stored path changes.
    await oracle.apply(
      mintBatch(ctxFactory(), [
        grpcRequestChild.slotRemove('grq00001', A),
        grpcRequestChild.slotAdd('grq00001', B, 'z'),
      ]),
      [],
      'inbound',
    );
    await oracle.apply(
      mintBatch(ctxFactory(), [
        grpcRequestChild.slotRemove('grq00002', B),
        grpcRequestChild.slotAdd('grq00002', A, 'z'),
      ]),
      [],
      'inbound',
    );
    expect(treeDescendants(oracle, REQUEST_TREE, A).leaves).toEqual([
      { type: GRPC_REQUEST_ENTITY_TYPE, uid: 'grq00002' },
    ]);
    expect(treeDescendants(oracle, REQUEST_TREE, B).leaves).toEqual([
      { type: GRPC_REQUEST_ENTITY_TYPE, uid: 'grq00001' },
    ]);
  });

  it('counts a child in two live slots under the one its projected path names', async () => {
    await oracle.apply(seedGrpcRequest(grpc('grq00001', colB.path), ctxFactory(), { parent: B }), [], 'inbound');
    // A peer's concurrent move: a second, later slot under A (the higher add-HLC wins the projection).
    await oracle.apply(mintBatch(ctxFactory(), [grpcRequestChild.slotAdd('grq00001', A, 'z')]), [], 'inbound');
    expect(treeDescendants(oracle, REQUEST_TREE, A).leaves.map((leaf) => leaf.uid)).toEqual(['grq00001']);
    expect(treeDescendants(oracle, REQUEST_TREE, B).leaves).toEqual([]);
  });

  it('is empty for a container the tree does not know', () => {
    expect(treeDescendants(oracle, REQUEST_TREE, { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'col0000x' })).toEqual({
      folders: [],
      leaves: [],
    });
  });
});
