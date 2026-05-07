/**
 * Phase A W1+W2 — renderer-side write client for Rule mutations.
 *
 * Each helper builds a MutationBatch via the shared `rule-mutations`
 * factories, fires `oh.sync.apply` on the bridge, and reports the
 * structured ack back to the caller. We verify:
 *   - update emits one envelope per scalar leaf and replaces
 *     set-modeled paths via removeFromSet + addToSet
 *   - toggle / delete pass straight through to the catalog factories
 *   - bridge transport errors surface as `{ ok: false, reason: 'other' }`
 *   - missing-rule short-circuits without firing the bridge
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import { advanceHlc, initialHlc, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
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

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  applyRuleDelete,
  applyRuleToggle,
  applyRuleUpdate,
} from '@/shared/sync/rule-write-client';
import type { RuleSyncMirror } from '@/context/rule-sync-mirror';
import type { RendererContextHandle } from '@/context/renderer-mutator-context';

const headerRule: V5.HeaderRule = {
  schemaVersion: 5,
  uid: 'rule-1',
  path: 'rules/My/Header',
  name: 'My Header',
  enabled: true,
  type: 'header',
  conditions: [],
  action: { requestHeaders: [], responseHeaders: [] },
};

function makeMirror(
  rule: V5.Rule | null,
  setItemIds: Record<string, string[]> = {},
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>> = {},
): RuleSyncMirror {
  // Default order keys: synthesize `{itemId, orderKey: 'm{i}'}` from
  // setItemIds when the test didn't pin specific keys. Tests that care
  // about specific positions pass setOrderKeys explicitly.
  const resolvedOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>> = { ...setOrderKeys };
  for (const [path, ids] of Object.entries(setItemIds)) {
    if (resolvedOrderKeys[path]) continue;
    resolvedOrderKeys[path] = ids.map((itemId, i) => ({ itemId, orderKey: `m${i}` }));
  }
  return {
    getRuleMirror: (uid) =>
      rule && rule.uid === uid ? { rule, setItemIds, setOrderKeys: resolvedOrderKeys } : null,
    listRules: () => (rule ? [rule] : []),
    liveSetItems: (uid, path) => (rule && rule.uid === uid ? (setItemIds[path] ?? []) : []),
    liveOrderedSetItems: (uid, path) =>
      rule && rule.uid === uid ? (resolvedOrderKeys[path] ?? []) : [],
    subscribeRuleMirror: () => () => undefined,
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

describe('applyRuleUpdate', () => {
  it('returns not-found when the mirror has no entry for the rule', async () => {
    const mirror = makeMirror(null);
    const result = await applyRuleUpdate(
      'missing',
      { name: 'x' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits scalar setField for `name` and forwards to oh.sync.apply', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(headerRule);
    const result = await applyRuleUpdate(
      headerRule.uid,
      { name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [type, payload] = mockCall.mock.calls[0];
    expect(type).toBe('oh.sync.apply');
    const batch = (payload as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: RULE_ENTITY_TYPE,
      id: headerRule.uid,
      path: 'name',
      value: 'Renamed',
    });
    expect(result.ok && result.rule.name).toBe('Renamed');
  });

  it('replaces requestHeaders via removeFromSet per existing itemId + addToSet per new item', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const live = ['hm-old-1', 'hm-old-2'];
    const mirror = makeMirror(headerRule, { 'action.requestHeaders': live });
    const newHeaders: V5.HeaderModification[] = [
      { uid: 'thm00096', operation: 'override', headerName: 'X-Foo', value: 'bar' },
    ];
    await applyRuleUpdate(
      headerRule.uid,
      { action: { requestHeaders: newHeaders, responseHeaders: [] } },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const kinds = batch.mutations.map((m) => m.body.kind);
    expect(kinds.filter((k) => k === 'removeFromSet')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'addToSet')).toHaveLength(1);
  });

  it('surfaces oh.sync.apply transport rejection as `other`', async () => {
    mockCall.mockResolvedValue({
      ok: false,
      outcomes: [],
      failure: { mutationId: 'mut-1', status: 'schema-rejected', detail: 'lock timeout' },
    });
    const mirror = makeMirror(headerRule);
    const result = await applyRuleUpdate(
      headerRule.uid,
      { name: 'x' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'other', message: 'lock timeout' });
  });
});

describe('applyRuleUpdate auto-unpublish', () => {
  const publishedRule: V5.HeaderRule = { ...headerRule, published: true };

  it('augments a published-rule runtime edit with published: false', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(publishedRule);
    await applyRuleUpdate(
      publishedRule.uid,
      { conditions: [{ uid: 'cond0001', type: 'request-domains', values: ['example.test'] }] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const paths = batch.mutations.map((m) => (m.body as { path?: string }).path);
    expect(paths).toContain('published');
    const publishedSet = batch.mutations.find((m) => (m.body as { path?: string }).path === 'published');
    expect((publishedSet?.body as { value?: unknown }).value).toBe(false);
  });

  it('does NOT auto-unpublish on a metadata-only rename', async () => {
    // Regression: renaming a published rule in the sidebar /
    // breadcrumb is cosmetic and must not drop it back to draft.
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(publishedRule);
    await applyRuleUpdate(
      publishedRule.uid,
      { name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const paths = batch.mutations.map((m) => (m.body as { path?: string }).path);
    expect(paths).toContain('name');
    expect(paths).not.toContain('published');
  });

  it('skips augmentation when the rule is already a draft', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(headerRule); // published omitted = draft
    await applyRuleUpdate(
      headerRule.uid,
      { conditions: [{ uid: 'cond0001', type: 'request-domains', values: ['example.test'] }] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const paths = batch.mutations.map((m) => (m.body as { path?: string }).path);
    expect(paths).not.toContain('published');
  });

  it('respects an explicit published in updates (re-publish via update)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(publishedRule);
    await applyRuleUpdate(
      publishedRule.uid,
      { name: 'Renamed', published: true },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const publishedSet = batch.mutations.find((m) => (m.body as { path?: string }).path === 'published');
    // Caller passed published: true, no auto-flip to false.
    expect((publishedSet?.body as { value?: unknown }).value).toBe(true);
  });
});

describe('applyRuleToggle', () => {
  it('emits one setField on `enabled` + recompileDnr side-effect', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(headerRule);
    const result = await applyRuleToggle(headerRule.uid, false, {
      workspaceId: 'ws-1',
      surfaceId: 'popup',
      mirror,
      context: makeContextHandle('ws-1', 'popup'),
    });
    expect(result).toEqual({ ok: true });
    const payload = mockCall.mock.calls[0][1] as { batch: MutationBatch; sideEffects: unknown[] };
    expect(payload.batch.mutations).toHaveLength(1);
    expect(payload.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'enabled',
      value: false,
    });
    expect(payload.sideEffects).toHaveLength(1);
  });

  it('returns not-found when the mirror has no entry', async () => {
    const result = await applyRuleToggle('missing', true, {
      workspaceId: 'ws-1',
      surfaceId: 'popup',
      mirror: makeMirror(null),
      context: makeContextHandle('ws-1', 'popup'),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('applyRuleDelete', () => {
  it('emits a delete envelope', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror(headerRule);
    const result = await applyRuleDelete(headerRule.uid, {
      workspaceId: 'ws-1',
      surfaceId: 'popup',
      mirror,
      context: makeContextHandle('ws-1', 'popup'),
    });
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'delete', id: headerRule.uid });
  });

  it('returns the bridge error as `other`', async () => {
    mockCall.mockRejectedValue(new Error('bridge dead'));
    const mirror = makeMirror(headerRule);
    const result = await applyRuleDelete(headerRule.uid, {
      workspaceId: 'ws-1',
      surfaceId: 'popup',
      mirror,
      context: makeContextHandle('ws-1', 'popup'),
    });
    expect(result).toEqual({ ok: false, reason: 'other', message: 'bridge dead' });
  });
});
