/**
 * Renderer-side write client for RequestCollection mutations.
 *
 * Mirrors `collection-write-client.test.ts` against the request-side
 * entity type. We verify:
 *   - create mints uid + `requests/<folder-name>` path; seed batch
 *     carries one `create` envelope on the request-collection entity
 *   - rename returns `not-found` when the mirror has no entry;
 *     success emits one setField at path="name"
 *   - setVar / removeVar emit addToSet / removeFromSet at the
 *     request-collection variables set path keyed by variable.uid
 *   - delete short-circuits to `not-found` when the mirror has no
 *     entry; the cascade walks the parent-owned sets — every request
 *     kind, folders deepest-first, the collection last — and follows
 *     the slots, never a leaf mirror's stale path
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  GRPC_REQUEST_ENTITY_TYPE,
  initialHlc,
  keyBetween,
  MQTT_REQUEST_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Variable } from '@openheaders/core/types';
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

import type {
  RendererContextHandle,
  RequestCollectionSyncMirror,
  WorkspaceRootsSyncMirror,
} from '@openheaders/ui/context';
import {
  applyRequestCollectionCreate,
  applyRequestCollectionDelete,
  applyRequestCollectionRemoveVar,
  applyRequestCollectionRename,
  applyRequestCollectionSetSettings,
  applyRequestCollectionSetVar,
} from '@openheaders/ui/shared/sync/request-collection-write-client';
import {
  lastBodiesSeen,
  makeRequestCollectionMirror,
  makeRequestExampleMirrors,
  makeRequestFolderMirror,
  makeRequestLeafMirrors,
} from '../../helpers/request-tree-mirrors';

function makeMirror(collections: Array<{ uid: string; path: string; name: string }> = []): RequestCollectionSyncMirror {
  return {
    getRequestCollectionMirror: (uid) => {
      const coll = collections.find((c) => c.uid === uid);
      if (!coll) return null;
      return {
        collection: {
          schemaVersion: 5,
          uid: coll.uid,
          path: coll.path,
          name: coll.name,
          variables: [],
          pinnedEnvironmentIds: [],
          defaultEnvironmentId: null,
        },
        varUids: [],
        setOrderKeys: {},
      };
    },
    listRequestCollections: () =>
      collections.map((c) => ({
        schemaVersion: 5,
        uid: c.uid,
        path: c.path,
        name: c.name,
        variables: [],
        pinnedEnvironmentIds: [],
        defaultEnvironmentId: null,
      })),
    liveOrderedSetItems: () => [],
    subscribeRequestCollectionMirror: () => () => undefined,
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

function makeRootsMirror(tailKey: string | null = null): WorkspaceRootsSyncMirror {
  return {
    getMirror: () => null,
    liveOrderedSetItems: () => (tailKey === null ? [] : [{ itemId: 'col0tail', orderKey: tailKey }]),
    appendOrderKey: () => keyBetween(tailKey, null),
    subscribeMirror: () => () => undefined,
    hydrated: Promise.resolve(),
    dispose: () => undefined,
  };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyRequestCollectionCreate', () => {
  it('mints a create envelope with generated uid + path under "requests/"', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyRequestCollectionCreate(
      { name: 'API endpoints' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle(), rootsMirror: makeRootsMirror() },
    );
    expect(result.ok).toBe(true);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    if (createEnv === undefined) throw new Error('no create envelope');
    expect(createEnv.body).toMatchObject({
      kind: 'create',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
    });
    const created = (createEnv.body as { payload: { uid: string; path: string; name: string } }).payload;
    expect(created.uid).toMatch(/^[0-9a-z]{8,}$/);
    expect(created.path.startsWith('requests/')).toBe(true);
    expect(created.path.endsWith(created.uid)).toBe(true);
    expect(created.name).toBe('API endpoints');
    expect(result.ok && result.collection.uid).toBe(created.uid);
  });

  it('appends its roots slot strictly after the workspace-roots mirror tail', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyRequestCollectionCreate(
      { name: 'Last' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle(), rootsMirror: makeRootsMirror('m') },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const slot = batch.mutations[batch.mutations.length - 1].body;
    expect(slot).toMatchObject({
      kind: 'addToSet',
      type: WORKSPACE_ROOTS_ENTITY_TYPE,
      id: WORKSPACE_ROOTS_ID,
      path: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
    });
    expect(slot.kind === 'addToSet' && slot.orderKey).toBe(keyBetween('m', null));
  });
});

describe('applyRequestCollectionRename', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyRequestCollectionRename(
      { collectionUid: 'missing', name: 'X' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one setField at path="name" on success', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([{ uid: 'rc-1', path: 'requests/api-rc-1', name: 'API' }]);
    const result = await applyRequestCollectionRename(
      { collectionUid: 'rc-1', name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rc-1',
      path: 'name',
      value: 'Renamed',
    });
  });
});

describe('applyRequestCollectionSetSettings', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyRequestCollectionSetSettings(
      { collectionUid: 'missing', updates: [{ key: 'timeoutMs', value: 30_000 }] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one leaf per knob — setField for a value, unsetField for a cleared one — under the settings batch id', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([{ uid: 'rc-1', path: 'requests/api-rc-1', name: 'API' }]);
    const result = await applyRequestCollectionSetSettings(
      {
        collectionUid: 'rc-1',
        updates: [
          { key: 'timeoutMs', value: 30_000 },
          { key: 'sslVerification', value: undefined },
        ],
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.batchId).toBe('request-collection-settings-rc-1');
    expect(batch.mutations.map((m) => m.body)).toEqual([
      expect.objectContaining({
        kind: 'setField',
        type: REQUEST_COLLECTION_ENTITY_TYPE,
        id: 'rc-1',
        path: 'settings.timeoutMs',
        value: 30_000,
      }),
      expect.objectContaining({
        kind: 'unsetField',
        type: REQUEST_COLLECTION_ENTITY_TYPE,
        id: 'rc-1',
        path: 'settings.sslVerification',
      }),
    ]);
  });
});

describe('applyRequestCollectionSetVar / applyRequestCollectionRemoveVar', () => {
  const variable: Variable = {
    uid: 'var-00000001',
    name: 'API_KEY',
    type: 'default',
    value: 'abc',
  };

  it('setVar emits an addToSet envelope at the variables set path keyed by variable.uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyRequestCollectionSetVar(
      { requestCollectionUid: 'rc-1', variable },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rc-1',
      path: REQUEST_COLLECTION_VARS_PATH,
      itemId: variable.uid,
    });
  });

  it('removeVar emits a removeFromSet envelope keyed by uid (not name)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyRequestCollectionRemoveVar(
      { requestCollectionUid: 'rc-1', uid: variable.uid },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rc-1',
      path: REQUEST_COLLECTION_VARS_PATH,
      itemId: variable.uid,
    });
  });
});

describe('applyRequestCollectionDelete', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyRequestCollectionDelete(
      { collectionUid: 'missing' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('cascades every request kind with its examples and the folders under the collection, deepest-first, before the collection', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const root = 'requests/api-rc-1';
    const mirror = makeRequestCollectionMirror([{ uid: 'rc-1', path: root, name: 'API' }], {
      'rc-1': { [REQUEST_FOLDER_CHILDREN_PATH]: ['fo-1'], [REQUEST_FOLDER_ITEMS_PATH]: ['req00001', 'grq00001'] },
    });
    const folderMirror = makeRequestFolderMirror(
      [
        { uid: 'fo-1', path: `${root}/sub-fo-1` },
        { uid: 'fo-2', path: `${root}/sub-fo-1/deep-fo-2` },
      ],
      {
        'fo-1': { [REQUEST_FOLDER_CHILDREN_PATH]: ['fo-2'], [REQUEST_FOLDER_ITEMS_PATH]: ['wsr00001'] },
        'fo-2': { [REQUEST_FOLDER_ITEMS_PATH]: ['mqr00001'] },
      },
    );
    const result = await applyRequestCollectionDelete(
      { collectionUid: 'rc-1' },
      {
        workspaceId: 'ws-1',
        surfaceId: 'workbench',
        mirror,
        folderMirror,
        ...makeRequestLeafMirrors(
          {
            http: { req00001: `${root}/get-req00001` },
            grpc: { grq00001: `${root}/call-grq00001` },
            ws: { wsr00001: `${root}/sub-fo-1/socket-wsr00001` },
            mqtt: { mqr00001: `${root}/sub-fo-1/deep-fo-2/topic-mqr00001` },
          },
          // req00001's example is slotted; wsr00001's is an old-client capture with no slot.
          { req00001: ['rex00001'] },
        ),
        ...makeRequestExampleMirrors({
          http: { rex00001: 'req00001' },
          ws: { wex00001: 'wsr00001' },
          // Owned by a request outside the collection — untouched.
          grpc: { gex0other: 'grqother' },
        }),
        context: makeContextHandle(),
      },
    );
    expect(result).toEqual({ ok: true });
    expect(lastBodiesSeen(mockCall)).toEqual([
      { kind: 'delete', type: MQTT_REQUEST_ENTITY_TYPE, id: 'mqr00001' },
      { kind: 'delete', type: WS_RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'wex00001' },
      { kind: 'delete', type: WEBSOCKET_REQUEST_ENTITY_TYPE, id: 'wsr00001' },
      { kind: 'delete', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'rex00001' },
      { kind: 'delete', type: REQUEST_ENTITY_TYPE, id: 'req00001' },
      { kind: 'delete', type: GRPC_REQUEST_ENTITY_TYPE, id: 'grq00001' },
      { kind: 'delete', type: REQUEST_FOLDER_ENTITY_TYPE, id: 'fo-2' },
      { kind: 'delete', type: REQUEST_FOLDER_ENTITY_TYPE, id: 'fo-1' },
      { kind: 'delete', type: REQUEST_COLLECTION_ENTITY_TYPE, id: 'rc-1' },
    ]);
  });

  it('follows the slots, not a stale mirror path: dragged out is spared, dragged in is taken, slot-less by its path', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const root = 'requests/api-rc-1';
    const other = 'requests/other-rc-2';
    const mirror = makeRequestCollectionMirror(
      [
        { uid: 'rc-1', path: root, name: 'API' },
        { uid: 'rc-2', path: other, name: 'Other' },
      ],
      {
        'rc-1': { [REQUEST_FOLDER_ITEMS_PATH]: ['grq0000in'] },
        'rc-2': { [REQUEST_FOLDER_ITEMS_PATH]: ['req000out'] },
      },
    );
    const result = await applyRequestCollectionDelete(
      { collectionUid: 'rc-1' },
      {
        workspaceId: 'ws-1',
        surfaceId: 'workbench',
        mirror,
        folderMirror: makeRequestFolderMirror(),
        ...makeRequestLeafMirrors({
          // Dragged out of rc-1 after its mirror entry last updated.
          http: { req000out: `${root}/get-req000out` },
          // Dragged into rc-1; its mirror path still names rc-2.
          grpc: { grq0000in: `${other}/call-grq0000in` },
          // An old-client create under rc-1 with no slot anywhere yet.
          mqtt: { mqr0slotless: `${root}/topic-mqr0slotless` },
        }),
        ...makeRequestExampleMirrors({}),
        ...makeRequestExampleMirrors({}),
        context: makeContextHandle(),
      },
    );
    expect(result).toEqual({ ok: true });
    expect(lastBodiesSeen(mockCall)).toEqual([
      { kind: 'delete', type: GRPC_REQUEST_ENTITY_TYPE, id: 'grq0000in' },
      { kind: 'delete', type: MQTT_REQUEST_ENTITY_TYPE, id: 'mqr0slotless' },
      { kind: 'delete', type: REQUEST_COLLECTION_ENTITY_TYPE, id: 'rc-1' },
    ]);
  });
});
