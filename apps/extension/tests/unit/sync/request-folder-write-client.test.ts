/**
 * Renderer-side write client for RequestFolder mutations.
 *
 * Mirrors `folder-write-client.test.ts` against the request-side
 * entity type. We verify:
 *   - create emits a `create` envelope on the request-folder entity
 *     plus an `addToSet` on the parent's `folders` slot (parent can be
 *     a request-collection or a request-folder)
 *   - rename returns `not-found` when the mirror has no entry; success
 *     emits one setField at path="name"
 *   - delete short-circuits to `not-found` when the mirror has no
 *     entry; the cascade walks the folder's own sets — every request
 *     kind, nested folders deepest-first, the folder last
 *   - move emits `moveBefore` for an intra-parent move, and a
 *     `removeFromSet`+`addToSet` pair for a cross-parent move
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  GRPC_REQUEST_ENTITY_TYPE,
  initialHlc,
  MQTT_REQUEST_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
} from '@openheaders/core/sync';
import type { Folder } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: vi.fn(() => () => undefined),
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { RendererContextHandle, RequestFolderSyncMirror } from '@openheaders/ui/context';
import {
  applyRequestFolderCreate,
  applyRequestFolderDelete,
  applyRequestFolderMove,
  applyRequestFolderRename,
  applyRequestFolderSetSettings,
} from '@openheaders/ui/shared/sync/request-folder-write-client';
import {
  lastBodiesSeen,
  makeRequestCollectionMirror,
  makeRequestExampleMirrors,
  makeRequestFolderMirror,
  makeRequestLeafMirrors,
  type Slots,
} from '../../helpers/request-tree-mirrors';

function makeFolder(uid: string, path: string, name = `Folder ${uid}`): Folder {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
  };
}

function makeMirror(folders: Folder[] = []): RequestFolderSyncMirror {
  return {
    getRequestFolderMirror: (uid) => {
      const folder = folders.find((f) => f.uid === uid);
      if (!folder) return null;
      return { folder, setOrderKeys: {} };
    },
    listRequestFolders: () => folders,
    liveOrderedSetItems: () => [],
    subscribeRequestFolderMirror: () => () => undefined,
    subscribeAny: () => () => undefined,
    hydrated: Promise.resolve(),
    dispose: () => undefined,
  };
}

function makeContextHandle(workspaceId = 'ws-1', surfaceId = 'workbench'): RendererContextHandle {
  let hlc = initialHlc(`${surfaceId}-test`, 0);
  return {
    nodeId: `${surfaceId}-test`,
    surfaceId,
    workspaceId,
    peekHlc: () => hlc,
    next: (opts = {}) => {
      hlc = advanceHlc(hlc, hlc.physicalMs + 1, opts.observed);
      const ctx: MutatorContext = {
        workspaceId,
        hlc,
        surfaceId: opts.surfaceId ?? surfaceId,
        deviceId: `${surfaceId}-test`,
        ...(opts.batchId ? { batchId: opts.batchId } : {}),
      };
      return ctx;
    },
  };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyRequestFolderCreate', () => {
  it('emits a create envelope on the folder entity and an addToSet on a request-collection parent slot', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyRequestFolderCreate(
      {
        folderUid: 'rfold-00000001',
        parent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'rc-1' },
        name: 'auth',
      },
      {
        workspaceId: 'ws-1',
        surfaceId: 'workbench',
        context: makeContextHandle(),
        mirror: makeMirror(),
        collectionMirror: makeRequestCollectionMirror([], { 'rc-1': { [REQUEST_FOLDER_ITEMS_PATH]: ['tail'] } }),
      },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    const addEnv = batch.mutations.find((m) => m.body.kind === 'addToSet');
    // A new folder appends after the parent's merged tail.
    expect(addEnv?.body.kind === 'addToSet' && addEnv.body.orderKey !== undefined && addEnv.body.orderKey > 'm').toBe(
      true,
    );
    expect(createEnv?.body).toMatchObject({
      kind: 'create',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rfold-00000001',
    });
    expect(addEnv?.body).toMatchObject({
      kind: 'addToSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rc-1',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rfold-00000001',
    });
  });

  it('honors a request-folder parent (nested folder) by emitting addToSet on the parent folder', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyRequestFolderCreate(
      {
        folderUid: 'rfold-child1',
        parent: { type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'rfold-parent1' },
        name: 'nested',
      },
      {
        workspaceId: 'ws-1',
        surfaceId: 'workbench',
        context: makeContextHandle(),
        mirror: makeMirror(),
        collectionMirror: makeRequestCollectionMirror(),
      },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const addEnv = batch.mutations.find((m) => m.body.kind === 'addToSet');
    expect(addEnv?.body).toMatchObject({
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rfold-parent1',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rfold-child1',
    });
  });
});

describe('applyRequestFolderRename', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyRequestFolderRename(
      { folderUid: 'missing', name: 'X' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one setField at path="name" on success', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const folder = makeFolder('rfold-1', 'requests/api-rc-1/auth-rfold-1');
    const mirror = makeMirror([folder]);
    const result = await applyRequestFolderRename(
      { folderUid: 'rfold-1', name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rfold-1',
      path: 'name',
      value: 'Renamed',
    });
  });
});

describe('applyRequestFolderSetSettings', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyRequestFolderSetSettings(
      { folderUid: 'missing', updates: [{ key: 'timeoutMs', value: 30_000 }] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one leaf per knob — setField for a value, unsetField for a cleared one — under the settings batch id', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const folder = makeFolder('rfold-1', 'requests/api-rc-1/auth-rfold-1');
    const mirror = makeMirror([folder]);
    const result = await applyRequestFolderSetSettings(
      {
        folderUid: 'rfold-1',
        updates: [
          { key: 'timeoutMs', value: 30_000 },
          { key: 'sslVerification', value: undefined },
        ],
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.batchId).toBe('request-folder-settings-rfold-1');
    expect(batch.mutations.map((m) => m.body)).toEqual([
      expect.objectContaining({
        kind: 'setField',
        type: REQUEST_FOLDER_ENTITY_TYPE,
        id: 'rfold-1',
        path: 'settings.timeoutMs',
        value: 30_000,
      }),
      expect.objectContaining({
        kind: 'unsetField',
        type: REQUEST_FOLDER_ENTITY_TYPE,
        id: 'rfold-1',
        path: 'settings.sslVerification',
      }),
    ]);
  });
});

describe('applyRequestFolderDelete', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyRequestFolderDelete(
      {
        folderUid: 'missing',
        parent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'rc-1' },
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('cascades every request kind and the nested folders under the folder, deepest-first, then the folder with its slot', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const root = 'requests/api-rc-1';
    const slots: Slots = {
      'rc-1': { [REQUEST_FOLDER_CHILDREN_PATH]: ['fo-1'], [REQUEST_FOLDER_ITEMS_PATH]: ['req0root'] },
      'fo-1': { [REQUEST_FOLDER_CHILDREN_PATH]: ['fo-2'], [REQUEST_FOLDER_ITEMS_PATH]: ['grq00001', 'req00001'] },
      'fo-2': { [REQUEST_FOLDER_ITEMS_PATH]: ['mqr00001'] },
    };
    const result = await applyRequestFolderDelete(
      { folderUid: 'fo-1', parent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'rc-1' } },
      {
        workspaceId: 'ws-1',
        surfaceId: 'workbench',
        mirror: makeRequestFolderMirror(
          [
            { uid: 'fo-1', path: `${root}/sub-fo-1` },
            { uid: 'fo-2', path: `${root}/sub-fo-1/deep-fo-2` },
          ],
          slots,
        ),
        collectionMirror: makeRequestCollectionMirror([{ uid: 'rc-1', path: root, name: 'API' }], slots),
        ...makeRequestLeafMirrors({
          http: { req0root: `${root}/get-req0root`, req00001: `${root}/sub-fo-1/get-req00001` },
          grpc: { grq00001: `${root}/sub-fo-1/call-grq00001` },
          mqtt: { mqr00001: `${root}/sub-fo-1/deep-fo-2/topic-mqr00001` },
        }),
        ...makeRequestExampleMirrors({}),
        context: makeContextHandle(),
      },
    );
    expect(result).toEqual({ ok: true });
    expect(lastBodiesSeen(mockCall)).toEqual([
      { kind: 'delete', type: MQTT_REQUEST_ENTITY_TYPE, id: 'mqr00001' },
      { kind: 'delete', type: GRPC_REQUEST_ENTITY_TYPE, id: 'grq00001' },
      { kind: 'delete', type: REQUEST_ENTITY_TYPE, id: 'req00001' },
      { kind: 'delete', type: REQUEST_FOLDER_ENTITY_TYPE, id: 'fo-2' },
      { kind: 'delete', type: REQUEST_FOLDER_ENTITY_TYPE, id: 'fo-1' },
    ]);
    // The folder's own batch carries its parent slot tombstone ahead of the entity.
    const last = (mockCall.mock.calls[mockCall.mock.calls.length - 1][1] as { batch: MutationBatch }).batch;
    expect(last.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rc-1',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'fo-1',
    });
  });
});

describe('applyRequestFolderMove', () => {
  it('intra-parent move emits a single moveBefore envelope at the parent set path', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyRequestFolderMove(
      {
        folderUid: 'rfold-1',
        newParent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'rc-1' },
        oldParent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'rc-1' },
        orderKey: 'm05',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'moveBefore',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rc-1',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rfold-1',
      orderKey: 'm05',
    });
  });

  it('cross-parent move emits removeFromSet on the old parent + addToSet on the new parent', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyRequestFolderMove(
      {
        folderUid: 'rfold-1',
        newParent: { type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'rfold-parent1' },
        oldParent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'rc-1' },
        orderKey: 'm00',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const remove = batch.mutations.find((m) => m.body.kind === 'removeFromSet');
    const add = batch.mutations.find((m) => m.body.kind === 'addToSet');
    expect(remove?.body).toMatchObject({
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rc-1',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rfold-1',
    });
    expect(add?.body).toMatchObject({
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rfold-parent1',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rfold-1',
      orderKey: 'm00',
    });
  });
});
