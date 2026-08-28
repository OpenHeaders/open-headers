import { describe, expect, it } from 'vitest';
import {
  addTemplateCondition,
  createTemplate,
  deleteTemplate,
  type MutatorContext,
  moveTemplate,
  removeTemplateCondition,
  setTemplateConditionField,
  setTemplateField,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_CONDITIONS_PATH,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  TEMPLATE_FOLDER_ITEMS_PATH,
  TEMPLATE_MUTATOR_VERSION,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
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
  const payload = {
    schemaVersion: 5,
    path: 'templates/col/tpl',
    pathSegment: 'tpl',
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

  it('mints the create envelope + the parent collection items slot in one batch', () => {
    const intent = createTemplate(ctx(), {
      templateUid: 'tpl-1',
      parent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: 'col-1' },
      payload,
      orderKey: 'mm',
    });
    expect(intent.batch.mutations).toHaveLength(2);
    const [createBody, slotBody] = intent.batch.mutations.map((m) => m.body);
    expect(createBody).toEqual({ kind: 'create', type: TEMPLATE_ENTITY_TYPE, id: 'tpl-1', payload });
    expect(slotBody).toEqual({
      kind: 'addToSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'col-1',
      path: TEMPLATE_FOLDER_ITEMS_PATH,
      itemId: 'tpl-1',
      item: { uid: 'tpl-1', type: TEMPLATE_ENTITY_TYPE },
      orderKey: 'mm',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('deleteTemplate', () => {
  it('emits the parent slot tombstone + the entity tombstone, in that order', () => {
    const intent = deleteTemplate(ctx(), {
      templateUid: 'tpl-1',
      parent: { type: TEMPLATE_FOLDER_ENTITY_TYPE, uid: 'fold-1' },
    });
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'removeFromSet',
        type: TEMPLATE_FOLDER_ENTITY_TYPE,
        id: 'fold-1',
        path: TEMPLATE_FOLDER_ITEMS_PATH,
        itemId: 'tpl-1',
      },
      { kind: 'delete', type: TEMPLATE_ENTITY_TYPE, id: 'tpl-1' },
    ]);
  });
});

describe('moveTemplate', () => {
  it('reparent is an atomic remove from the old parent + add to the new one', () => {
    const intent = moveTemplate(ctx(), {
      templateUid: 'tpl-1',
      oldParent: { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: 'col-1' },
      newParent: { type: TEMPLATE_FOLDER_ENTITY_TYPE, uid: 'fold-9' },
      orderKey: 'm',
    });
    const [removeBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toMatchObject({ kind: 'removeFromSet', type: TEMPLATE_COLLECTION_ENTITY_TYPE, id: 'col-1' });
    expect(addBody).toMatchObject({
      kind: 'addToSet',
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'fold-9',
      path: TEMPLATE_FOLDER_ITEMS_PATH,
      item: { uid: 'tpl-1', type: TEMPLATE_ENTITY_TYPE },
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
