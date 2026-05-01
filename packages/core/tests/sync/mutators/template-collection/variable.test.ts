import { describe, expect, it } from 'vitest';
import {
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeTemplateCollectionVar,
  renameTemplateCollectionVar,
  setTemplateCollectionVar,
  setTemplateCollectionVarType,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_MUTATOR_VERSION,
  TEMPLATE_COLLECTION_VARS_PATH,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setTemplateCollectionVar', () => {
  it('emits an addToSet at the template-collection variables path', () => {
    const intent = setTemplateCollectionVar(ctx(), {
      templateCollectionUid: 'tcol-prod',
      name: 'BASE_URL',
      value: 'https://api.openheaders.io',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(TEMPLATE_COLLECTION_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tcol-prod',
      path: TEMPLATE_COLLECTION_VARS_PATH,
      itemId: 'BASE_URL',
      item: { name: 'BASE_URL', value: 'https://api.openheaders.io', type: 'default' },
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'tcol-prod', hlc: ctx().hlc },
    ]);
  });
});

describe('removeTemplateCollectionVar', () => {
  it('emits a removeFromSet with itemId = name', () => {
    const intent = removeTemplateCollectionVar(ctx(), {
      templateCollectionUid: 'tcol-prod',
      name: 'BASE_URL',
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      path: TEMPLATE_COLLECTION_VARS_PATH,
      itemId: 'BASE_URL',
    });
  });
});

describe('renameTemplateCollectionVar', () => {
  it('emits a 2-mutation batch (remove old + add new)', () => {
    const intent = renameTemplateCollectionVar(ctx(), {
      templateCollectionUid: 'tcol-1',
      oldName: 'A',
      newName: 'B',
      value: 'v',
    });
    expect(intent.batch.mutations).toHaveLength(2);
  });

  it('returns an empty batch when oldName === newName', () => {
    const intent = renameTemplateCollectionVar(ctx(), {
      templateCollectionUid: 'tcol-1',
      oldName: 'X',
      newName: 'X',
      value: 'v',
    });
    expect(intent.batch.mutations).toHaveLength(0);
  });
});

describe('setTemplateCollectionVarType', () => {
  it('replaces the whole record via addToSet (LWW per itemId)', () => {
    const intent = setTemplateCollectionVarType(ctx(), {
      templateCollectionUid: 'tcol-1',
      name: 'TOKEN',
      value: 'abc',
      type: 'secret',
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'TOKEN',
      item: { name: 'TOKEN', value: 'abc', type: 'secret' },
    });
  });
});
