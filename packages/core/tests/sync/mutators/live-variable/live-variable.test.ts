import { describe, expect, it } from 'vitest';
import {
  createLiveVariable,
  deleteLiveVariable,
  INVALIDATE_RESOLVER,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_VARIABLE_MUTATOR_VERSION,
  type MutatorContext,
  setLiveVariableField,
  unsetLiveVariableField,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setLiveVariableField', () => {
  it('emits a setField at the typed scalar path + an INVALIDATE_RESOLVER intent keyed by the LV uid', () => {
    const intent = setLiveVariableField(ctx(), {
      liveVariableUid: 'lv-1',
      path: 'enabled',
      value: false,
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(LIVE_VARIABLE_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      id: 'lv-1',
      path: 'enabled',
      value: false,
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'lv-1', hlc: ctx().hlc },
    ]);
  });

  it('routes manualOverride through whole-object scalar replacement', () => {
    const intent = setLiveVariableField(ctx(), {
      liveVariableUid: 'lv-1',
      path: 'manualOverride',
      value: { value: 'override-value', until: 1_700_000_000_000 },
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'manualOverride',
      value: { value: 'override-value', until: 1_700_000_000_000 },
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: INVALIDATE_RESOLVER, key: 'lv-1' });
  });
});

describe('unsetLiveVariableField', () => {
  it('emits an unsetField at the typed scalar path + invalidates the resolver', () => {
    const intent = unsetLiveVariableField(ctx(), {
      liveVariableUid: 'lv-1',
      path: 'manualOverride',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'unsetField',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      id: 'lv-1',
      path: 'manualOverride',
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: INVALIDATE_RESOLVER, key: 'lv-1' });
  });
});

describe('createLiveVariable', () => {
  it('mints a single create envelope carrying the full payload + invalidates the resolver', () => {
    const payload = {
      schemaVersion: 5,
      path: 'live-variables/access-token',
      name: 'access_token',
      workflowUid: 'wf-1',
      stepId: 'auth',
      captureName: 'token',
      enabled: true,
    };
    const intent = createLiveVariable(ctx(), { liveVariableUid: 'lv-1', payload });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'create',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      id: 'lv-1',
      payload,
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: INVALIDATE_RESOLVER, key: 'lv-1' });
  });
});

describe('deleteLiveVariable', () => {
  it('emits a single delete envelope + invalidates the resolver', () => {
    const intent = deleteLiveVariable(ctx(), { liveVariableUid: 'lv-1' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'delete',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      id: 'lv-1',
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: INVALIDATE_RESOLVER, key: 'lv-1' });
  });
});

describe('batch atomicity', () => {
  it('shares one batchId across emitted envelopes when ctx.batchId is supplied', () => {
    const intent = setLiveVariableField(ctx({ batchId: 'b-set-enabled' }), {
      liveVariableUid: 'lv-1',
      path: 'enabled',
      value: true,
    });
    expect(intent.batch.batchId).toBe('b-set-enabled');
  });
});
