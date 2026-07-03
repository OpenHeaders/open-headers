import { describe, expect, it } from 'vitest';
import {
  LIVE_VALUE_ENTITY_TYPE,
  LIVE_VALUE_ID,
  LIVE_VALUE_MUTATOR_VERSION,
  LIVE_VALUE_VALUES_PATH,
  type MutatorContext,
  putLiveValue,
  removeLiveValues,
} from '../../../../src/sync';
import { seedLiveValues } from '../../../../src/sync-builders/projections/live-value-projection';
import type { LiveValueRecord } from '../../../../src/types/live-cache';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'sw',
  deviceId: 'device-a',
  ...overrides,
});

const record = (over: Partial<LiveValueRecord> = {}): LiveValueRecord => ({
  workflowUid: 'wf-1',
  environmentId: null,
  stepCaptures: { s1: { token: 'at' } },
  extractedAt: 1_000,
  expiresAt: 5_000,
  ...over,
});

describe('putLiveValue', () => {
  it('emits one addToSet(values) keyed by run-key, no side-effects', () => {
    const intent = putLiveValue(ctx(), { runKey: 'wf-1:__none__', value: record() });
    expect(intent.sideEffects).toEqual([]);
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(LIVE_VALUE_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: LIVE_VALUE_ENTITY_TYPE,
      id: LIVE_VALUE_ID,
      path: LIVE_VALUE_VALUES_PATH,
      itemId: 'wf-1:__none__',
      item: { workflowUid: 'wf-1', stepCaptures: { s1: { token: 'at' } }, extractedAt: 1_000, expiresAt: 5_000 },
    });
  });
});

describe('removeLiveValues', () => {
  it('emits one removeFromSet(values) per run-key under one batchId', () => {
    const intent = removeLiveValues(ctx(), { runKeys: ['wf-1:__none__', 'wf-1:env-2'] });
    expect(intent.batch.mutations).toHaveLength(2);
    for (const m of intent.batch.mutations) {
      expect(m.body).toMatchObject({
        kind: 'removeFromSet',
        type: LIVE_VALUE_ENTITY_TYPE,
        id: LIVE_VALUE_ID,
        path: LIVE_VALUE_VALUES_PATH,
      });
    }
    expect(intent.batch.mutations.map((m) => (m.body as { itemId: string }).itemId)).toEqual([
      'wf-1:__none__',
      'wf-1:env-2',
    ]);
  });

  it('emits an empty batch for no keys', () => {
    expect(removeLiveValues(ctx(), { runKeys: [] }).batch.mutations).toHaveLength(0);
  });
});

describe('seedLiveValues', () => {
  it('emits a create shell + one addToSet per value', () => {
    const batch = seedLiveValues(
      {
        schemaVersion: 5,
        values: { 'wf-1:__none__': record(), 'wf-2:env-2': record({ workflowUid: 'wf-2', environmentId: 'env-2' }) },
      },
      ctx(),
    );
    expect(batch.mutations).toHaveLength(3); // 1 create shell + 2 values
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'create',
      type: LIVE_VALUE_ENTITY_TYPE,
      id: LIVE_VALUE_ID,
      payload: { schemaVersion: 5 },
    });
    const valueBodies = batch.mutations.slice(1).map((m) => m.body) as Array<{ kind: string; itemId: string }>;
    expect(valueBodies.every((b) => b.kind === 'addToSet')).toBe(true);
    expect(valueBodies.map((b) => b.itemId).sort()).toEqual(['wf-1:__none__', 'wf-2:env-2']);
  });
});
