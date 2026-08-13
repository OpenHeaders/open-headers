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
import type { HeaderModification, HeaderRule, Rule } from '@openheaders/core/types';
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

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import type { RendererContextHandle, RuleSyncMirror } from '@openheaders/ui/context';
import {
  applyRuleCreate,
  applyRuleDelete,
  applyRuleToggle,
  applyRuleUpdate,
  IMPORT_ATTRIBUTION_SURFACE_ID,
} from '@openheaders/ui/shared/sync/rule-write-client';

const headerRule: HeaderRule = {
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
  rule: Rule | null,
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
    getRuleMirror: (uid) => (rule && rule.uid === uid ? { rule, setItemIds, setOrderKeys: resolvedOrderKeys } : null),
    listRules: () => (rule ? [rule] : []),
    liveSetItems: (uid, path) => (rule && rule.uid === uid ? (setItemIds[path] ?? []) : []),
    liveOrderedSetItems: (uid, path) => (rule && rule.uid === uid ? (resolvedOrderKeys[path] ?? []) : []),
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
    const newHeaders: HeaderModification[] = [
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

  it('a pure requestHeaders reorder emits a single moveBefore (LIS-optimal)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mods: HeaderModification[] = ['h1', 'h2', 'h3'].map((uid) => ({
      uid,
      operation: 'override',
      headerName: `X-${uid}`,
      value: uid,
    }));
    const ruleWithMods: HeaderRule = {
      ...headerRule,
      action: { requestHeaders: mods, responseHeaders: [] },
    };
    const mirror = makeMirror(ruleWithMods, { 'action.requestHeaders': ['h1', 'h2', 'h3'] });
    await applyRuleUpdate(
      ruleWithMods.uid,
      // Drag h3 to the top — content untouched.
      { action: { requestHeaders: [mods[2], mods[0], mods[1]], responseHeaders: [] } },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    // h1+h2 form the LIS and stay put — only the dragged row moves.
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'moveBefore',
      path: 'action.requestHeaders',
      itemId: 'h3',
    });
    const movedKey = (batch.mutations[0].body as { orderKey: string }).orderKey;
    expect(movedKey < 'm0').toBe(true); // lands before h1's live key
  });

  it('a pure conditions reorder emits a single moveBefore (LIS-optimal)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const conds = ['c1', 'c2', 'c3'].map((uid) => ({
      uid,
      type: 'request-domains' as const,
      values: [`${uid}.openheaders.io`],
    }));
    const ruleWithConds: HeaderRule = { ...headerRule, conditions: conds };
    const mirror = makeMirror(ruleWithConds, { conditions: ['c1', 'c2', 'c3'] });
    await applyRuleUpdate(
      ruleWithConds.uid,
      // Drag c3 to the top — content untouched.
      { conditions: [conds[2], conds[0], conds[1]] },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'moveBefore',
      path: 'conditions',
      itemId: 'c3',
    });
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
  const publishedRule: HeaderRule = { ...headerRule, published: true };

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

describe('applyRuleCreate', () => {
  const createSeed: Omit<HeaderRule, 'uid' | 'path' | 'schemaVersion'> = {
    name: 'New Header Rule',
    enabled: true,
    type: 'header',
    conditions: [],
    action: { requestHeaders: [], responseHeaders: [] },
  };

  it('mints a Create envelope with generated uid + path under parentPath and published:false', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyRuleCreate(
      { rule: createSeed, parentPath: 'rules/coll-abcd1234' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [type, payload] = mockCall.mock.calls[0];
    expect(type).toBe('oh.sync.apply');
    const batch = (payload as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    expect(createEnv).toBeTruthy();
    expect(createEnv?.body).toMatchObject({ kind: 'create', type: RULE_ENTITY_TYPE });
    const created = (createEnv?.body as { payload: HeaderRule }).payload;
    expect(created.uid).toMatch(/^[0-9a-z]{8,}$/);
    expect(created.path.startsWith('rules/coll-abcd1234/')).toBe(true);
    expect(created.path.endsWith(created.uid)).toBe(true);
    expect(created.schemaVersion).toBe(5);
    expect(created.published).toBe(false);
    expect(result.ok && result.rule.uid).toBe(created.uid);
  });

  it('overrides caller-supplied published:true with false — drafts must not arrive published', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyRuleCreate(
      // Seed type omits `published` but we cast through to assert the override path.
      { rule: { ...createSeed, published: true } as typeof createSeed, parentPath: 'rules/c-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    const created = (createEnv?.body as { payload: HeaderRule }).payload;
    expect(created.published).toBe(false);
  });

  it('emits one addToSet envelope per set-modeled member (conditions, headers)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const seedWithMembers: typeof createSeed = {
      ...createSeed,
      conditions: [{ uid: 'tcd00099', type: 'request-domains', values: ['*.openheaders.io'] }],
      action: {
        requestHeaders: [{ uid: 'thm00099', operation: 'override', headerName: 'X-Foo', value: 'bar' }],
        responseHeaders: [],
      },
    };
    await applyRuleCreate(
      { rule: seedWithMembers, parentPath: 'rules/c-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const adds = batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds).toHaveLength(2);
    const paths = adds.map((m) => (m.body as { path: string }).path).sort();
    expect(paths).toEqual(['action.requestHeaders', 'conditions']);
  });

  it('seeds multi-row conditions with strictly increasing orderKeys (creation order survives materialize)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const seedWithConds: typeof createSeed = {
      ...createSeed,
      conditions: ['c1', 'c2', 'c3'].map((uid) => ({
        uid,
        type: 'request-domains' as const,
        values: [`${uid}.openheaders.io`],
      })),
    };
    await applyRuleCreate(
      { rule: seedWithConds, parentPath: 'rules/c-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const keys = batch.mutations
      .filter((m) => m.body.kind === 'addToSet')
      .map((m) => m.body as { itemId: string; orderKey?: string });
    expect(keys.map((k) => k.itemId)).toEqual(['c1', 'c2', 'c3']);
    for (const k of keys) expect(typeof k.orderKey).toBe('string');
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1].orderKey! < keys[i].orderKey!).toBe(true);
    }
  });

  it('returns the bridge error as `other` on transport failure', async () => {
    mockCall.mockRejectedValue(new Error('bridge dead'));
    const result = await applyRuleCreate(
      { rule: createSeed, parentPath: 'rules/c-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: false, reason: 'other', message: 'bridge dead' });
  });
});

describe('applyRuleCreate — rule_created product telemetry', () => {
  const createSeed: Omit<HeaderRule, 'uid' | 'path' | 'schemaVersion'> = {
    name: 'New Header Rule',
    enabled: true,
    type: 'header',
    conditions: [],
    action: { requestHeaders: [], responseHeaders: [] },
  };

  function installTelemetrySpy() {
    const track = vi.fn(async () => ({ success: true }));
    setHostBridge({ call: track } as unknown as HostBridge);
    return track;
  }

  it('records rule_created with the rule type and the editor origin default on a successful create', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const track = installTelemetrySpy();
    await applyRuleCreate(
      { rule: createSeed, parentPath: 'rules/c-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(track).toHaveBeenCalledWith('productTelemetryTrack', {
      event: { name: 'rule_created', ruleType: 'header', origin: 'editor' },
    });
  });

  it('stamps the caller-declared origin — quick-create popovers and empty-state affordances', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const track = installTelemetrySpy();
    await applyRuleCreate(
      { rule: createSeed, parentPath: 'rules/c-1' },
      { workspaceId: 'ws-1', surfaceId: 'devpanel', origin: 'quick-editor', context: makeContextHandle() },
    );
    expect(track).toHaveBeenCalledWith('productTelemetryTrack', {
      event: { name: 'rule_created', ruleType: 'header', origin: 'quick-editor' },
    });
  });

  it('skips the event for import-attributed creates — import_run counts those', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const track = installTelemetrySpy();
    await applyRuleCreate(
      { rule: createSeed, parentPath: 'rules/c-1' },
      {
        workspaceId: 'ws-1',
        surfaceId: IMPORT_ATTRIBUTION_SURFACE_ID,
        context: makeContextHandle('ws-1', IMPORT_ATTRIBUTION_SURFACE_ID),
      },
    );
    expect(track).not.toHaveBeenCalled();
  });

  it('skips the event when the create is rejected', async () => {
    mockCall.mockRejectedValue(new Error('bridge dead'));
    const track = installTelemetrySpy();
    await applyRuleCreate(
      { rule: createSeed, parentPath: 'rules/c-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(track).not.toHaveBeenCalled();
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

  it('returns not-found and does not fire the bridge when the mirror has no entry', async () => {
    const result = await applyRuleDelete('missing', {
      workspaceId: 'ws-1',
      surfaceId: 'popup',
      mirror: makeMirror(null),
      context: makeContextHandle('ws-1', 'popup'),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});
