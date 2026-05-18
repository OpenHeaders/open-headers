/**
 * Renderer-side write client for TemplateFolder mutations.
 *
 * Mirrors `request-folder-write-client.test.ts` against the
 * template-side entity type. We verify:
 *   - create emits a `create` envelope on the template-folder entity
 *     plus an `addToSet` on the parent's `folders` slot (parent can be
 *     a template-collection or a template-folder)
 *   - rename returns `not-found` when the mirror has no entry; success
 *     emits one setField at path="name"
 *   - delete short-circuits to `not-found` when the mirror has no
 *     entry (cascade fanout itself is exercised by integration tests)
 *   - move emits `moveBefore` for an intra-parent move, and a
 *     `removeFromSet`+`addToSet` pair for a cross-parent move
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
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
  applyTemplateFolderCreate,
  applyTemplateFolderDelete,
  applyTemplateFolderMove,
  applyTemplateFolderRename,
} from '@openheaders/ui/shared/sync/template-folder-write-client';
import type {
  RendererContextHandle,
  TemplateFolderSyncMirror,
} from '@openheaders/ui/context';

function makeFolder(uid: string, path: string, name = `Folder ${uid}`): Folder {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
  };
}

function makeMirror(folders: Folder[] = []): TemplateFolderSyncMirror {
  return {
    getTemplateFolderMirror: (uid) => {
      const folder = folders.find((f) => f.uid === uid);
      if (!folder) return null;
      return { folder, setOrderKeys: {} };
    },
    listTemplateFolders: () => folders,
    liveOrderedSetItems: () => [],
    subscribeTemplateFolderMirror: () => () => undefined,
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

describe('applyTemplateFolderCreate', () => {
  it('emits a create envelope on the folder entity and an addToSet on a template-collection parent slot', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyTemplateFolderCreate(
      {
        folderUid: 'tfold-00000001',
        parent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: 'tc-1' },
        name: 'auth',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    const addEnv = batch.mutations.find((m) => m.body.kind === 'addToSet');
    expect(createEnv?.body).toMatchObject({
      kind: 'create',
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'tfold-00000001',
    });
    expect(addEnv?.body).toMatchObject({
      kind: 'addToSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tc-1',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tfold-00000001',
    });
  });

  it('honors a template-folder parent (nested folder) by emitting addToSet on the parent folder', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyTemplateFolderCreate(
      {
        folderUid: 'tfold-child1',
        parent: { type: TEMPLATE_FOLDER_ENTITY_TYPE, uid: 'tfold-parent1' },
        name: 'nested',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const addEnv = batch.mutations.find((m) => m.body.kind === 'addToSet');
    expect(addEnv?.body).toMatchObject({
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'tfold-parent1',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tfold-child1',
    });
  });
});

describe('applyTemplateFolderRename', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyTemplateFolderRename(
      { folderUid: 'missing', name: 'X' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one setField at path="name" on success', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const folder = makeFolder('tfold-1', 'templates/api-tc-1/auth-tfold-1');
    const mirror = makeMirror([folder]);
    const result = await applyTemplateFolderRename(
      { folderUid: 'tfold-1', name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'tfold-1',
      path: 'name',
      value: 'Renamed',
    });
  });
});

describe('applyTemplateFolderDelete', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyTemplateFolderDelete(
      {
        folderUid: 'missing',
        parent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: 'tc-1' },
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('applyTemplateFolderMove', () => {
  it('intra-parent move emits a single moveBefore envelope at the parent set path', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyTemplateFolderMove(
      {
        folderUid: 'tfold-1',
        newParent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: 'tc-1' },
        oldParent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: 'tc-1' },
        orderKey: 'm05',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'moveBefore',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tc-1',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tfold-1',
      orderKey: 'm05',
    });
  });

  it('cross-parent move emits removeFromSet on the old parent + addToSet on the new parent', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyTemplateFolderMove(
      {
        folderUid: 'tfold-1',
        newParent: { type: TEMPLATE_FOLDER_ENTITY_TYPE, uid: 'tfold-parent1' },
        oldParent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: 'tc-1' },
        orderKey: 'm00',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const remove = batch.mutations.find((m) => m.body.kind === 'removeFromSet');
    const add = batch.mutations.find((m) => m.body.kind === 'addToSet');
    expect(remove?.body).toMatchObject({
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tc-1',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tfold-1',
    });
    expect(add?.body).toMatchObject({
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'tfold-parent1',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tfold-1',
      orderKey: 'm00',
    });
  });
});
