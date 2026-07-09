/**
 * Renderer-side write client for ResponseExample mutations.
 *
 * Examples are frozen snapshots, so the write surface is create /
 * rename / duplicate / delete only. We verify:
 *   - nextExampleName stacks "Name", "Name 2", "Name 3" without gaps
 *   - create mints identity (uid + `<requestPath>/examples/<slug>-<uid>`
 *     path) and emits a create envelope on the response-example entity
 *   - rename returns `not-found` when the mirror has no entry; success
 *     emits one setField at path="name"
 *   - duplicate re-creates the captured blocks under a fresh identity
 *     with the next free name
 *   - delete short-circuits to `not-found` when the mirror has no entry
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { advanceHlc, initialHlc, RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ResponseExample } from '@openheaders/core/types';
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

import type { RendererContextHandle, ResponseExampleSyncMirror } from '@openheaders/ui/context';
import {
  applyResponseExampleCreate,
  applyResponseExampleDelete,
  applyResponseExampleDuplicate,
  applyResponseExampleRename,
  nextExampleName,
} from '@openheaders/ui/shared/sync/response-example-write-client';

function makeExample(uid: string, overrides: Partial<ResponseExample> = {}): ResponseExample {
  return {
    schemaVersion: 5,
    uid,
    path: `requests/api-rc1/list-users-${uid}/examples/list-users-${uid}`,
    requestUid: 'req-1',
    name: 'List Users',
    capturedAt: '2026-07-09T10:00:00.000Z',
    request: {
      method: 'GET',
      url: 'https://api.openheaders.io/users',
      headers: [{ uid: 'h1', key: 'Accept', value: 'application/json' }],
      params: [],
      body: { type: 'none' },
    },
    response: {
      status: 200,
      statusText: 'OK',
      url: 'https://api.openheaders.io/users',
      headers: [{ key: 'content-type', value: 'application/json' }],
      body: '[{"id":1}]',
      bodyTruncated: false,
      bodyBytes: 10,
      durationMs: 42,
    },
    ...overrides,
  };
}

function makeMirror(examples: ResponseExample[] = []): ResponseExampleSyncMirror {
  return {
    getResponseExampleMirror: (uid) => {
      const responseExample = examples.find((e) => e.uid === uid);
      return responseExample ? { responseExample } : null;
    },
    listResponseExamples: () => examples,
    listResponseExamplesForRequest: (requestUid) => examples.filter((e) => e.requestUid === requestUid),
    subscribeResponseExampleMirror: () => () => undefined,
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

describe('nextExampleName', () => {
  it('returns the base name when untaken', () => {
    expect(nextExampleName(makeMirror([]), 'req-1', 'List Users')).toBe('List Users');
  });

  it('stacks "Name 2", "Name 3" over taken siblings', () => {
    const mirror = makeMirror([
      makeExample('rex-1', { name: 'List Users' }),
      makeExample('rex-2', { name: 'List Users 2' }),
    ]);
    expect(nextExampleName(mirror, 'req-1', 'List Users')).toBe('List Users 3');
  });

  it('scopes taken names to the parent request', () => {
    const mirror = makeMirror([makeExample('rex-1', { requestUid: 'req-other', name: 'List Users' })]);
    expect(nextExampleName(mirror, 'req-1', 'List Users')).toBe('List Users');
  });
});

describe('applyResponseExampleCreate', () => {
  it('mints identity and emits a create envelope on the response-example entity', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const source = makeExample('unused');
    const result = await applyResponseExampleCreate(
      {
        requestPath: 'requests/api-rc1/list-users-req-1',
        example: {
          requestUid: source.requestUid,
          name: source.name,
          capturedAt: source.capturedAt,
          request: source.request,
          response: source.response,
        },
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror: makeMirror([]), context: makeContextHandle() },
    );
    if (!result.ok) throw new Error('expected ok');
    expect(result.responseExample.uid).toBeTruthy();
    expect(result.responseExample.schemaVersion).toBe(5);
    expect(result.responseExample.path).toBe(
      `requests/api-rc1/list-users-req-1/examples/list-users-${result.responseExample.uid}`,
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    expect(createEnv?.body).toMatchObject({
      kind: 'create',
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: result.responseExample.uid,
    });
  });
});

describe('applyResponseExampleRename', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const result = await applyResponseExampleRename('missing', 'X', {
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
    const mirror = makeMirror([makeExample('rex-1')]);
    const result = await applyResponseExampleRename('rex-1', 'Renamed', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.responseExample.name).toBe('Renamed');
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'rex-1',
      path: 'name',
      value: 'Renamed',
    });
  });
});

describe('applyResponseExampleDuplicate', () => {
  it('returns not-found when the source is missing', async () => {
    const result = await applyResponseExampleDuplicate('missing', {
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
    const source = makeExample('rex-1', {
      path: 'requests/api-rc1/list-users-req-1/examples/list-users-rex-1',
    });
    const mirror = makeMirror([source]);
    const result = await applyResponseExampleDuplicate('rex-1', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.responseExample.uid).not.toBe('rex-1');
    expect(result.responseExample.name).toBe('List Users 2');
    expect(result.responseExample.requestUid).toBe('req-1');
    expect(result.responseExample.request).toEqual(source.request);
    expect(result.responseExample.response).toEqual(source.response);
    expect(result.responseExample.path.startsWith('requests/api-rc1/list-users-req-1/examples/')).toBe(true);
  });
});

describe('applyResponseExampleDelete', () => {
  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const result = await applyResponseExampleDelete('missing', {
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
    const mirror = makeMirror([makeExample('rex-1')]);
    const result = await applyResponseExampleDelete('rex-1', {
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
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'rex-1',
    });
  });
});
