/**
 * Renderer-side write client for TemplateCollection mutations.
 *
 * Mirrors `request-collection-write-client.test.ts` against the
 * template-side entity type. We verify:
 *   - create mints uid + `templates/<folder-name>` path; seed batch
 *     carries a `create` envelope on the template-collection entity
 *   - rename returns `not-found` when the mirror has no entry;
 *     success emits one setField at path="name"
 *   - setVar / removeVar emit addToSet / removeFromSet at the
 *     template-collection variables set path keyed by variable.uid
 *   - delete short-circuits to `not-found` when the mirror has no
 *     entry (cascade fanout itself is exercised by integration tests)
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_VARS_PATH,
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
  applyTemplateCollectionCreate,
  applyTemplateCollectionDelete,
  applyTemplateCollectionRemoveVar,
  applyTemplateCollectionRename,
  applyTemplateCollectionSetVar,
} from '@openheaders/ui/shared/sync/template-collection-write-client';
import type {
  RendererContextHandle,
  TemplateCollectionSyncMirror,
} from '@openheaders/ui/context';

function makeMirror(
  collections: Array<{ uid: string; path: string; name: string }> = [],
): TemplateCollectionSyncMirror {
  return {
    getTemplateCollectionMirror: (uid) => {
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
    listTemplateCollections: () =>
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
    subscribeTemplateCollectionMirror: () => () => undefined,
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

describe('applyTemplateCollectionCreate', () => {
  it('mints a create envelope with generated uid + path under "templates/"', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyTemplateCollectionCreate(
      { name: 'Header templates' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    expect(createEnv?.body).toMatchObject({
      kind: 'create',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
    });
    const created = (createEnv?.body as { payload: { uid: string; path: string; name: string } }).payload;
    expect(created.uid).toMatch(/^[0-9a-z]{8,}$/);
    expect(created.path.startsWith('templates/')).toBe(true);
    expect(created.path.endsWith(created.uid)).toBe(true);
    expect(created.name).toBe('Header templates');
    expect(result.ok && result.collection.uid).toBe(created.uid);
  });
});

describe('applyTemplateCollectionRename', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyTemplateCollectionRename(
      { collectionUid: 'missing', name: 'X' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one setField at path="name" on success', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([{ uid: 'tc-1', path: 'templates/api-tc-1', name: 'API' }]);
    const result = await applyTemplateCollectionRename(
      { collectionUid: 'tc-1', name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tc-1',
      path: 'name',
      value: 'Renamed',
    });
  });
});

describe('applyTemplateCollectionSetVar / applyTemplateCollectionRemoveVar', () => {
  const variable: Variable = {
    uid: 'var-00000001',
    name: 'API_KEY',
    type: 'default',
    value: 'abc',
  };

  it('setVar emits an addToSet envelope at the variables set path keyed by variable.uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyTemplateCollectionSetVar(
      { templateCollectionUid: 'tc-1', variable },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tc-1',
      path: TEMPLATE_COLLECTION_VARS_PATH,
      itemId: variable.uid,
    });
  });

  it('removeVar emits a removeFromSet envelope keyed by uid (not name)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyTemplateCollectionRemoveVar(
      { templateCollectionUid: 'tc-1', uid: variable.uid },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tc-1',
      path: TEMPLATE_COLLECTION_VARS_PATH,
      itemId: variable.uid,
    });
  });
});

describe('applyTemplateCollectionDelete', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const mirror = makeMirror([]);
    const result = await applyTemplateCollectionDelete(
      { collectionUid: 'missing' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});
