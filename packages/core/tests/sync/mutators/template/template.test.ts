import { describe, expect, it } from 'vitest';
import {
  addTemplateCondition,
  createTemplate,
  deleteTemplate,
  type MutatorContext,
  removeTemplateCondition,
  setTemplateConditionField,
  setTemplateField,
  TEMPLATE_CONDITIONS_PATH,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_MUTATOR_VERSION,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('addTemplateCondition', () => {
  it('emits one addToSet on the template entity at the conditions path', () => {
    const intent = addTemplateCondition(ctx(), {
      templateUid: 'tpl-1',
      condition: { uid: 'tcd00001', type: 'urlEquals', values: ['https://api.openheaders.io/v1'] },
      itemId: 'c-1',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(TEMPLATE_MUTATOR_VERSION);
    expect(env.body).toEqual({
      kind: 'addToSet',
      type: TEMPLATE_ENTITY_TYPE,
      id: 'tpl-1',
      path: TEMPLATE_CONDITIONS_PATH,
      itemId: 'c-1',
      item: { uid: 'tcd00001', type: 'urlEquals', values: ['https://api.openheaders.io/v1'] },
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it("defaults itemId to the condition's persisted uid when not overridden", () => {
    const intent = addTemplateCondition(ctx(), {
      templateUid: 'tpl-1',
      condition: { uid: 'tcd00077', type: 'hostMatches', values: ['*.openheaders.io'] },
    });
    const body = intent.batch.mutations[0].body;
    if (body.kind !== 'addToSet') throw new Error('expected addToSet');
    expect(body.itemId).toBe('tcd00077');
  });
});

describe('removeTemplateCondition', () => {
  it('emits a single removeFromSet on the conditions path', () => {
    const intent = removeTemplateCondition(ctx(), { templateUid: 'tpl-1', itemId: 'c-1' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'removeFromSet',
      type: TEMPLATE_ENTITY_TYPE,
      id: 'tpl-1',
      path: TEMPLATE_CONDITIONS_PATH,
      itemId: 'c-1',
    });
  });
});

describe('setTemplateConditionField', () => {
  it('re-emits the whole condition record via addToSet at the same itemId', () => {
    const intent = setTemplateConditionField(ctx(), {
      templateUid: 'tpl-1',
      itemId: 'c-1',
      condition: { uid: 'tcd00002', type: 'urlMatches', values: ['^https://.*\\.openheaders\\.io'] },
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'addToSet',
      type: TEMPLATE_ENTITY_TYPE,
      id: 'tpl-1',
      path: TEMPLATE_CONDITIONS_PATH,
      itemId: 'c-1',
      item: { uid: 'tcd00002', type: 'urlMatches', values: ['^https://.*\\.openheaders\\.io'] },
    });
  });
});

describe('setTemplateField', () => {
  it('emits a setField at any of the typed scalar paths', () => {
    const intent = setTemplateField(ctx(), {
      templateUid: 'tpl-1',
      path: 'name',
      value: 'Bearer auth template',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: TEMPLATE_ENTITY_TYPE,
      id: 'tpl-1',
      path: 'name',
      value: 'Bearer auth template',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('routes formValues + includes through the same scalar contract (whole-object replace)', () => {
    const formIntent = setTemplateField(ctx(), {
      templateUid: 'tpl-1',
      path: 'formValues',
      value: { headerName: 'Authorization', headerValue: 'Bearer xyz' },
    });
    expect(formIntent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'formValues',
      value: { headerName: 'Authorization', headerValue: 'Bearer xyz' },
    });

    const includesIntent = setTemplateField(ctx(), {
      templateUid: 'tpl-1',
      path: 'includes',
      value: { conditions: true, formValues: false },
    });
    expect(includesIntent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'includes',
      value: { conditions: true, formValues: false },
    });
  });
});

describe('createTemplate', () => {
  it('mints a single create envelope carrying the full payload', () => {
    const payload = {
      schemaVersion: 5,
      path: 'templates/col/tpl',
      name: 'list users template',
      ruleType: 'header',
      icon: 'header',
      description: 'Adds X-Trace header',
      includes: { conditions: true, formValues: true },
      conditions: [],
      formValues: {},
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
    };
    const intent = createTemplate(ctx(), { templateUid: 'tpl-1', payload });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'create',
      type: TEMPLATE_ENTITY_TYPE,
      id: 'tpl-1',
      payload,
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('deleteTemplate', () => {
  it('emits a single delete envelope', () => {
    const intent = deleteTemplate(ctx(), { templateUid: 'tpl-1' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'delete',
      type: TEMPLATE_ENTITY_TYPE,
      id: 'tpl-1',
    });
  });
});

describe('batch atomicity', () => {
  it('shares one batchId across emitted envelopes when ctx.batchId is supplied', () => {
    const intent = addTemplateCondition(ctx({ batchId: 'b-add-condition' }), {
      templateUid: 'tpl-1',
      condition: { uid: 'tcd00003', type: 'urlEquals', values: ['x'] },
    });
    expect(intent.batch.batchId).toBe('b-add-condition');
  });
});
