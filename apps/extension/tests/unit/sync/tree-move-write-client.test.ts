/**
 * Tree-move write client — the sidebar's one move gesture: a leaf of
 * any kind reorders with one `moveBefore` on its parent's `items` set
 * or re-parents with a `removeFromSet` + `addToSet` pair in ONE batch
 * (never a `path` write); a collection reorders on its tree's roots
 * set; a rule re-parent carries the DNR recompile intent.
 */

import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import {
  advanceHlc,
  COLLECTION_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  GRPC_REQUEST_ENTITY_TYPE,
  initialHlc,
  RECOMPILE_DNR,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
  RULE_ENTITY_TYPE,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
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

import type { RendererContextHandle } from '@openheaders/ui/context';
import { applyTreeCollectionMove, applyTreeLeafMove } from '@openheaders/ui/shared/sync/tree-move-write-client';

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

const opts = () => ({ workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() });
const sent = () => mockCall.mock.calls[0][1] as { batch: MutationBatch; sideEffects: SideEffectIntent[] };

beforeEach(() => {
  mockCall.mockReset();
  mockCall.mockResolvedValue({ ok: true, outcomes: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyTreeLeafMove', () => {
  it('same parent: one moveBefore on the parent items set with the caller key, no path write', async () => {
    const result = await applyTreeLeafMove(
      {
        entityType: GRPC_REQUEST_ENTITY_TYPE,
        uid: 'grq00001',
        newParent: { type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'fol00001' },
        orderKey: 'k',
      },
      opts(),
    );
    expect(result).toEqual({ ok: true });
    const { batch } = sent();
    expect(batch.batchId).toBe('tree-move-grq00001');
    expect(batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'moveBefore',
        type: REQUEST_FOLDER_ENTITY_TYPE,
        id: 'fol00001',
        path: REQUEST_FOLDER_ITEMS_PATH,
        itemId: 'grq00001',
        orderKey: 'k',
      },
    ]);
  });

  it('new parent: removeFromSet + addToSet with the typed slot in one batch; a rule carries the DNR recompile', async () => {
    await applyTreeLeafMove(
      {
        entityType: RULE_ENTITY_TYPE,
        uid: 'rul00001',
        newParent: { type: FOLDER_ENTITY_TYPE, uid: 'fol00001' },
        orderKey: 'k',
        oldParent: { type: COLLECTION_ENTITY_TYPE, uid: 'col00001' },
      },
      opts(),
    );
    const { batch, sideEffects } = sent();
    expect(batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'removeFromSet',
        type: COLLECTION_ENTITY_TYPE,
        id: 'col00001',
        path: FOLDER_ITEMS_PATH,
        itemId: 'rul00001',
      },
      {
        kind: 'addToSet',
        type: FOLDER_ENTITY_TYPE,
        id: 'fol00001',
        path: FOLDER_ITEMS_PATH,
        itemId: 'rul00001',
        item: { uid: 'rul00001', type: RULE_ENTITY_TYPE },
        orderKey: 'k',
      },
    ]);
    expect(sideEffects.map((e) => `${e.kind}:${e.key}`)).toEqual([`${RECOMPILE_DNR}:rul00001`]);
    expect(batch.mutations.every((m) => m.body.kind !== 'setField')).toBe(true);
  });
});

describe('applyTreeCollectionMove', () => {
  it('reorders on the tree roots set with one moveBefore', async () => {
    await applyTreeCollectionMove({ tree: 'requests', uid: 'col00001', orderKey: 'k' }, opts());
    const { batch } = sent();
    expect(batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'moveBefore',
        type: WORKSPACE_ROOTS_ENTITY_TYPE,
        id: WORKSPACE_ROOTS_ID,
        path: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
        itemId: 'col00001',
        orderKey: 'k',
      },
    ]);
    expect(batch.mutations[0].body.type).not.toBe(REQUEST_COLLECTION_ENTITY_TYPE);
  });
});
