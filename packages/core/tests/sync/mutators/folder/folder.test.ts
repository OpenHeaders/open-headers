import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  createFolder,
  deleteFolder,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  FOLDER_MUTATOR_VERSION,
  type FolderParentRef,
  moveFolder,
  type MutatorContext,
  renameFolder,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const collectionParent = (uid = 'col-1'): FolderParentRef => ({ type: COLLECTION_ENTITY_TYPE, uid });
const folderParent = (uid = 'fold-1'): FolderParentRef => ({ type: FOLDER_ENTITY_TYPE, uid });

describe('renameFolder', () => {
  it('emits a single setField on the folder entity', () => {
    const intent = renameFolder(ctx(), { folderUid: 'f-7', name: 'Auth flows' });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(FOLDER_MUTATOR_VERSION);
    expect(env.body).toEqual({
      kind: 'setField',
      type: FOLDER_ENTITY_TYPE,
      id: 'f-7',
      path: 'name',
      value: 'Auth flows',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('createFolder', () => {
  it('mints a create on the folder entity + addToSet on the parent collection', () => {
    const intent = createFolder(ctx(), {
      folderUid: 'f-1',
      parent: collectionParent('col-9'),
      name: 'New folder',
      orderKey: 'mm',
    });
    expect(intent.batch.mutations).toHaveLength(2);
    const [createBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(createBody).toEqual({
      kind: 'create',
      type: FOLDER_ENTITY_TYPE,
      id: 'f-1',
      payload: { schemaVersion: 5, name: 'New folder' },
    });
    expect(addBody).toEqual({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'col-9',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'f-1',
      item: { uid: 'f-1' },
      orderKey: 'mm',
    });
  });

  it('routes the parent slot to a folder parent when nesting', () => {
    const intent = createFolder(ctx(), {
      folderUid: 'f-leaf',
      parent: folderParent('f-root'),
      name: 'Leaf',
    });
    const addBody = intent.batch.mutations[1].body;
    expect(addBody).toMatchObject({
      kind: 'addToSet',
      type: FOLDER_ENTITY_TYPE,
      id: 'f-root',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'f-leaf',
    });
  });

  it('shares one batchId across both envelopes (per-batch all-or-nothing)', () => {
    const intent = createFolder(ctx({ batchId: 'b-create-folder' }), {
      folderUid: 'f-1',
      parent: collectionParent(),
      name: 'X',
    });
    expect(intent.batch.batchId).toBe('b-create-folder');
  });
});

describe('deleteFolder', () => {
  it('emits removeFromSet on the parent + entity tombstone, in that order', () => {
    const intent = deleteFolder(ctx(), { folderUid: 'f-1', parent: collectionParent('col-9') });
    expect(intent.batch.mutations).toHaveLength(2);
    const [removeBody, deleteBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toEqual({
      kind: 'removeFromSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'col-9',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'f-1',
    });
    expect(deleteBody).toEqual({ kind: 'delete', type: FOLDER_ENTITY_TYPE, id: 'f-1' });
  });
});

describe('moveFolder — intra-parent reorder', () => {
  it('emits one moveBefore when oldParent matches newParent', () => {
    const parent = collectionParent('col-9');
    const intent = moveFolder(ctx(), {
      folderUid: 'f-1',
      newParent: parent,
      oldParent: parent,
      orderKey: 'qz',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'moveBefore',
      type: COLLECTION_ENTITY_TYPE,
      id: 'col-9',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'f-1',
      orderKey: 'qz',
    });
  });

  it('treats omitted oldParent as same-parent reorder', () => {
    const intent = moveFolder(ctx(), {
      folderUid: 'f-1',
      newParent: collectionParent(),
      orderKey: 'a',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body.kind).toBe('moveBefore');
  });
});

describe('moveFolder — reparent', () => {
  it('emits remove from old + add to new with the new orderKey, atomic batch', () => {
    const intent = moveFolder(ctx({ batchId: 'b-move' }), {
      folderUid: 'f-1',
      newParent: folderParent('f-target'),
      oldParent: collectionParent('col-source'),
      orderKey: 'm',
    });
    expect(intent.batch.batchId).toBe('b-move');
    expect(intent.batch.mutations).toHaveLength(2);
    const [removeBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toEqual({
      kind: 'removeFromSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'col-source',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'f-1',
    });
    expect(addBody).toEqual({
      kind: 'addToSet',
      type: FOLDER_ENTITY_TYPE,
      id: 'f-target',
      path: FOLDER_CHILDREN_PATH,
      itemId: 'f-1',
      item: { uid: 'f-1' },
      orderKey: 'm',
    });
  });

  it('routes reparent across parent kinds (folder → collection)', () => {
    const intent = moveFolder(ctx(), {
      folderUid: 'f-1',
      oldParent: folderParent('f-old'),
      newParent: collectionParent('col-new'),
      orderKey: 'k',
    });
    const [removeBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toMatchObject({ type: FOLDER_ENTITY_TYPE, id: 'f-old' });
    expect(addBody).toMatchObject({ type: COLLECTION_ENTITY_TYPE, id: 'col-new' });
  });
});
