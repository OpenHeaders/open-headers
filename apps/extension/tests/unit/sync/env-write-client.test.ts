/**
 * Renderer-side write client for Environment mutations.
 *
 * Each helper builds a `MutationBatch` via the shared `env-mutations`
 * factories, fires `oh.sync.apply` on the bridge, and reports the
 * structured ack back to the caller. We verify:
 *   - create mints a uid, trims the name (empty → "Untitled Environment"),
 *     emits a `create` envelope + one `addToSet` per seeded variable,
 *     and rides one INVALIDATE_RESOLVER side-effect
 *   - rename emits one setField at path="name"
 *   - setVar / removeVar emit addToSet / removeFromSet keyed by
 *     variable.uid at the variables set path
 *   - delete emits a single `delete` envelope + INVALIDATE_RESOLVER
 *   - variablesReplacement folds add / edit / remove into one batch
 *     keyed by variable.uid; byte-identical entries are skipped;
 *     entries with whitespace-only names are dropped
 */

import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import { advanceHlc, ENV_VARS_PATH, ENVIRONMENT_ENTITY_TYPE, initialHlc } from '@openheaders/core/sync';
import type { Variable } from '@openheaders/core/types';
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
import {
  applyEnvironmentCreate,
  applyEnvironmentDelete,
  applyEnvRemoveVar,
  applyEnvSetVar,
  applyEnvVariablesReplacement,
  applyRenameEnvironment,
  type EnvSyncMirror,
} from '@openheaders/ui/shared/sync/env-write-client';

/** Minimal EnvSyncMirror stub — supplies the current per-uid order keys
 *  the replacement helper reads to preserve row position. Keys are a
 *  monotonic single-char sequence in the given uid order. */
function mockMirror(orderedUids: readonly string[]): EnvSyncMirror {
  const entries = orderedUids.map((uid, i) => ({ itemId: uid, orderKey: String.fromCharCode(0x6d + i) }));
  return {
    hydrated: Promise.resolve(),
    liveVarOrderKeys: () => entries,
    getEnvironmentMirror: () => null,
    liveVarNames: () => [],
    subscribeEnvironmentMirror: () => () => undefined,
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

function variable(uid: string, name: string, value: string, type: 'default' | 'secret' = 'default'): Variable {
  return { uid, name, value, type };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyEnvironmentCreate', () => {
  it('emits a create envelope with a generated uid + trimmed name; an empty environment derives no side-effect', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyEnvironmentCreate(
      { name: '  dev  ' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    const payload = mockCall.mock.calls[0][1] as { batch: MutationBatch; sideEffects: SideEffectIntent[] };
    const createEnv = payload.batch.mutations.find((m) => m.body.kind === 'create');
    expect(createEnv?.body).toMatchObject({ kind: 'create', type: ENVIRONMENT_ENTITY_TYPE });
    const created = (createEnv?.body as { payload: { uid: string; name: string } }).payload;
    expect(created.uid).toMatch(/^[0-9a-z]{8,}$/);
    expect(created.name).toBe('dev');
    expect(result.ok && result.environment.uid).toBe(created.uid);
    // A bare create-shell carries no variables, so the resolver is
    // unaffected — side effects single-source from the minted batch.
    expect(payload.sideEffects).toHaveLength(0);
  });

  it('falls back to "Untitled Environment" on a whitespace-only name', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyEnvironmentCreate(
      { name: '   ' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const createEnv = batch.mutations.find((m) => m.body.kind === 'create');
    const created = (createEnv?.body as { payload: { name: string } }).payload;
    expect(created.name).toBe('Untitled Environment');
  });

  it('emits one addToSet per seeded variable in the create batch', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyEnvironmentCreate(
      {
        name: 'dev',
        variables: [variable('v1', 'API_HOST', 'api.openheaders.io'), variable('v2', 'TOKEN', 'abc', 'secret')],
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const payload = mockCall.mock.calls[0][1] as { batch: MutationBatch; sideEffects: SideEffectIntent[] };
    const adds = payload.batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds).toHaveLength(2);
    const ids = adds.map((m) => (m.body as { itemId: string }).itemId).sort();
    expect(ids).toEqual(['v1', 'v2']);
    // Seeded rows carry strictly increasing orderKeys so a multi-row
    // create materializes in creation order, not the uid tie-break.
    const keys = adds.map((m) => (m.body as { orderKey?: string }).orderKey);
    for (const k of keys) expect(typeof k).toBe('string');
    expect(keys[0]! < keys[1]!).toBe(true);
    // A seeded variable invalidates the resolver — single-sourced from
    // the addToSet envelopes the seed batch carries.
    expect(payload.sideEffects.length).toBeGreaterThan(0);
  });
});

describe('applyEnvironmentDelete', () => {
  it('emits one delete envelope on the environment entity + INVALIDATE_RESOLVER side-effect', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyEnvironmentDelete(
      { envId: 'env-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const payload = mockCall.mock.calls[0][1] as { batch: MutationBatch; sideEffects: SideEffectIntent[] };
    expect(payload.batch.mutations).toHaveLength(1);
    expect(payload.batch.mutations[0].body).toMatchObject({
      kind: 'delete',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-1',
    });
    expect(payload.sideEffects).toHaveLength(1);
  });
});

describe('applyRenameEnvironment', () => {
  it('emits one setField at path="name"', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyRenameEnvironment(
      { envId: 'env-1', name: 'staging' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-1',
      path: 'name',
      value: 'staging',
    });
  });
});

describe('applyEnvSetVar / applyEnvRemoveVar', () => {
  it('setVar emits an addToSet envelope at the variables set path keyed by variable.uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyEnvSetVar(
      { envId: 'env-1', variable: variable('v1', 'API_HOST', 'api.openheaders.io') },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-1',
      path: ENV_VARS_PATH,
      itemId: 'v1',
    });
  });

  it('removeVar emits a removeFromSet envelope keyed by uid (not name)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyEnvRemoveVar(
      { envId: 'env-1', uid: 'v1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-1',
      path: ENV_VARS_PATH,
      itemId: 'v1',
    });
  });
});

describe('applyEnvVariablesReplacement', () => {
  it('byte-identical lists short-circuit to ok without firing the bridge', async () => {
    const vars = [variable('v1', 'API_HOST', 'api.openheaders.io')];
    const result = await applyEnvVariablesReplacement('env-1', vars, vars, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['v1']),
    });
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits removeFromSet per vanished uid + addToSet per added uid + addToSet per same-uid edit', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const oldVars = [variable('v1', 'KEEP', 'keep'), variable('v2', 'GONE', 'gone'), variable('v3', 'RENAMED', 'val')];
    const newVars = [
      // v1 untouched
      variable('v1', 'KEEP', 'keep'),
      // v3 renamed (same uid, different name) — counts as an edit
      variable('v3', 'NEW_NAME', 'val'),
      // v4 brand-new
      variable('v4', 'NEW', 'fresh'),
    ];
    const result = await applyEnvVariablesReplacement('env-1', newVars, oldVars, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['v1', 'v2', 'v3']),
    });
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const removes = batch.mutations.filter((m) => m.body.kind === 'removeFromSet');
    const adds = batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(removes.map((m) => (m.body as { itemId: string }).itemId)).toEqual(['v2']);
    expect(adds.map((m) => (m.body as { itemId: string }).itemId).sort()).toEqual(['v3', 'v4']);
  });

  it('a content edit re-emits the row with its EXISTING orderKey (position preserved)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const oldVars = [variable('v1', 'A', 'a'), variable('v2', 'B', 'b')];
    const newVars = [variable('v1', 'A', 'a2'), variable('v2', 'B', 'b')]; // edit v1's value only
    await applyEnvVariablesReplacement('env-1', newVars, oldVars, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['v1', 'v2']), // v1='m', v2='n'
    });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const adds = batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds).toHaveLength(1);
    expect(adds[0].body).toMatchObject({ itemId: 'v1', orderKey: 'm' });
  });

  it('a pure reorder emits a single moveBefore (LIS-optimal) — materialized key order follows the editor', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const rows = (order: string[]) => order.map((u) => variable(u, u.toUpperCase(), u));
    const oldVars = rows(['v1', 'v2', 'v3']);
    const newVars = rows(['v3', 'v1', 'v2']); // drag v3 to the top
    await applyEnvVariablesReplacement('env-1', newVars, oldVars, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['v1', 'v2', 'v3']), // v1='m' < v2='n' < v3='o'
    });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    // v1+v2 form the LIS and stay put — only the dragged row moves.
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'moveBefore', itemId: 'v3' });
    // Reconstruct the final per-uid key (mirror keys overridden by the
    // emitted one) and confirm the lex sort matches the editor's row order.
    const finalKeys = new Map<string, string>([
      ['v1', 'm'],
      ['v2', 'n'],
      ['v3', (batch.mutations[0].body as { orderKey: string }).orderKey],
    ]);
    const materialized = [...finalKeys.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([uid]) => uid);
    expect(materialized).toEqual(['v3', 'v1', 'v2']);
  });

  it('drops new entries whose trimmed name is empty', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const oldVars: Variable[] = [];
    const newVars = [variable('v-blank', '   ', 'value'), variable('v-keep', 'OK', 'value')];
    await applyEnvVariablesReplacement('env-1', newVars, oldVars, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror([]),
    });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const ids = batch.mutations
      .filter((m) => m.body.kind === 'addToSet')
      .map((m) => (m.body as { itemId: string }).itemId);
    expect(ids).toEqual(['v-keep']);
  });
});
