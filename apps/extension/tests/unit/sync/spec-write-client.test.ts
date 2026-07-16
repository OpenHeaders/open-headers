/**
 * Renderer-side write client for Spec mutations.
 *
 * Each helper builds a `MutationBatch` via the shared `spec-mutations`
 * factories, fires `oh.sync.apply` on the bridge, and reports the
 * structured ack back to the caller. We verify:
 *   - create mints a uid, derives `path` as `specs/<folder>`, emits a
 *     `create` shell (files stripped) + one `addToSet` per file with
 *     sequential orderKeys; specs carry zero side effects
 *   - update emits one setField per defined key and skips undefined
 *   - delete emits a single `delete` envelope; unknown uid → not-found
 *   - setFile keeps an existing row's live orderKey and appends a new
 *     row after the current tail (§23.5 position preservation)
 *   - removeFile emits removeFromSet keyed by the file uid
 */

import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import { advanceHlc, initialHlc, SPEC_ENTITY_TYPE, SPEC_FILES_PATH } from '@openheaders/core/sync';
import type { Spec, SpecFile } from '@openheaders/core/types';
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
import type { SpecSyncMirror } from '@openheaders/ui/context/mirrors/spec-sync-mirror';
import {
  applySpecCreate,
  applySpecDelete,
  applySpecRemoveFile,
  applySpecSetFile,
  applySpecUpdate,
} from '@openheaders/ui/shared/sync/spec-write-client';

function makeFile(overrides: Partial<SpecFile> = {}): SpecFile {
  return {
    uid: 'file0001',
    fileName: 'index.yaml',
    content: "openapi: '3.1.0'\ninfo:\n  title: OpenHeaders API\n  version: '1.0.0'\n",
    ...overrides,
  };
}

function makeSpec(overrides: Partial<Spec> = {}): Spec {
  return {
    schemaVersion: 5,
    uid: 'spec0001',
    path: 'specs/openheaders-api-spec0001',
    name: 'OpenHeaders API',
    format: 'openapi-3.1',
    rootFileUid: 'file0001',
    files: [makeFile()],
    ...overrides,
  };
}

/** Minimal SpecSyncMirror stub — one known spec plus its live file
 *  order keys (monotonic single-char sequence in the given uid order). */
function mockMirror(spec: Spec | null, orderedFileUids: readonly string[] = []): SpecSyncMirror {
  const entries = orderedFileUids.map((uid, i) => ({ itemId: uid, orderKey: String.fromCharCode(0x6d + i) }));
  return {
    hydrated: Promise.resolve(),
    getSpecMirror: (uid) =>
      spec && uid === spec.uid ? { spec, setOrderKeys: { [SPEC_FILES_PATH]: entries } } : null,
    listSpecs: () => (spec ? [spec] : []),
    liveFileOrderKeys: (uid) => (spec && uid === spec.uid ? entries : []),
    subscribeSpecMirror: () => () => undefined,
    subscribeAny: () => () => undefined,
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

function lastPayload(): { batch: MutationBatch; sideEffects: SideEffectIntent[] } {
  return mockCall.mock.calls[mockCall.mock.calls.length - 1][1] as {
    batch: MutationBatch;
    sideEffects: SideEffectIntent[];
  };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applySpecCreate', () => {
  it('mints uid + path, emits a files-stripped create shell plus one ordered addToSet per file', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const seed = {
      name: 'My Spec',
      format: 'openapi-3.1' as const,
      rootFileUid: 'file0001',
      files: [makeFile(), makeFile({ uid: 'file0002', fileName: 'shared.yaml', content: 'components: {}\n' })],
    };
    const result = await applySpecCreate(
      { spec: seed },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.uid).toMatch(/^[0-9a-z]{8,}$/);
    expect(result.spec.path).toBe(`specs/my-spec-${result.spec.uid}`);
    expect(result.spec.schemaVersion).toBe(5);

    const { batch, sideEffects } = lastPayload();
    expect(sideEffects).toHaveLength(0);
    const create = batch.mutations.find((m) => m.body.kind === 'create');
    expect(create?.body).toMatchObject({ kind: 'create', type: SPEC_ENTITY_TYPE, id: result.spec.uid });
    const shell = (create?.body as { payload: Record<string, unknown> }).payload;
    expect(shell.files).toBeUndefined();
    expect(shell.rootFileUid).toBe('file0001');

    const adds = batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds.map((m) => (m.body as { itemId: string }).itemId)).toEqual(['file0001', 'file0002']);
    const orderKeys = adds.map((m) => (m.body as { orderKey?: string }).orderKey ?? '');
    expect(orderKeys[0] < orderKeys[1]).toBe(true);
    for (const add of adds) {
      expect(add.body).toMatchObject({ type: SPEC_ENTITY_TYPE, path: SPEC_FILES_PATH });
    }
  });
});

describe('applySpecUpdate', () => {
  it('emits one setField per defined key and skips undefined values', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const spec = makeSpec();
    const result = await applySpecUpdate(
      spec.uid,
      { name: 'Renamed', description: undefined },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle(), mirror: mockMirror(spec) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.name).toBe('Renamed');
    const { batch } = lastPayload();
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: SPEC_ENTITY_TYPE,
      id: spec.uid,
      path: 'name',
      value: 'Renamed',
    });
  });

  it('reports not-found for an unknown uid without firing the bridge', async () => {
    const result = await applySpecUpdate(
      'missing1',
      { name: 'X' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle(), mirror: mockMirror(null) },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('applySpecDelete', () => {
  it('emits a single delete envelope with no side effects', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const spec = makeSpec();
    const result = await applySpecDelete(spec.uid, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(spec),
    });
    expect(result.ok).toBe(true);
    const { batch, sideEffects } = lastPayload();
    expect(sideEffects).toHaveLength(0);
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toEqual({ kind: 'delete', type: SPEC_ENTITY_TYPE, id: spec.uid });
  });

  it('reports not-found for an unknown uid', async () => {
    const result = await applySpecDelete('missing1', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(null),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('applySpecSetFile', () => {
  it('keeps an existing row at its live orderKey', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const spec = makeSpec();
    const result = await applySpecSetFile(spec.uid, makeFile({ content: 'openapi: edited\n' }), {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(spec, ['file0001']),
    });
    expect(result.ok).toBe(true);
    const { batch } = lastPayload();
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: SPEC_ENTITY_TYPE,
      id: spec.uid,
      path: SPEC_FILES_PATH,
      itemId: 'file0001',
      orderKey: 'm',
    });
  });

  it('appends a new row after the current tail', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const spec = makeSpec();
    await applySpecSetFile(spec.uid, makeFile({ uid: 'file0002', fileName: 'shared.yaml' }), {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(spec, ['file0001']),
    });
    const { batch } = lastPayload();
    const body = batch.mutations[0].body as { itemId: string; orderKey?: string };
    expect(body.itemId).toBe('file0002');
    expect(body.orderKey && body.orderKey > 'm').toBe(true);
  });
});

describe('applySpecRemoveFile', () => {
  it('emits removeFromSet keyed by the file uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const spec = makeSpec();
    const result = await applySpecRemoveFile(spec.uid, 'file0001', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(spec, ['file0001']),
    });
    expect(result.ok).toBe(true);
    const { batch } = lastPayload();
    expect(batch.mutations[0].body).toEqual({
      kind: 'removeFromSet',
      type: SPEC_ENTITY_TYPE,
      id: spec.uid,
      path: SPEC_FILES_PATH,
      itemId: 'file0001',
    });
  });
});
