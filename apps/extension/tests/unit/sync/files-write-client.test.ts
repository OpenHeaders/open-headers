/**
 * Renderer-side write client for the Files catalog.
 *
 * Files is a singleton entity (`FILES_ID = 'files'`) hosting a
 * `refs` set of `FileRefSlot` records keyed by `fileId`. Bytes are
 * NOT handled here — these helpers only mutate the catalog. We verify:
 *   - add emits addToSet keyed by fileId, carrying the whole FileRefSlot
 *   - rename is a same-uid addToSet (LWW handles convergence)
 *   - remove emits removeFromSet keyed by fileId
 */

import type { FileRefSlot, MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  FILES_ENTITY_TYPE,
  FILES_ID,
  FILES_REFS_PATH,
  initialHlc,
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

import {
  applyFileAdd,
  applyFileRemove,
  applyFileRename,
} from '@openheaders/ui/shared/sync/files-write-client';
import type { RendererContextHandle } from '@openheaders/ui/context';

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

const ref: FileRefSlot = {
  fileId: 'f-00000001',
  hash: 'sha256-abc',
  filename: 'logo.png',
  mimeType: 'image/png',
  size: 1024,
};

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyFileAdd', () => {
  it('emits an addToSet envelope keyed by fileId carrying the whole FileRefSlot', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyFileAdd(
      { ref },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: FILES_ENTITY_TYPE,
      id: FILES_ID,
      path: FILES_REFS_PATH,
      itemId: ref.fileId,
    });
    const item = (batch.mutations[0].body as { item: FileRefSlot }).item;
    expect(item).toMatchObject(ref);
  });
});

describe('applyFileRename', () => {
  it('emits a same-uid addToSet with the new filename (LWW convergence, no remove+add pair)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const renamed: FileRefSlot = { ...ref, filename: 'logo-final.png' };
    await applyFileRename(
      { ref: renamed },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: ref.fileId,
    });
    const item = (batch.mutations[0].body as { item: FileRefSlot }).item;
    expect(item.filename).toBe('logo-final.png');
  });
});

describe('applyFileRemove', () => {
  it('emits a removeFromSet envelope keyed by fileId', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyFileRemove(
      { fileId: ref.fileId },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: FILES_ENTITY_TYPE,
      id: FILES_ID,
      path: FILES_REFS_PATH,
      itemId: ref.fileId,
    });
  });
});
