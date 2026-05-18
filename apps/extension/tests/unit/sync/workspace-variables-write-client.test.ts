/**
 * Renderer-side write client for WorkspaceVariables mutations.
 *
 * The workspace-variables entity is a singleton (`WORKSPACE_VARIABLES_ID` =
 * 'workspace-variables') hosting the per-workspace `variables` set.
 * Identity is `variable.uid`. We verify:
 *   - setVar emits addToSet at the variables set path keyed by uid
 *   - removeVar emits removeFromSet keyed by uid
 *   - replacement folds add / edit / remove into one batch keyed by
 *     uid; byte-identical entries skipped; whitespace-name entries
 *     dropped; non-empty diff rides one INVALIDATE_RESOLVER side-effect
 */

import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
} from '@openheaders/core/sync';
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

import {
  applyWorkspaceVariablesReplacement,
  applyWorkspaceVarRemove,
  applyWorkspaceVarSet,
} from '@openheaders/ui/shared/sync/workspace-variables-write-client';
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

function variable(uid: string, name: string, value: string, type: 'default' | 'secret' = 'default'): Variable {
  return { uid, name, value, type };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyWorkspaceVarSet / applyWorkspaceVarRemove', () => {
  it('setVar emits an addToSet envelope keyed by variable.uid at the workspace-variables set path', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyWorkspaceVarSet(
      { variable: variable('v1', 'BASE_URL', 'https://api.openheaders.io') },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: 'v1',
    });
  });

  it('removeVar emits a removeFromSet envelope keyed by uid (not name)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyWorkspaceVarRemove(
      { uid: 'v1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: 'v1',
    });
  });
});

describe('applyWorkspaceVariablesReplacement', () => {
  it('byte-identical lists short-circuit to ok without firing the bridge', async () => {
    const vars = [variable('v1', 'BASE_URL', 'https://api.openheaders.io')];
    const result = await applyWorkspaceVariablesReplacement(vars, vars, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits removeFromSet per vanished uid + addToSet per added/edited uid + one INVALIDATE_RESOLVER side-effect', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const oldVars = [
      variable('v1', 'KEEP', 'keep'),
      variable('v2', 'GONE', 'gone'),
      variable('v3', 'RENAMED', 'val'),
    ];
    const newVars = [
      variable('v1', 'KEEP', 'keep'),
      // v3 rename: same uid, new name — edit, not remove+add
      variable('v3', 'NEW_NAME', 'val'),
      variable('v4', 'NEW', 'fresh'),
    ];
    await applyWorkspaceVariablesReplacement(newVars, oldVars, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
    });
    const payload = mockCall.mock.calls[0][1] as { batch: MutationBatch; sideEffects: SideEffectIntent[] };
    const removes = payload.batch.mutations.filter((m) => m.body.kind === 'removeFromSet');
    const adds = payload.batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(removes.map((m) => (m.body as { itemId: string }).itemId)).toEqual(['v2']);
    expect(adds.map((m) => (m.body as { itemId: string }).itemId).sort()).toEqual(['v3', 'v4']);
    expect(payload.sideEffects).toHaveLength(1);
  });

  it('drops new entries whose trimmed name is empty', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyWorkspaceVariablesReplacement(
      [variable('v-blank', '   ', 'value'), variable('v-keep', 'OK', 'value')],
      [],
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const ids = batch.mutations
      .filter((m) => m.body.kind === 'addToSet')
      .map((m) => (m.body as { itemId: string }).itemId);
    expect(ids).toEqual(['v-keep']);
  });
});
