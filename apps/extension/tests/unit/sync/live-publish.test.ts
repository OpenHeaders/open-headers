/**
 * Publication-gate behavior for live-workflow + live-variable write
 * clients. Mirrors the rule pattern from session 55:
 *
 *   - applyLive*Create forces `published: false` regardless of the
 *     caller's payload — drafts must not arrive published.
 *   - applyLive*Publish emits a single `setField('published', true)`
 *     mutation + resolver-invalidate intent.
 *   - applyLive*Update auto-unpublishes a previously-published entity
 *     in the same batch as the user's edit, so the resolver /
 *     scheduler never observes a half-typed value still flagged
 *     published. A draft entity (published !== true) skips the
 *     augmentation.
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
} from '@openheaders/core/sync';
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
  applyLiveVariableCreate,
  applyLiveVariablePublish,
  applyLiveVariableUpdate,
} from '@/shared/sync/live-variable-write-client';
import {
  applyLiveWorkflowCreate,
  applyLiveWorkflowPublish,
  applyLiveWorkflowUpdate,
} from '@/shared/sync/live-workflow-write-client';
import type { LiveVariableSyncMirror } from '@/context/live-variable-sync-mirror';
import type { LiveWorkflowSyncMirror } from '@/context/live-workflow-sync-mirror';
import type { RendererContextHandle } from '@/context/renderer-mutator-context';

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

function makeWorkflowMirror(workflow: V5.LiveWorkflow | null): LiveWorkflowSyncMirror {
  return {
    getLiveWorkflowMirror: (uid: string) =>
      workflow && workflow.uid === uid ? { workflow } : null,
    subscribeLiveWorkflowMirror: () => () => undefined,
    dispose: () => undefined,
  } as unknown as LiveWorkflowSyncMirror;
}

function makeVariableMirror(lv: V5.LiveVariable | null): LiveVariableSyncMirror {
  return {
    getLiveVariableMirror: (uid: string) =>
      lv && lv.uid === uid ? { liveVariable: lv } : null,
    subscribeLiveVariableMirror: () => () => undefined,
    dispose: () => undefined,
  } as unknown as LiveVariableSyncMirror;
}

const baseWorkflow: V5.LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wflow001',
  path: 'live-workflows/demo',
  name: 'Demo',
  enabled: true,
  refresh: { kind: 'manual' },
  steps: [{ id: 'fetch', requestUid: 'reqfetch1', captures: [{ name: 'v', extractor: { kind: 'whole-body' } }] }],
};

const baseLv: V5.LiveVariable = {
  schemaVersion: 5,
  uid: 'lvxxxxx1',
  path: 'live-variables/demo',
  name: 'token',
  workflowUid: 'wflow001',
  stepId: 'fetch',
  captureName: 'v',
  enabled: true,
};

beforeEach(() => mockCall.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('applyLiveWorkflowCreate', () => {
  it('mints uid + path and forces published: false regardless of payload', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyLiveWorkflowCreate(
      {
        workflow: { ...baseWorkflow, name: 'New', published: true } as Omit<
          V5.LiveWorkflow,
          'uid' | 'path' | 'schemaVersion'
        >,
        parentPath: 'live-workflows',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workflow.published).toBe(false);
      expect(result.workflow.uid).toMatch(/^[a-z0-9]{8}$/);
      expect(result.workflow.path.startsWith('live-workflows/')).toBe(true);
    }
  });
});

describe('applyLiveWorkflowPublish', () => {
  it('emits one setField(published, true) + resolver-invalidate intent', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeWorkflowMirror({ ...baseWorkflow, published: false });
    const result = await applyLiveWorkflowPublish('wflow001', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    expect(result.ok).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [type, payload] = mockCall.mock.calls[0];
    expect(type).toBe('oh.sync.apply');
    const batch = (payload as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: 'wflow001',
      path: 'published',
      value: true,
    });
    const intents = (payload as { sideEffects: unknown[] }).sideEffects;
    expect(intents).toHaveLength(1);
  });

  it('returns not-found when the mirror has no entry', async () => {
    const mirror = makeWorkflowMirror(null);
    const result = await applyLiveWorkflowPublish('missing', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('applyLiveWorkflowUpdate auto-unpublish', () => {
  it('augments a published-workflow edit with published: false in the same batch', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeWorkflowMirror({ ...baseWorkflow, published: true });
    await applyLiveWorkflowUpdate(
      'wflow001',
      { name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const paths = batch.mutations.map((m) => (m.body as { path?: string }).path);
    expect(paths).toContain('name');
    expect(paths).toContain('published');
    const publishedSet = batch.mutations.find((m) => (m.body as { path?: string }).path === 'published');
    expect((publishedSet?.body as { value?: unknown }).value).toBe(false);
  });

  it('skips augmentation when the workflow is already a draft', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeWorkflowMirror({ ...baseWorkflow, published: false });
    await applyLiveWorkflowUpdate(
      'wflow001',
      { name: 'Renamed' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
  });

  it('respects an explicit published in updates (caller-controlled re-publish)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeWorkflowMirror({ ...baseWorkflow, published: true });
    await applyLiveWorkflowUpdate(
      'wflow001',
      { name: 'Renamed', published: true },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const publishedSet = batch.mutations.find((m) => (m.body as { path?: string }).path === 'published');
    // Caller passed published: true, no auto-flip to false.
    expect((publishedSet?.body as { value?: unknown }).value).toBe(true);
  });
});

describe('applyLiveVariableCreate', () => {
  it('forces published: false regardless of payload', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyLiveVariableCreate(
      {
        liveVariable: { ...baseLv, published: true } as Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion'>,
        parentPath: 'live-variables',
      },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.liveVariable.published).toBe(false);
  });
});

describe('applyLiveVariablePublish', () => {
  it('emits one setField(published, true) + resolver-invalidate intent', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeVariableMirror({ ...baseLv, published: false });
    const result = await applyLiveVariablePublish('lvxxxxx1', {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    expect(result.ok).toBe(true);
    const [, payload] = mockCall.mock.calls[0];
    const batch = (payload as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      path: 'published',
      value: true,
    });
  });
});

describe('applyLiveVariableUpdate auto-unpublish', () => {
  it('augments a published-LV edit with published: false', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeVariableMirror({ ...baseLv, published: true });
    await applyLiveVariableUpdate(
      'lvxxxxx1',
      { name: 'newname' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const paths = batch.mutations.map((m) => (m.body as { path?: string }).path);
    expect(paths).toContain('name');
    expect(paths).toContain('published');
    const publishedSet = batch.mutations.find((m) => (m.body as { path?: string }).path === 'published');
    expect((publishedSet?.body as { value?: unknown }).value).toBe(false);
  });

  it('skips augmentation when the LV is already a draft', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeVariableMirror({ ...baseLv, published: false });
    await applyLiveVariableUpdate(
      'lvxxxxx1',
      { name: 'newname' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
  });
});
