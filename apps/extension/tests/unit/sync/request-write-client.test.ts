/**
 * Renderer-side write client for Request mutations.
 *
 * The slice's correctness depends on the renderer adapter inside
 * `request-write-client.ts` correctly threading `(itemId, orderKey,
 * item)` triplets from the mirror into `synthesizeSetDiff` so the
 * minimum-diff plan lands on the wire. These tests exercise the
 * renderer side end-to-end:
 *   - drag-to-front of a 3-row list emits exactly one `moveBefore`
 *     (LIS-optimal)
 *   - byte-identical save fires no envelopes (mirror short-circuits)
 *   - mixed gestures (reorder + content edit) emit no `removeFromSet`
 *     and the content-edit lands as a single `addToSet` carrying both
 *     item + orderKey
 *   - bridge transport rejection surfaces as `{ ok: false, reason: 'other' }`
 *   - missing-request short-circuits without firing the bridge
 */

import type { AddToSetMutation, MoveBeforeMutation, MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { advanceHlc, initialHlc } from '@openheaders/core/sync';
import type { Request, RequestHeader } from '@openheaders/core/types';
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

import { applyRequestUpdate } from '@openheaders/ui/shared/sync/request-write-client';
import type { RequestSyncMirror } from '@openheaders/ui/context';
import type { RendererContextHandle } from '@openheaders/ui/context';

type LiveOrdered = Array<{ itemId: string; orderKey: string }>;

function makeMirror(request: Request, ordered: Record<string, LiveOrdered>): RequestSyncMirror {
  return {
    getRequestMirror: (uid) =>
      uid === request.uid
        ? {
            request,
            setItemIds: Object.fromEntries(
              Object.entries(ordered).map(([k, v]) => [k, v.map((e) => e.itemId)]),
            ),
            setOrderKeys: ordered,
          }
        : null,
    listRequests: () => [request],
    liveSetItems: (uid, path) => (uid === request.uid ? (ordered[path]?.map((e) => e.itemId) ?? []) : []),
    liveOrderedSetItems: (uid, path) => (uid === request.uid ? (ordered[path] ?? []) : []),
    subscribeRequestMirror: () => () => undefined,
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

function header(uid: string, key: string, value: string): RequestHeader {
  return { uid, key, value, enabled: true };
}

function baseRequest(headers: RequestHeader[]): Request {
  return {
    schemaVersion: 5,
    uid: 'rq-1',
    path: 'requests/My/Auth',
    name: 'Auth',
    method: 'GET',
    url: 'https://api.openheaders.io/v1/me',
    headers,
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
  } as Request;
}

beforeEach(() => mockCall.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('applyRequestUpdate — set-modeled paths via shared synthesizer', () => {
  it('emits exactly one moveBefore for drag-to-front of 3 rows (LIS-optimal)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const live: RequestHeader[] = [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b'), header('h3', 'X-C', 'c')];
    const ordered: LiveOrdered = [
      { itemId: 'h1', orderKey: 'h' },
      { itemId: 'h2', orderKey: 'm' },
      { itemId: 'h3', orderKey: 't' },
    ];
    const mirror = makeMirror(baseRequest(live), { headers: ordered });
    const result = await applyRequestUpdate(
      'rq-1',
      { headers: [header('h3', 'X-C', 'c'), header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(1);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    const body = batch.mutations[0].body as MoveBeforeMutation;
    expect(body.kind).toBe('moveBefore');
    expect(body.itemId).toBe('h3');
  });

  it('fires no envelopes when the save is byte-identical (mirror short-circuits via empty batch)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const live: RequestHeader[] = [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')];
    const ordered: LiveOrdered = [
      { itemId: 'h1', orderKey: 'h' },
      { itemId: 'h2', orderKey: 'm' },
    ];
    const mirror = makeMirror(baseRequest(live), { headers: ordered });
    const result = await applyRequestUpdate(
      'rq-1',
      { headers: [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    // applyPayload short-circuits when the batch is empty — no bridge call.
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one addToSet (no removeFromSet) for a content-only edit, preserving the live orderKey', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const live: RequestHeader[] = [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')];
    const ordered: LiveOrdered = [
      { itemId: 'h1', orderKey: 'h' },
      { itemId: 'h2', orderKey: 'm' },
    ];
    const mirror = makeMirror(baseRequest(live), { headers: ordered });
    await applyRequestUpdate(
      'rq-1',
      { headers: [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'EDITED')] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    const body = batch.mutations[0].body as AddToSetMutation;
    expect(body.kind).toBe('addToSet');
    expect(body.itemId).toBe('h2');
    expect(body.orderKey).toBe('m');
    expect((body.item as RequestHeader).value).toBe('EDITED');
  });

  it('handles mixed gesture (drag + content edit) without redundant removeFromSet', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const live: RequestHeader[] = [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b'), header('h3', 'X-C', 'c')];
    const ordered: LiveOrdered = [
      { itemId: 'h1', orderKey: 'h' },
      { itemId: 'h2', orderKey: 'm' },
      { itemId: 'h3', orderKey: 't' },
    ];
    const mirror = makeMirror(baseRequest(live), { headers: ordered });
    await applyRequestUpdate(
      'rq-1',
      // h3 to front + h2 content edit + h1 unchanged.
      { headers: [header('h3', 'X-C', 'c'), header('h2', 'X-B', 'EDITED'), header('h1', 'X-A', 'a')] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const kinds = batch.mutations.map((m) => m.body.kind);
    expect(kinds.filter((k) => k === 'removeFromSet')).toHaveLength(0);
    // Content-edited row's addToSet must carry the new value.
    const adds = batch.mutations.map((m) => m.body).filter((b): b is AddToSetMutation => b.kind === 'addToSet');
    const h2Add = adds.find((a) => a.itemId === 'h2');
    expect(h2Add).toBeDefined();
    expect((h2Add!.item as RequestHeader).value).toBe('EDITED');
    expect(typeof h2Add!.orderKey).toBe('string');
  });

  it('emits removeFromSet only for vanished uids; new uids land as addToSet with explicit orderKey', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const live: RequestHeader[] = [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')];
    const ordered: LiveOrdered = [
      { itemId: 'h1', orderKey: 'h' },
      { itemId: 'h2', orderKey: 'm' },
    ];
    const mirror = makeMirror(baseRequest(live), { headers: ordered });
    await applyRequestUpdate(
      'rq-1',
      { headers: [header('h1', 'X-A', 'a'), header('h3', 'X-C', 'c')] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const removes = batch.mutations.map((m) => m.body).filter((b) => b.kind === 'removeFromSet');
    const adds = batch.mutations.map((m) => m.body).filter((b): b is AddToSetMutation => b.kind === 'addToSet');
    expect(removes.map((r) => 'itemId' in r ? r.itemId : '')).toEqual(['h2']);
    expect(adds.map((a) => a.itemId)).toEqual(['h3']);
    expect(typeof adds[0].orderKey).toBe('string');
  });

  it('returns not-found when the mirror has no entry for the request', async () => {
    const mirror = makeMirror(baseRequest([]), {});
    const result = await applyRequestUpdate(
      'missing',
      { name: 'x' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('surfaces transport rejection as `other`', async () => {
    mockCall.mockResolvedValue({
      ok: false,
      outcomes: [],
      failure: { mutationId: 'mut-1', status: 'schema-rejected', detail: 'lock timeout' },
    });
    const mirror = makeMirror(baseRequest([]), {});
    const result = await applyRequestUpdate(
      'rq-1',
      { name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'other', message: 'lock timeout' });
  });
});
