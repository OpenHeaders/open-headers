/**
 * Renderer-side write client for GrpcResponseExample mutations — the
 * response-example-write-client suite mirrored onto the gRPC family.
 *
 * We verify:
 *   - nextGrpcExampleName stacks "Name", "Name 2", "Name 3" without gaps
 *   - create mints identity (uid + `<grpcRequestPath>/examples/<slug>-<uid>`
 *     path) and emits a create envelope on the grpcResponseExample entity
 *   - rename returns `not-found` when the mirror has no entry; success
 *     emits one setField at path="name"
 *   - update patches the captured `request` / `response` blocks as
 *     whole-block setFields, only for the keys provided
 *   - duplicate re-creates the captured blocks under a fresh identity
 *     with the next free name
 *   - delete short-circuits to `not-found` when the mirror has no entry
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { advanceHlc, GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, initialHlc } from '@openheaders/core/sync';
import type { GrpcResponseExample } from '@openheaders/core/types';
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

import type { GrpcResponseExampleSyncMirror, RendererContextHandle } from '@openheaders/ui/context';
import type { GrpcRequestSyncMirror } from '@openheaders/ui/context/mirrors/grpc-request-sync-mirror';
import { applyGrpcRequestDelete } from '@openheaders/ui/shared/sync/grpc-request-write-client';
import {
  applyGrpcResponseExampleCreate,
  applyGrpcResponseExampleDelete,
  applyGrpcResponseExampleDuplicate,
  applyGrpcResponseExampleRename,
  applyGrpcResponseExampleUpdate,
  nextGrpcExampleName,
} from '@openheaders/ui/shared/sync/grpc-response-example-write-client';

function makeExample(uid: string, overrides: Partial<GrpcResponseExample> = {}): GrpcResponseExample {
  return {
    schemaVersion: 5,
    uid,
    path: `requests/api-rc1/get-book-${uid}/examples/get-book-${uid}`,
    grpcRequestUid: 'grq00001',
    name: 'GetBook',
    capturedAt: '2026-07-17T10:00:00.000Z',
    request: {
      url: 'grpc.openheaders.io:443',
      tls: true,
      sslVerification: true,
      method: { service: 'library.v1.Library', rpc: 'GetBook' },
      metadata: [{ uid: 'md000001', key: 'x-trace', value: 'abc' }],
      message: '{"name":"books/1"}',
    },
    response: {
      grpcStatus: 0,
      statusSource: 'trailers',
      metadata: [{ key: 'content-type', value: 'application/grpc+proto' }],
      trailers: [],
      messages: [{ dataBase64: 'Cgdib29rcy8x', compressed: false }],
      bodyTruncated: false,
      bodyBytes: 14,
      durationMs: 42,
    },
    ...overrides,
  };
}

function makeMirror(examples: GrpcResponseExample[] = []): GrpcResponseExampleSyncMirror {
  return {
    getGrpcResponseExampleMirror: (uid) => {
      const grpcResponseExample = examples.find((e) => e.uid === uid);
      return grpcResponseExample ? { grpcResponseExample } : null;
    },
    listGrpcResponseExamples: () => examples,
    listGrpcResponseExamplesForRequest: (grpcRequestUid) => examples.filter((e) => e.grpcRequestUid === grpcRequestUid),
    subscribeGrpcResponseExampleMirror: () => () => undefined,
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

describe('nextGrpcExampleName', () => {
  it('returns the base name when untaken', () => {
    expect(nextGrpcExampleName(makeMirror([]), 'grq00001', 'GetBook')).toBe('GetBook');
  });

  it('stacks "Name 2", "Name 3" over taken siblings', () => {
    const mirror = makeMirror([
      makeExample('gexx0001', { name: 'GetBook' }),
      makeExample('gexx0002', { name: 'GetBook 2' }),
    ]);
    expect(nextGrpcExampleName(mirror, 'grq00001', 'GetBook')).toBe('GetBook 3');
  });

  it('scopes taken names to the parent request', () => {
    const mirror = makeMirror([makeExample('gexx0001', { grpcRequestUid: 'grqother', name: 'GetBook' })]);
    expect(nextGrpcExampleName(mirror, 'grq00001', 'GetBook')).toBe('GetBook');
  });
});

describe('applyGrpcResponseExampleCreate', () => {
  it('mints identity and emits a create envelope on the grpcResponseExample entity', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const source = makeExample('unusedxx');
    const result = await applyGrpcResponseExampleCreate(
      {
        grpcRequestPath: 'requests/api-rc1/get-book-grq00001',
        example: {
          grpcRequestUid: source.grpcRequestUid,
          name: source.name,
          capturedAt: source.capturedAt,
          request: source.request,
          response: source.response,
        },
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror: makeMirror([]), context: makeContextHandle() },
    );
    if (!result.ok) throw new Error('expected ok');
    expect(result.grpcResponseExample.uid).toBeTruthy();
    expect(result.grpcResponseExample.schemaVersion).toBe(5);
    expect(result.grpcResponseExample.path).toBe(
      `requests/api-rc1/get-book-grq00001/examples/getbook-${result.grpcResponseExample.uid}`,
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    expect(createEnv?.body).toMatchObject({
      kind: 'create',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: result.grpcResponseExample.uid,
    });
  });
});

describe('applyGrpcResponseExampleRename', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const result = await applyGrpcResponseExampleRename('missingx', 'X', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror: makeMirror([]),
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one setField at path="name" on success', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([makeExample('gexx0001')]);
    const result = await applyGrpcResponseExampleRename('gexx0001', 'Renamed', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.grpcResponseExample.name).toBe('Renamed');
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'gexx0001',
      path: 'name',
      value: 'Renamed',
    });
  });
});

describe('applyGrpcResponseExampleUpdate', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const result = await applyGrpcResponseExampleUpdate(
      'missingx',
      { response: makeExample('unusedxx').response },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror: makeMirror([]), context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one whole-block setField per provided captured block', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const source = makeExample('gexx0001');
    const editedRequest = { ...source.request, message: '{"name":"books/2"}' };
    const editedResponse = { ...source.response, grpcStatus: 5 as number | null };
    const result = await applyGrpcResponseExampleUpdate(
      'gexx0001',
      { request: editedRequest, response: editedResponse },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror: makeMirror([source]), context: makeContextHandle() },
    );
    if (!result.ok) throw new Error('expected ok');
    expect(result.grpcResponseExample.request).toEqual(editedRequest);
    expect(result.grpcResponseExample.response).toEqual(editedResponse);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(2);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'gexx0001',
      path: 'request',
      value: editedRequest,
    });
    expect(batch.mutations[1].body).toMatchObject({
      kind: 'setField',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'gexx0001',
      path: 'response',
      value: editedResponse,
    });
  });

  it('patches only the provided block', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const source = makeExample('gexx0001');
    const editedRequest = { ...source.request, url: 'grpc.openheaders.io:8443' };
    const result = await applyGrpcResponseExampleUpdate(
      'gexx0001',
      { request: editedRequest },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror: makeMirror([source]), context: makeContextHandle() },
    );
    if (!result.ok) throw new Error('expected ok');
    expect(result.grpcResponseExample.response).toEqual(source.response);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'setField', path: 'request' });
  });
});

describe('applyGrpcResponseExampleDuplicate', () => {
  it('returns not-found when the source is missing', async () => {
    const result = await applyGrpcResponseExampleDuplicate('missingx', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror: makeMirror([]),
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('re-creates the captured blocks under a fresh identity with the next free name', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const source = makeExample('gexx0001', {
      path: 'requests/api-rc1/get-book-grq00001/examples/get-book-gexx0001',
    });
    const mirror = makeMirror([source]);
    const result = await applyGrpcResponseExampleDuplicate('gexx0001', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.grpcResponseExample.uid).not.toBe('gexx0001');
    expect(result.grpcResponseExample.name).toBe('GetBook 2');
    expect(result.grpcResponseExample.grpcRequestUid).toBe('grq00001');
    expect(result.grpcResponseExample.request).toEqual(source.request);
    expect(result.grpcResponseExample.response).toEqual(source.response);
    expect(result.grpcResponseExample.path.startsWith('requests/api-rc1/get-book-grq00001/examples/')).toBe(true);
  });
});

describe('applyGrpcRequestDelete — example cascade', () => {
  function makeGrpcRequestMirror(uids: string[]): GrpcRequestSyncMirror {
    return {
      getGrpcRequestMirror: (uid) =>
        uids.includes(uid)
          ? {
              grpcRequest: {
                schemaVersion: 5,
                uid,
                path: `requests/api-rc1/get-book-${uid}`,
                name: 'GetBook',
                url: 'grpc.openheaders.io:443',
                message: '',
                metadata: [],
              },
              setItemIds: {},
              setOrderKeys: {},
            }
          : null,
      listGrpcRequests: () => [],
      liveSetItems: () => [],
      liveOrderedSetItems: () => [],
      subscribeGrpcRequestMirror: () => () => undefined,
      subscribeAny: () => () => undefined,
      hydrated: Promise.resolve(),
      dispose: () => undefined,
    };
  }

  it('tombstones every example owned by the request before deleting it', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const exampleMirror = makeMirror([
      makeExample('gexx0001', { grpcRequestUid: 'grq00001' }),
      makeExample('gexx0002', { grpcRequestUid: 'grq00001' }),
      makeExample('gexx0003', { grpcRequestUid: 'grqother' }),
    ]);
    const result = await applyGrpcRequestDelete('grq00001', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror: makeGrpcRequestMirror(['grq00001']),
      exampleMirror,
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: true });
    const deletes = mockCall.mock.calls.map((c) => (c[1] as { batch: MutationBatch }).batch.mutations[0].body);
    expect(deletes).toEqual([
      { kind: 'delete', type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'gexx0001' },
      { kind: 'delete', type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'gexx0002' },
      { kind: 'delete', type: 'grpcRequest', id: 'grq00001' },
    ]);
  });
});

describe('applyGrpcResponseExampleDelete', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const result = await applyGrpcResponseExampleDelete('missingx', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror: makeMirror([]),
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one delete envelope on success', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([makeExample('gexx0001')]);
    const result = await applyGrpcResponseExampleDelete('gexx0001', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'delete',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'gexx0001',
    });
  });
});
