import { describe, expect, it } from 'vitest';
import {
  createTemplateFolder,
  deleteTemplateFolder,
  moveTemplateFolder,
  type MutatorContext,
  renameTemplateFolder,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  TEMPLATE_FOLDER_MUTATOR_VERSION,
  type TemplateFolderParentRef,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const collectionParent = (uid = 'tcol-1'): TemplateFolderParentRef => ({
  type: TEMPLATE_COLLECTION_ENTITY_TYPE,
  uid,
});
const folderParent = (uid = 'tfold-1'): TemplateFolderParentRef => ({
  type: TEMPLATE_FOLDER_ENTITY_TYPE,
  uid,
});

describe('renameTemplateFolder', () => {
  it('emits a single setField on the template-folder entity', () => {
    const intent = renameTemplateFolder(ctx(), { folderUid: 'tf-7', name: 'Auth templates' });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(TEMPLATE_FOLDER_MUTATOR_VERSION);
    expect(env.body).toEqual({
      kind: 'setField',
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'tf-7',
      path: 'name',
      value: 'Auth templates',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('createTemplateFolder', () => {
  it('mints a create on the folder entity + addToSet on the parent template-collection', () => {
    const intent = createTemplateFolder(ctx(), {
      folderUid: 'tf-1',
      parent: collectionParent('tcol-9'),
      name: 'New folder',
      orderKey: 'mm',
    });
    expect(intent.batch.mutations).toHaveLength(2);
    const [createBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(createBody).toEqual({
      kind: 'create',
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'tf-1',
      payload: { schemaVersion: 5, name: 'New folder', pathSegment: 'new-folder-tf-1' },
    });
    expect(addBody).toEqual({
      kind: 'addToSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tcol-9',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tf-1',
      item: { uid: 'tf-1' },
      orderKey: 'mm',
    });
  });

  it('routes the parent slot to a template-folder parent when nesting', () => {
    const intent = createTemplateFolder(ctx(), {
      folderUid: 'tf-leaf',
      parent: folderParent('tf-root'),
      name: 'Leaf',
    });
    const addBody = intent.batch.mutations[1].body;
    expect(addBody).toMatchObject({
      kind: 'addToSet',
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'tf-root',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tf-leaf',
    });
  });

  it('honors an explicit pathSegment override (preserve legacy slugs on import)', () => {
    const intent = createTemplateFolder(ctx(), {
      folderUid: 'tf-1',
      parent: collectionParent(),
      name: 'New name',
      pathSegment: 'legacy-slug-tf-1',
    });
    const createBody = intent.batch.mutations[0].body;
    expect(createBody).toMatchObject({
      payload: { name: 'New name', pathSegment: 'legacy-slug-tf-1' },
    });
  });

  it('shares one batchId across both envelopes (per-batch all-or-nothing)', () => {
    const intent = createTemplateFolder(ctx({ batchId: 'b-create-folder' }), {
      folderUid: 'tf-1',
      parent: collectionParent(),
      name: 'X',
    });
    expect(intent.batch.batchId).toBe('b-create-folder');
  });
});

describe('deleteTemplateFolder', () => {
  it('emits removeFromSet on the parent + entity tombstone, in that order', () => {
    const intent = deleteTemplateFolder(ctx(), {
      folderUid: 'tf-1',
      parent: collectionParent('tcol-9'),
    });
    expect(intent.batch.mutations).toHaveLength(2);
    const [removeBody, deleteBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toEqual({
      kind: 'removeFromSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tcol-9',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tf-1',
    });
    expect(deleteBody).toEqual({ kind: 'delete', type: TEMPLATE_FOLDER_ENTITY_TYPE, id: 'tf-1' });
  });
});

describe('moveTemplateFolder — intra-parent reorder', () => {
  it('emits one moveBefore when oldParent matches newParent', () => {
    const parent = collectionParent('tcol-9');
    const intent = moveTemplateFolder(ctx(), {
      folderUid: 'tf-1',
      newParent: parent,
      oldParent: parent,
      orderKey: 'qz',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'moveBefore',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tcol-9',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tf-1',
      orderKey: 'qz',
    });
  });

  it('treats omitted oldParent as same-parent reorder', () => {
    const intent = moveTemplateFolder(ctx(), {
      folderUid: 'tf-1',
      newParent: collectionParent(),
      orderKey: 'a',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body.kind).toBe('moveBefore');
  });
});

describe('moveTemplateFolder — reparent', () => {
  it('emits remove from old + add to new with the new orderKey, atomic batch', () => {
    const intent = moveTemplateFolder(ctx({ batchId: 'b-move' }), {
      folderUid: 'tf-1',
      newParent: folderParent('tf-target'),
      oldParent: collectionParent('tcol-source'),
      orderKey: 'm',
    });
    expect(intent.batch.batchId).toBe('b-move');
    expect(intent.batch.mutations).toHaveLength(2);
    const [removeBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toEqual({
      kind: 'removeFromSet',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tcol-source',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tf-1',
    });
    expect(addBody).toEqual({
      kind: 'addToSet',
      type: TEMPLATE_FOLDER_ENTITY_TYPE,
      id: 'tf-target',
      path: TEMPLATE_FOLDER_CHILDREN_PATH,
      itemId: 'tf-1',
      item: { uid: 'tf-1' },
      orderKey: 'm',
    });
  });

  it('routes reparent across parent kinds (folder → collection)', () => {
    const intent = moveTemplateFolder(ctx(), {
      folderUid: 'tf-1',
      oldParent: folderParent('tf-old'),
      newParent: collectionParent('tcol-new'),
      orderKey: 'k',
    });
    const [removeBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toMatchObject({ type: TEMPLATE_FOLDER_ENTITY_TYPE, id: 'tf-old' });
    expect(addBody).toMatchObject({ type: TEMPLATE_COLLECTION_ENTITY_TYPE, id: 'tcol-new' });
  });
});
