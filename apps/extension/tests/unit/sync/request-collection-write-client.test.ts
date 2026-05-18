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
 *     entry (cascade fanout itself is exercised by integration tests)
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_VARS_PATH,
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

import {
  applyRequestCollectionCreate,
  applyRequestCollectionDelete,
  applyRequestCollectionRemoveVar,
  applyRequestCollectionRename,
  applyRequestCollectionSetVar,
} from '@openheaders/ui/shared/sync/request-collection-write-client';
import type {
  RendererContextHandle,
  RequestCollectionSyncMirror,
} from '@openheaders/ui/context';

function makeMirror(
  collections: Array<{ uid: string; path: string; name: string }> = [],
): RequestCollectionSyncMirror {
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
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    expect(createEnv?.body).toMatchObject({
      kind: 'create',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
    });
    const created = (createEnv?.body as { payload: { uid: string; path: string; name: string } }).payload;
    expect(created.uid).toMatch(/^[0-9a-z]{8,}$/);
    expect(created.path.startsWith('requests/')).toBe(true);
    expect(created.path.endsWith(created.uid)).toBe(true);
    expect(created.name).toBe('API endpoints');
    expect(result.ok && result.collection.uid).toBe(created.uid);
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
});
