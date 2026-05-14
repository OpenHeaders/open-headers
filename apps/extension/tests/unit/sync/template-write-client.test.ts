/**
 * Phase B Template — renderer-side write client.
 *
 * Each helper builds a MutationBatch via the shared `template-mutations`
 * factories (which now route the set-modeled `conditions` path through
 * the unified {@link synthesizeSetDiff}), fires `oh.sync.apply` on the
 * bridge, and reports the structured ack back to the caller.
 *
 * Mirrors {@link rule-write-client.test} — the synthesizer is shared
 * across entities so the same correctness claims apply per entity:
 *   - drag-to-front emits exactly one moveBefore (LIS-optimal)
 *   - byte-identical save fires zero envelopes
 *   - content-only edit emits one addToSet at the live orderKey (LWW
 *     supersede; no redundant removeFromSet)
 *   - vanished + new emits exactly removeFromSet + addToSet
 *   - bridge transport errors surface as `{ ok: false, reason: 'other' }`
 *   - missing template short-circuits without firing the bridge
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { advanceHlc, initialHlc, TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { RuleCondition, Template } from '@openheaders/core/types';
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
  applyTemplateDelete,
  applyTemplateUpdate,
} from '@/shared/sync/template-write-client';
import type { TemplateSyncMirror } from '@/context/template-sync-mirror';
import type { RendererContextHandle } from '@/context/renderer-mutator-context';

const baseTemplate: Template = {
  schemaVersion: 5,
  uid: 'tpl-1',
  path: 'templates/col-1/My',
  name: 'My',
  ruleType: 'header',
  icon: '',
  description: '',
  includes: { conditions: true, formValues: true },
  conditions: [],
  formValues: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as unknown as Template;

function makeMirror(
  template: Template | null,
  setItemIds: Record<string, string[]> = {},
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>> = {},
): TemplateSyncMirror {
  // Default order keys: synthesize `{itemId, orderKey: 'm{i}'}` from
  // setItemIds when the test didn't pin specific keys. Tests that care
  // about specific positions pass setOrderKeys explicitly.
  const resolvedOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>> = {
    ...setOrderKeys,
  };
  for (const [path, ids] of Object.entries(setItemIds)) {
    if (resolvedOrderKeys[path]) continue;
    resolvedOrderKeys[path] = ids.map((itemId, i) => ({ itemId, orderKey: `m${i}` }));
  }
  return {
    getTemplateMirror: (uid) =>
      template && template.uid === uid
        ? { template, setItemIds, setOrderKeys: resolvedOrderKeys }
        : null,
    listTemplates: () => (template ? [template] : []),
    liveSetItems: (uid, path) => (template && template.uid === uid ? (setItemIds[path] ?? []) : []),
    liveOrderedSetItems: (uid, path) =>
      template && template.uid === uid ? (resolvedOrderKeys[path] ?? []) : [],
    subscribeTemplateMirror: () => () => undefined,
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

const cond = (uid: string, value: string): RuleCondition =>
  ({ uid, type: 'urlContains', values: [value] }) as unknown as RuleCondition;

describe('applyTemplateUpdate — set-diff via synthesizer', () => {
  it('returns not-found when the mirror has no entry', async () => {
    const result = await applyTemplateUpdate(
      'missing',
      { name: 'x' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror: makeMirror(null), context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('drag-to-front of 3 conditions emits 1 moveBefore (LIS-optimal)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const c1 = cond('cnd00001', 'a');
    const c2 = cond('cnd00002', 'b');
    const c3 = cond('cnd00003', 'c');
    const tpl: Template = { ...baseTemplate, conditions: [c1, c2, c3] };
    const mirror = makeMirror(
      tpl,
      { conditions: ['cnd00001', 'cnd00002', 'cnd00003'] },
      {
        conditions: [
          { itemId: 'cnd00001', orderKey: 'mn' },
          { itemId: 'cnd00002', orderKey: 'mp' },
          { itemId: 'cnd00003', orderKey: 'mr' },
        ],
      },
    );
    await applyTemplateUpdate(
      tpl.uid,
      { conditions: [c3, c1, c2] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const kinds = batch.mutations.map((m) => m.body.kind);
    expect(kinds.filter((k) => k === 'moveBefore')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'removeFromSet')).toHaveLength(0);
    expect(kinds.filter((k) => k === 'addToSet')).toHaveLength(0);
  });

  it('byte-identical conditions save fires zero envelopes (no bridge call)', async () => {
    const c1 = cond('cnd00001', 'a');
    const c2 = cond('cnd00002', 'b');
    const tpl: Template = { ...baseTemplate, conditions: [c1, c2] };
    const mirror = makeMirror(
      tpl,
      { conditions: ['cnd00001', 'cnd00002'] },
      {
        conditions: [
          { itemId: 'cnd00001', orderKey: 'mn' },
          { itemId: 'cnd00002', orderKey: 'mp' },
        ],
      },
    );
    const result = await applyTemplateUpdate(
      tpl.uid,
      { conditions: [c1, c2] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('content-only edit emits one addToSet at the live orderKey, no removeFromSet', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const live = cond('cnd00001', 'old');
    const edited = cond('cnd00001', 'new');
    const tpl: Template = { ...baseTemplate, conditions: [live] };
    const mirror = makeMirror(
      tpl,
      { conditions: ['cnd00001'] },
      { conditions: [{ itemId: 'cnd00001', orderKey: 'mn' }] },
    );
    await applyTemplateUpdate(
      tpl.uid,
      { conditions: [edited] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const bodies = batch.mutations.map((m) => m.body);
    expect(bodies.filter((b) => b.kind === 'removeFromSet')).toHaveLength(0);
    const adds = bodies.filter(
      (b): b is Extract<typeof b, { kind: 'addToSet' }> => b.kind === 'addToSet',
    );
    expect(adds).toHaveLength(1);
    expect(adds[0].itemId).toBe('cnd00001');
    expect(adds[0].orderKey).toBe('mn');
  });

  it('vanished + new emits exactly one removeFromSet + one addToSet', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const live = cond('cnd00001', 'live');
    const fresh = cond('cnd00009', 'fresh');
    const tpl: Template = { ...baseTemplate, conditions: [live] };
    const mirror = makeMirror(
      tpl,
      { conditions: ['cnd00001'] },
      { conditions: [{ itemId: 'cnd00001', orderKey: 'mn' }] },
    );
    await applyTemplateUpdate(
      tpl.uid,
      { conditions: [fresh] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const kinds = batch.mutations.map((m) => m.body.kind);
    expect(kinds.filter((k) => k === 'removeFromSet')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'addToSet')).toHaveLength(1);
  });

  it('emits scalar setField for non-set patches', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(baseTemplate);
    const result = await applyTemplateUpdate(
      baseTemplate.uid,
      { name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: TEMPLATE_ENTITY_TYPE,
      id: baseTemplate.uid,
      path: 'name',
      value: 'Renamed',
    });
  });

  it('surfaces oh.sync.apply transport rejection as `other`', async () => {
    mockCall.mockResolvedValue({
      ok: false,
      outcomes: [],
      failure: { mutationId: 'mut-1', status: 'schema-rejected', detail: 'lock timeout' },
    });
    const mirror = makeMirror(baseTemplate);
    const result = await applyTemplateUpdate(
      baseTemplate.uid,
      { name: 'x' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'other', message: 'lock timeout' });
  });
});

describe('applyTemplateDelete', () => {
  it('emits a delete envelope when the template is mirrored', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(baseTemplate);
    const result = await applyTemplateDelete(baseTemplate.uid, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'delete', id: baseTemplate.uid });
  });

  it('short-circuits to not-found when the mirror has no entry', async () => {
    const mirror = makeMirror(null);
    const result = await applyTemplateDelete('missing', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});
