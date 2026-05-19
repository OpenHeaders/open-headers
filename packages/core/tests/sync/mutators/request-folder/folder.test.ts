import { describe, expect, it } from 'vitest';
import {
  createRequestFolder,
  deleteRequestFolder,
  moveRequestFolder,
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_MUTATOR_VERSION,
  type RequestFolderParentRef,
  renameRequestFolder,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const collectionParent = (uid = 'rcol-1'): RequestFolderParentRef => ({
  type: REQUEST_COLLECTION_ENTITY_TYPE,
  uid,
});
const folderParent = (uid = 'rfold-1'): RequestFolderParentRef => ({
  type: REQUEST_FOLDER_ENTITY_TYPE,
  uid,
});

describe('renameRequestFolder', () => {
  it('emits a single setField on the request-folder entity', () => {
    const intent = renameRequestFolder(ctx(), { folderUid: 'rf-7', name: 'Auth flows' });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(REQUEST_FOLDER_MUTATOR_VERSION);
    expect(env.body).toEqual({
      kind: 'setField',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rf-7',
      path: 'name',
      value: 'Auth flows',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('createRequestFolder', () => {
  it('mints a create on the folder entity + addToSet on the parent request-collection', () => {
    const intent = createRequestFolder(ctx(), {
      folderUid: 'rf-1',
      parent: collectionParent('rcol-9'),
      name: 'New folder',
      orderKey: 'mm',
    });
    expect(intent.batch.mutations).toHaveLength(2);
    const [createBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(createBody).toEqual({
      kind: 'create',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rf-1',
      payload: { schemaVersion: 5, name: 'New folder', pathSegment: 'new-folder-rf-1' },
    });
    expect(addBody).toEqual({
      kind: 'addToSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-9',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rf-1',
      item: { uid: 'rf-1' },
      orderKey: 'mm',
    });
  });

  it('routes the parent slot to a request-folder parent when nesting', () => {
    const intent = createRequestFolder(ctx(), {
      folderUid: 'rf-leaf',
      parent: folderParent('rf-root'),
      name: 'Leaf',
    });
    const addBody = intent.batch.mutations[1].body;
    expect(addBody).toMatchObject({
      kind: 'addToSet',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rf-root',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rf-leaf',
    });
  });

  it('honors an explicit pathSegment override (preserve legacy slugs on import)', () => {
    const intent = createRequestFolder(ctx(), {
      folderUid: 'rf-1',
      parent: collectionParent(),
      name: 'New name',
      pathSegment: 'legacy-slug-rf-1',
    });
    const createBody = intent.batch.mutations[0].body;
    expect(createBody).toMatchObject({
      payload: { name: 'New name', pathSegment: 'legacy-slug-rf-1' },
    });
  });

  it('shares one batchId across both envelopes (per-batch all-or-nothing)', () => {
    const intent = createRequestFolder(ctx({ batchId: 'b-create-folder' }), {
      folderUid: 'rf-1',
      parent: collectionParent(),
      name: 'X',
    });
    expect(intent.batch.batchId).toBe('b-create-folder');
  });
});

describe('deleteRequestFolder', () => {
  it('emits removeFromSet on the parent + entity tombstone, in that order', () => {
    const intent = deleteRequestFolder(ctx(), {
      folderUid: 'rf-1',
      parent: collectionParent('rcol-9'),
    });
    expect(intent.batch.mutations).toHaveLength(2);
    const [removeBody, deleteBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toEqual({
      kind: 'removeFromSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-9',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rf-1',
    });
    expect(deleteBody).toEqual({ kind: 'delete', type: REQUEST_FOLDER_ENTITY_TYPE, id: 'rf-1' });
  });
});

describe('moveRequestFolder — intra-parent reorder', () => {
  it('emits one moveBefore when oldParent matches newParent', () => {
    const parent = collectionParent('rcol-9');
    const intent = moveRequestFolder(ctx(), {
      folderUid: 'rf-1',
      newParent: parent,
      oldParent: parent,
      orderKey: 'qz',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'moveBefore',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-9',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rf-1',
      orderKey: 'qz',
    });
  });

  it('treats omitted oldParent as same-parent reorder', () => {
    const intent = moveRequestFolder(ctx(), {
      folderUid: 'rf-1',
      newParent: collectionParent(),
      orderKey: 'a',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body.kind).toBe('moveBefore');
  });
});

describe('moveRequestFolder — reparent', () => {
  it('emits remove from old + add to new with the new orderKey, atomic batch', () => {
    const intent = moveRequestFolder(ctx({ batchId: 'b-move' }), {
      folderUid: 'rf-1',
      newParent: folderParent('rf-target'),
      oldParent: collectionParent('rcol-source'),
      orderKey: 'm',
    });
    expect(intent.batch.batchId).toBe('b-move');
    expect(intent.batch.mutations).toHaveLength(2);
    const [removeBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toEqual({
      kind: 'removeFromSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-source',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rf-1',
    });
    expect(addBody).toEqual({
      kind: 'addToSet',
      type: REQUEST_FOLDER_ENTITY_TYPE,
      id: 'rf-target',
      path: REQUEST_FOLDER_CHILDREN_PATH,
      itemId: 'rf-1',
      item: { uid: 'rf-1' },
      orderKey: 'm',
    });
  });

  it('routes reparent across parent kinds (folder → collection)', () => {
    const intent = moveRequestFolder(ctx(), {
      folderUid: 'rf-1',
      oldParent: folderParent('rf-old'),
      newParent: collectionParent('rcol-new'),
      orderKey: 'k',
    });
    const [removeBody, addBody] = intent.batch.mutations.map((m) => m.body);
    expect(removeBody).toMatchObject({ type: REQUEST_FOLDER_ENTITY_TYPE, id: 'rf-old' });
    expect(addBody).toMatchObject({ type: REQUEST_COLLECTION_ENTITY_TYPE, id: 'rcol-new' });
  });
});
