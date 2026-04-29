import { describe, expect, it } from 'vitest';
import {
  createLiveWorkflow,
  deleteLiveWorkflow,
  INVALIDATE_RESOLVER,
  LIVE_WORKFLOW_ENTITY_TYPE,
  LIVE_WORKFLOW_MUTATOR_VERSION,
  type MutatorContext,
  setLiveWorkflowField,
  unsetLiveWorkflowField,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setLiveWorkflowField', () => {
  it('emits a setField at the typed scalar path + an INVALIDATE_RESOLVER intent keyed by the workflow uid', () => {
    const intent = setLiveWorkflowField(ctx(), {
      workflowUid: 'wf-1',
      path: 'enabled',
      value: false,
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(LIVE_WORKFLOW_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: 'wf-1',
      path: 'enabled',
      value: false,
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'wf-1', hlc: ctx().hlc },
    ]);
  });

  it('routes steps through whole-array scalar replacement', () => {
    const steps = [
      {
        id: 'auth',
        requestUid: 'req-1',
        captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.token' } }],
      },
    ];
    const intent = setLiveWorkflowField(ctx(), {
      workflowUid: 'wf-1',
      path: 'steps',
      value: steps,
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'steps',
      value: steps,
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: INVALIDATE_RESOLVER, key: 'wf-1' });
  });

  it('routes refresh policy variants through the same scalar contract', () => {
    const intent = setLiveWorkflowField(ctx(), {
      workflowUid: 'wf-1',
      path: 'refresh',
      value: { kind: 'interval', seconds: 60 },
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'refresh',
      value: { kind: 'interval', seconds: 60 },
    });
  });
});

describe('unsetLiveWorkflowField', () => {
  it('emits an unsetField at the typed scalar path + invalidates the resolver', () => {
    const intent = unsetLiveWorkflowField(ctx(), {
      workflowUid: 'wf-1',
      path: 'description',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'unsetField',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: 'wf-1',
      path: 'description',
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: INVALIDATE_RESOLVER, key: 'wf-1' });
  });
});

describe('createLiveWorkflow', () => {
  it('mints a single create envelope carrying the full payload + invalidates the resolver', () => {
    const payload = {
      schemaVersion: 5,
      path: 'live-workflows/get-token',
      name: 'get_token',
      steps: [],
      refresh: { kind: 'manual' },
      enabled: true,
    };
    const intent = createLiveWorkflow(ctx(), { workflowUid: 'wf-1', payload });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'create',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: 'wf-1',
      payload,
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: INVALIDATE_RESOLVER, key: 'wf-1' });
  });
});

describe('deleteLiveWorkflow', () => {
  it('emits a single delete envelope + invalidates the resolver', () => {
    const intent = deleteLiveWorkflow(ctx(), { workflowUid: 'wf-1' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'delete',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: 'wf-1',
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: INVALIDATE_RESOLVER, key: 'wf-1' });
  });
});

describe('batch atomicity', () => {
  it('shares one batchId across emitted envelopes when ctx.batchId is supplied', () => {
    const intent = setLiveWorkflowField(ctx({ batchId: 'b-set-refresh' }), {
      workflowUid: 'wf-1',
      path: 'refresh',
      value: { kind: 'manual' },
    });
    expect(intent.batch.batchId).toBe('b-set-refresh');
  });
});
