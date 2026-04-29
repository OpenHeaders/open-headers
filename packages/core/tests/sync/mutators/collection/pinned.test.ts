import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  type MutatorContext,
  setDefaultEnvironmentId,
  setPinnedAndDefault,
  setPinnedEnvironments,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setPinnedEnvironments', () => {
  it('emits a setField at pinnedEnvironmentIds carrying the array', () => {
    const intent = setPinnedEnvironments(ctx(), { collectionUid: 'c', pinnedEnvironmentIds: ['e1', 'e2'] });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: COLLECTION_ENTITY_TYPE,
      id: 'c',
      path: 'pinnedEnvironmentIds',
      value: ['e1', 'e2'],
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setDefaultEnvironmentId', () => {
  it('emits a setField at defaultEnvironmentId — null carries through as null', () => {
    const intent = setDefaultEnvironmentId(ctx(), { collectionUid: 'c', defaultEnvironmentId: null });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'defaultEnvironmentId',
      value: null,
    });
  });
});

describe('setPinnedAndDefault', () => {
  it('emits both setFields under one batchId', () => {
    const intent = setPinnedAndDefault(ctx({ batchId: 'pinned-batch' }), {
      collectionUid: 'c',
      pinnedEnvironmentIds: ['e1'],
      defaultEnvironmentId: 'e1',
    });
    expect(intent.batch.batchId).toBe('pinned-batch');
    expect(intent.batch.mutations).toHaveLength(2);
    expect(intent.batch.mutations.map((m) => (m.body as { path: string }).path)).toEqual([
      'pinnedEnvironmentIds',
      'defaultEnvironmentId',
    ]);
  });
});
