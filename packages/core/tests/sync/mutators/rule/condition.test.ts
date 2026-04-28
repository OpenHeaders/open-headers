import { describe, expect, it } from 'vitest';
import {
  addCondition,
  RECOMPILE_DNR,
  removeCondition,
  RULE_ENTITY_TYPE,
  type RuleMutatorContext,
  setConditionField,
} from '../../../../src/sync';

const ctx = (): RuleMutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_500, logical: 0, nodeId: 'node-b' },
  surfaceId: 'surface-workbench',
  deviceId: 'device-a',
});

describe('addCondition', () => {
  it('emits a single addToSet at `conditions` and a recompile-dnr intent', () => {
    const intent = addCondition(ctx(), {
      ruleUid: 'rule-1',
      condition: { type: 'request-domains', values: ['openheaders.io'] },
      itemId: 'cond-1',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: RULE_ENTITY_TYPE,
      id: 'rule-1',
      path: 'conditions',
      itemId: 'cond-1',
      item: { type: 'request-domains', values: ['openheaders.io'] },
    });
    expect(intent.sideEffects[0]).toMatchObject({ kind: RECOMPILE_DNR, key: 'rule-1' });
  });
});

describe('removeCondition', () => {
  it('emits a single removeFromSet at `conditions`', () => {
    const intent = removeCondition(ctx(), { ruleUid: 'rule-1', itemId: 'cond-1' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      path: 'conditions',
      itemId: 'cond-1',
    });
  });
});

describe('setConditionField', () => {
  it('re-emits the whole condition record via addToSet (LWW-by-itemId)', () => {
    const intent = setConditionField(ctx(), {
      ruleUid: 'rule-1',
      itemId: 'cond-1',
      condition: { type: 'request-domains', values: ['openheaders.io', 'api.openheaders.io'] },
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'cond-1',
      item: { values: ['openheaders.io', 'api.openheaders.io'] },
    });
  });
});
