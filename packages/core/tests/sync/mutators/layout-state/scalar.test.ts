import { describe, expect, it } from 'vitest';
import {
  LAYOUT_STATE_ENTITY_TYPE,
  LAYOUT_STATE_ID,
  LAYOUT_STATE_MUTATOR_VERSION,
  LAYOUT_STATE_PATH,
  type MutatorContext,
  setLayoutState,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setLayoutState', () => {
  it('emits a single setField on the singleton at path "layout"', () => {
    const layout = { sidebarRatio: 0.2, inspectorRatio: 0.3, bottomRatio: 0.25 };
    const intent = setLayoutState(ctx(), { layout });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(LAYOUT_STATE_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'setField',
      type: LAYOUT_STATE_ENTITY_TYPE,
      id: LAYOUT_STATE_ID,
      path: LAYOUT_STATE_PATH,
      value: layout,
    });
  });

  it('emits no side effects — layout is pure UX state', () => {
    const intent = setLayoutState(ctx(), { layout: {} });
    expect(intent.sideEffects).toEqual([]);
  });

  it('passes opaque toolLayout shape through unchanged', () => {
    const layout = {
      sidebarRatio: 0.17,
      inspectorRatio: 0.2,
      bottomRatio: 0.25,
      toolLayout: { docks: { left: ['rules'] }, hidden: ['inspector'] },
    };
    const intent = setLayoutState(ctx(), { layout });
    expect(intent.batch.mutations[0].body).toMatchObject({ value: layout });
  });

  it('honors caller-supplied batchId', () => {
    const intent = setLayoutState(ctx({ batchId: 'B-9' }), { layout: { sidebarRatio: 0.5 } });
    expect(intent.batch.batchId).toBe('B-9');
  });
});
