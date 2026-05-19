import { describe, expect, it } from 'vitest';
import { RECOMPILE_DNR, RULE_ENTITY_TYPE, type MutatorContext, toggleEnabled } from '../../../../src/sync';

const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-c' },
  surfaceId: 'surface-popup',
  deviceId: 'device-a',
});

describe('toggleEnabled', () => {
  it('emits a setField at `enabled` carrying the boolean value', () => {
    const intent = toggleEnabled(ctx(), { ruleUid: 'rule-1', enabled: true });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: RULE_ENTITY_TYPE,
      id: 'rule-1',
      path: 'enabled',
      value: true,
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: RECOMPILE_DNR, key: 'rule-1' });
  });

  it('round-trips a false toggle', () => {
    const intent = toggleEnabled(ctx(), { ruleUid: 'rule-1', enabled: false });
    expect((intent.batch.mutations[0].body as { value: unknown }).value).toBe(false);
  });
});
