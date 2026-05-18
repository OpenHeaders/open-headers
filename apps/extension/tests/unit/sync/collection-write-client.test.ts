/**
 * Renderer-side write client for rule-side Collection mutations.
 *
 * Each helper builds a `MutationBatch` via the shared `collection-
 * mutations` factories, fires `oh.sync.apply` on the bridge, and
 * reports the structured ack back to the caller. We verify:
 *   - create mints uid + `rules/<folder-name>` path; the seed batch
 *     carries a `create` envelope at the collection entity
 *   - rename / pinned / default envelopes emit one setField at the
 *     expected leaf path
 *   - setVar / removeVar emit addToSet / removeFromSet at the
 *     variables set path keyed by variable.uid
 *   - delete short-circuits to `not-found` when the mirror has no
 *     entry (cascade fanout itself is exercised by integration tests)
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  initialHlc,
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
  applyCollectionCreate,
  applyCollectionDelete,
  applyCollectionRemoveVar,
  applyCollectionSetVar,
  applyRenameCollection,
  applySetDefaultEnvironmentId,
  applySetPinnedAndDefault,
  applySetPinnedEnvironments,
} from '@openheaders/ui/shared/sync/collection-write-client';
import type {
  CollectionSyncMirror,
  RendererContextHandle,
} from '@openheaders/ui/context';

function makeCollectionMirror(
  collections: Array<{ uid: string; path: string; name: string }> = [],
): CollectionSyncMirror {
  return {
    getCollectionMirror: (uid) => {
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
    listCollections: () =>
      collections.map((c) => ({
        schemaVersion: 5,
        uid: c.uid,
        path: c.path,
        name: c.name,
        variables: [],
        pinnedEnvironmentIds: [],
        defaultEnvironmentId: null,
      })),
    liveVarNames: () => [],
    liveOrderedSetItems: () => [],
    subscribeCollectionMirror: () => () => undefined,
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

describe('applyCollectionCreate', () => {
  it('mints a create envelope with generated uid + path under "rules/" and seeded scalar shell', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyCollectionCreate(
      { name: 'Login flow' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [type, payload] = mockCall.mock.calls[0];
    expect(type).toBe('oh.sync.apply');
    const batch = (payload as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    expect(createEnv).toBeTruthy();
    expect(createEnv?.body).toMatchObject({ kind: 'create', type: COLLECTION_ENTITY_TYPE });
    const created = (createEnv?.body as { payload: { uid: string; path: string; name: string } }).payload;
    expect(created.uid).toMatch(/^[0-9a-z]{8,}$/);
    expect(created.path.startsWith('rules/')).toBe(true);
    expect(created.path.endsWith(created.uid)).toBe(true);
    expect(created.name).toBe('Login flow');
    expect(result.ok && result.collection.uid).toBe(created.uid);
  });
});

describe('applyRenameCollection', () => {
  it('emits one setField at path="name"', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyRenameCollection(
      { collectionUid: 'coll-abcd1234', name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-abcd1234',
      path: 'name',
      value: 'Renamed',
    });
  });
});

describe('applyCollectionSetVar / applyCollectionRemoveVar', () => {
  const variable: Variable = {
    uid: 'var-00000001',
    name: 'API_KEY',
    type: 'default',
    value: 'abc',
  };

  it('setVar emits an addToSet envelope at the variables set path keyed by variable.uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyCollectionSetVar(
      { collectionUid: 'coll-1', variable },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-1',
      path: COLLECTION_VARS_PATH,
      itemId: variable.uid,
    });
  });

  it('removeVar emits a removeFromSet envelope keyed by uid (not name)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyCollectionRemoveVar(
      { collectionUid: 'coll-1', uid: variable.uid },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-1',
      path: COLLECTION_VARS_PATH,
      itemId: variable.uid,
    });
  });
});

describe('applySetPinnedEnvironments / applySetDefaultEnvironmentId / applySetPinnedAndDefault', () => {
  it('setPinnedEnvironments emits one setField at pinnedEnvironmentIds', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applySetPinnedEnvironments(
      { collectionUid: 'coll-1', pinnedEnvironmentIds: ['env-a', 'env-b'] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'pinnedEnvironmentIds',
      value: ['env-a', 'env-b'],
    });
  });

  it('setDefaultEnvironmentId accepts null to clear the default', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applySetDefaultEnvironmentId(
      { collectionUid: 'coll-1', defaultEnvironmentId: null },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'defaultEnvironmentId',
      value: null,
    });
  });

  it('setPinnedAndDefault bundles both setField envelopes under one batch', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applySetPinnedAndDefault(
      {
        collectionUid: 'coll-1',
        pinnedEnvironmentIds: ['env-a'],
        defaultEnvironmentId: 'env-a',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(2);
    const paths = batch.mutations.map((m) => (m.body as { path: string }).path).sort();
    expect(paths).toEqual(['defaultEnvironmentId', 'pinnedEnvironmentIds']);
  });
});

describe('applyCollectionDelete', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeCollectionMirror([]);
    const result = await applyCollectionDelete(
      { collectionUid: 'missing' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});
