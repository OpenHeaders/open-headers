import { describe, expect, it } from 'vitest';
import {
  ENVIRONMENT_ENTITY_TYPE,
  type MutatorContext,
  renameEnvironment,
} from '../../../../src/sync';

const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

describe('renameEnvironment', () => {
  it('emits a setField at `name` carrying the new name', () => {
    const intent = renameEnvironment(ctx(), { envId: 'env-prod', name: 'Production' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-prod',
      path: 'name',
      value: 'Production',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});
