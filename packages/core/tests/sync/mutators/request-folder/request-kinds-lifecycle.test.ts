/**
 * The four request kinds share one `items` set on their parent; each
 * kind's slot names the catalog that owns the leaf so a reader never
 * probes four stores. One suite pins the three kinds without a
 * catalog-local suite (gRPC / WebSocket / MQTT).
 */

import { describe, expect, it } from 'vitest';
import {
  createGrpcRequest,
  createMqttRequest,
  createWebSocketRequest,
  deleteGrpcRequest,
  deleteMqttRequest,
  deleteWebSocketRequest,
  GRPC_REQUEST_ENTITY_TYPE,
  GRPC_REQUEST_MUTATOR_VERSION,
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_MUTATOR_VERSION,
  type MutatorContext,
  moveGrpcRequest,
  moveMqttRequest,
  moveWebSocketRequest,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_MUTATOR_VERSION,
} from '../../../../src/sync';

const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const collection = { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'col-1' } as const;
const folder = { type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'fold-1' } as const;

const kinds = [
  {
    label: 'gRPC',
    entityType: GRPC_REQUEST_ENTITY_TYPE,
    version: GRPC_REQUEST_MUTATOR_VERSION,
    create: () =>
      createGrpcRequest(ctx(), {
        grpcRequestUid: 'q-1',
        parent: collection,
        payload: { name: 'Echo' },
        orderKey: 'mm',
      }),
    remove: () => deleteGrpcRequest(ctx(), { grpcRequestUid: 'q-1', parent: folder }),
    move: () =>
      moveGrpcRequest(ctx(), { grpcRequestUid: 'q-1', oldParent: collection, newParent: folder, orderKey: 'k' }),
  },
  {
    label: 'WebSocket',
    entityType: WEBSOCKET_REQUEST_ENTITY_TYPE,
    version: WEBSOCKET_REQUEST_MUTATOR_VERSION,
    create: () =>
      createWebSocketRequest(ctx(), {
        webSocketRequestUid: 'q-1',
        parent: collection,
        payload: { name: 'Echo' },
        orderKey: 'mm',
      }),
    remove: () => deleteWebSocketRequest(ctx(), { webSocketRequestUid: 'q-1', parent: folder }),
    move: () =>
      moveWebSocketRequest(ctx(), {
        webSocketRequestUid: 'q-1',
        oldParent: collection,
        newParent: folder,
        orderKey: 'k',
      }),
  },
  {
    label: 'MQTT',
    entityType: MQTT_REQUEST_ENTITY_TYPE,
    version: MQTT_REQUEST_MUTATOR_VERSION,
    create: () =>
      createMqttRequest(ctx(), {
        mqttRequestUid: 'q-1',
        parent: collection,
        payload: { name: 'Echo' },
        orderKey: 'mm',
      }),
    remove: () => deleteMqttRequest(ctx(), { mqttRequestUid: 'q-1', parent: folder }),
    move: () =>
      moveMqttRequest(ctx(), { mqttRequestUid: 'q-1', oldParent: collection, newParent: folder, orderKey: 'k' }),
  },
];

describe.each(kinds)('$label request lifecycle', ({ entityType, version, create, remove, move }) => {
  it('create mints the entity + the items slot tagged with its own kind', () => {
    const intent = create();
    expect(intent.batch.mutations.map((m) => m.mutatorVersion)).toEqual([version, version]);
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'create', type: entityType, id: 'q-1', payload: { name: 'Echo' } },
      {
        kind: 'addToSet',
        type: REQUEST_COLLECTION_ENTITY_TYPE,
        id: 'col-1',
        path: REQUEST_FOLDER_ITEMS_PATH,
        itemId: 'q-1',
        item: { uid: 'q-1', type: entityType },
        orderKey: 'mm',
      },
    ]);
  });

  it('delete tombstones the slot on the parent folder then the entity', () => {
    expect(remove().batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'removeFromSet',
        type: REQUEST_FOLDER_ENTITY_TYPE,
        id: 'fold-1',
        path: REQUEST_FOLDER_ITEMS_PATH,
        itemId: 'q-1',
      },
      { kind: 'delete', type: entityType, id: 'q-1' },
    ]);
  });

  it('reparent is remove-from-old + add-to-new carrying the kind tag', () => {
    const [removeBody, addBody] = move().batch.mutations.map((m) => m.body);
    expect(removeBody).toMatchObject({ kind: 'removeFromSet', type: REQUEST_COLLECTION_ENTITY_TYPE, id: 'col-1' });
    expect(addBody).toMatchObject({
      kind: 'addToSet',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'fold-1',
      path: REQUEST_FOLDER_ITEMS_PATH,
      item: { uid: 'q-1', type: entityType },
      orderKey: 'k',
    });
  });
});
