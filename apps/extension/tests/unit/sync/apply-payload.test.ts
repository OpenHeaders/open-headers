/**
 * Direct tests for the shared `apply-payload` module — the helpers
 * 17 renderer write-clients delegate to. Coverage sits at the contract
 * level so individual write-client tests can trust the shared layer
 * instead of re-asserting it everywhere.
 *
 * Contract surface:
 *   - `applySyncPayload`:
 *       • empty-batch short-circuit returns `{ ok: true }` without
 *         firing the bridge (every entity's `buildUpdateBatch` may emit
 *         zero envelopes for a no-op patch).
 *       • bridge `ok: true` ack collapses to `{ ok: true }`.
 *       • bridge `ok: false` ack collapses to
 *         `{ ok: false, reason: 'other', message: failure.detail }`.
 *       • thrown bridge error collapses to
 *         `{ ok: false, reason: 'other', message: err.message }`.
 *   - `resolveRendererContext`:
 *       • returns `opts.context` verbatim when supplied (test-injected handle).
 *       • falls back to `ensureRendererContext({ workspaceId, surfaceId })`
 *         when omitted.
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { advanceHlc, initialHlc } from '@openheaders/core/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@utils/bridge', () => ({
  call: mockCall,
  subscribe: vi.fn(() => () => undefined),
  broadcast: vi.fn(),
  receive: vi.fn(),
  presence: vi.fn(),
  tabCall: vi.fn(),
}));

import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
} from '@/shared/sync/apply-payload';
import {
  ensureRendererContext,
  setActiveRendererContext,
  type RendererContextHandle,
} from '@/context/renderer-mutator-context';

function makeBatch(mutationCount: number): MutationBatch {
  return {
    batchId: `batch-${mutationCount}`,
    mutations: Array.from({ length: mutationCount }, (_, i) => ({
      mutationId: `m-${i}`,
      hlc: { physicalMs: i, logical: 0, nodeId: 'n0' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: 'ws-1',
      mutatorVersion: 1,
      body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'x' },
    })),
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
  setActiveRendererContext(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  setActiveRendererContext(null);
});

describe('applySyncPayload', () => {
  it('empty batch short-circuits to { ok: true } without firing the bridge', async () => {
    const result = await applySyncPayload({ batch: makeBatch(0), sideEffects: [] });
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('bridge ok: true collapses to { ok: true } and forwards the payload verbatim', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const batch = makeBatch(1);
    const result = await applySyncPayload({ batch, sideEffects: [{ kind: 'recompile-dnr', key: 'r1', hlc: batch.mutations[0].hlc }] });
    expect(result).toEqual({ ok: true });
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [type, payload] = mockCall.mock.calls[0];
    expect(type).toBe('oh.sync.apply');
    expect((payload as { batch: MutationBatch }).batch).toBe(batch);
  });

  it("bridge ok: false collapses to 'other' with the failure detail", async () => {
    mockCall.mockResolvedValue({
      ok: false,
      outcomes: [],
      failure: { mutationId: 'm-0', status: 'schema-rejected', detail: 'lock timeout' },
    });
    const result = await applySyncPayload({ batch: makeBatch(1), sideEffects: [] });
    expect(result).toEqual({ ok: false, reason: 'other', message: 'lock timeout' });
  });

  it("thrown bridge error collapses to 'other' carrying err.message", async () => {
    mockCall.mockRejectedValue(new Error('bridge dead'));
    const result = await applySyncPayload({ batch: makeBatch(1), sideEffects: [] });
    expect(result).toEqual({ ok: false, reason: 'other', message: 'bridge dead' });
  });

  it("thrown non-Error value collapses to 'other' with 'unknown error'", async () => {
    // String reject value — covers the `instanceof Error` false branch.
    mockCall.mockRejectedValue('disconnected');
    const result = await applySyncPayload({ batch: makeBatch(1), sideEffects: [] });
    expect(result).toEqual({ ok: false, reason: 'other', message: 'unknown error' });
  });
});

describe('resolveRendererContext', () => {
  it('returns opts.context verbatim when supplied', () => {
    const handle = makeContextHandle();
    const opts: BaseSyncWriteOptions = { workspaceId: 'ws-1', surfaceId: 'workbench', context: handle };
    expect(resolveRendererContext(opts)).toBe(handle);
  });

  it('falls back to the singleton renderer context when opts.context is omitted', () => {
    const opts: BaseSyncWriteOptions = { workspaceId: 'ws-1', surfaceId: 'popup' };
    const resolved = resolveRendererContext(opts);
    // Singleton was just minted via ensureRendererContext.
    expect(resolved.workspaceId).toBe('ws-1');
    expect(resolved.surfaceId).toBe('popup');
    // Calling again with the same workspace+surface returns the same handle.
    expect(resolveRendererContext(opts)).toBe(resolved);
  });

  it('rebuilds the singleton when workspaceId or surfaceId changes', () => {
    const a = resolveRendererContext({ workspaceId: 'ws-A', surfaceId: 'workbench' });
    const b = resolveRendererContext({ workspaceId: 'ws-B', surfaceId: 'workbench' });
    expect(a).not.toBe(b);
    expect(b.workspaceId).toBe('ws-B');
  });

  it('uses ensureRendererContext as the singleton authority', () => {
    // Pre-mint via ensureRendererContext and confirm resolveRendererContext returns the same instance.
    const handle = ensureRendererContext({ workspaceId: 'ws-1', surfaceId: 'workbench' });
    const resolved = resolveRendererContext({ workspaceId: 'ws-1', surfaceId: 'workbench' });
    expect(resolved).toBe(handle);
  });
});

describe('resolveMirror', () => {
  it('returns opts.mirror verbatim when supplied', () => {
    const mirror = { tag: 'injected' };
    const getActive = vi.fn(() => ({ tag: 'singleton' }));
    expect(resolveMirror({ mirror }, getActive)).toBe(mirror);
    expect(getActive).not.toHaveBeenCalled();
  });

  it('falls back to getActive when opts.mirror is omitted', () => {
    const singleton = { tag: 'singleton' };
    const getActive = vi.fn(() => singleton);
    expect(resolveMirror({}, getActive)).toBe(singleton);
    expect(getActive).toHaveBeenCalledTimes(1);
  });
});
