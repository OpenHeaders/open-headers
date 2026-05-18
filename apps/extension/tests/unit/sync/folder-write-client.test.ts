/**
 * Renderer-side write client for rule-side Folder mutations.
 *
 * Each helper builds a `MutationBatch` via the shared `folder-mutations`
 * factories, fires `oh.sync.apply` on the bridge, and reports the
 * structured ack back to the caller. We verify:
 *   - create emits a `create` envelope on the folder entity plus an
 *     `addToSet` on the parent's `folders` slot
 *   - rename returns `not-found` when the mirror has no entry; success
 *     path emits one setField at path="name"
 *   - delete short-circuits to `not-found` when the mirror has no
 *     entry (cascade fanout itself is exercised by integration tests)
 *   - move emits a `moveBefore` for an intra-parent move, and a
 *     `removeFromSet`+`addToSet` pair for a cross-parent move
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  initialHlc,
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

import {
  applyFolderCreate,
  applyFolderDelete,
  applyFolderMove,
  applyFolderRename,
} from '@openheaders/ui/shared/sync/folder-write-client';
import type {
  FolderSyncMirror,
  RendererContextHandle,
} from '@openheaders/ui/context';

function makeFolder(uid: string, path: string, name = `Folder ${uid}`): Folder {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
  };
}

function makeFolderMirror(folders: Folder[] = []): FolderSyncMirror {
  return {
    getFolderMirror: (uid) => {
      const folder = folders.find((f) => f.uid === uid);
      if (!folder) return null;
      return { folder, setOrderKeys: {} };
    },
    listFolders: () => folders,
    liveOrderedSetItems: () => [],
    subscribeFolderMirror: () => () => undefined,
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

describe('applyFolderCreate', () => {
  it('emits a create envelope on the folder entity and an addToSet on the parent collection slot', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyFolderCreate(
      {
        folderUid: 'fold-00000001',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: 'coll-1' },
        name: 'login',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    const addEnv = batch.mutations.find((m) => m.body.kind === 'addToSet');
    expect(createEnv?.body).toMatchObject({
      kind: 'create',
      type: FOLDER_ENTITY_TYPE,
      id: 'fold-00000001',
    });
    expect(addEnv?.body).toMatchObject({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-1',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'fold-00000001',
    });
  });

  it('honors a folder parent (nested folder) by emitting addToSet on the parent folder', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyFolderCreate(
      {
        folderUid: 'fold-child01',
        parent: { type: FOLDER_ENTITY_TYPE, uid: 'fold-parent1' },
        name: 'nested',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const addEnv = batch.mutations.find((m) => m.body.kind === 'addToSet');
    expect(addEnv?.body).toMatchObject({
      type: FOLDER_ENTITY_TYPE,
      id: 'fold-parent1',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'fold-child01',
    });
  });
});

describe('applyFolderRename', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeFolderMirror([]);
    const result = await applyFolderRename(
      { folderUid: 'missing', name: 'X' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one setField at path="name" on the folder entity', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const folder = makeFolder('fold-1', 'rules/coll-1/login-fold-1');
    const mirror = makeFolderMirror([folder]);
    const result = await applyFolderRename(
      { folderUid: 'fold-1', name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: FOLDER_ENTITY_TYPE,
      id: 'fold-1',
      path: 'name',
      value: 'Renamed',
    });
  });
});

describe('applyFolderDelete', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeFolderMirror([]);
    const result = await applyFolderDelete(
      {
        folderUid: 'missing',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: 'coll-1' },
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('applyFolderMove', () => {
  it('intra-parent move emits a single moveBefore envelope at the parent set path', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyFolderMove(
      {
        folderUid: 'fold-1',
        newParent: { type: COLLECTION_ENTITY_TYPE, uid: 'coll-1' },
        oldParent: { type: COLLECTION_ENTITY_TYPE, uid: 'coll-1' },
        orderKey: 'm05',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'moveBefore',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-1',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'fold-1',
      orderKey: 'm05',
    });
  });

  it('cross-parent move emits removeFromSet on the old parent + addToSet on the new parent', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyFolderMove(
      {
        folderUid: 'fold-1',
        newParent: { type: FOLDER_ENTITY_TYPE, uid: 'fold-parent1' },
        oldParent: { type: COLLECTION_ENTITY_TYPE, uid: 'coll-1' },
        orderKey: 'm00',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const remove = batch.mutations.find((m) => m.body.kind === 'removeFromSet');
    const add = batch.mutations.find((m) => m.body.kind === 'addToSet');
    expect(remove?.body).toMatchObject({
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-1',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'fold-1',
    });
    expect(add?.body).toMatchObject({
      type: FOLDER_ENTITY_TYPE,
      id: 'fold-parent1',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'fold-1',
      orderKey: 'm00',
    });
  });
});
