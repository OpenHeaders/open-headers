/**
 * Collections are the top-level children of a tree: the workspace
 * roots singleton owns one ordered set per tree, and every collection
 * catalog's lifecycle rides the generic child verbs against it.
 */

import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_MUTATOR_VERSION,
  createCollection,
  createRequestCollection,
  createTemplateCollection,
  deleteCollection,
  deleteRequestCollection,
  deleteTemplateCollection,
  type MutatorContext,
  moveCollection,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_MUTATOR_VERSION,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_MUTATOR_VERSION,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
} from '../../../../src/sync';

const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const trees = [
  {
    label: 'rule',
    entityType: COLLECTION_ENTITY_TYPE,
    version: COLLECTION_MUTATOR_VERSION,
    rootsPath: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
    create: () => createCollection(ctx(), { collectionUid: 'col-1', payload: { name: 'API' }, orderKey: 'mm' }),
    remove: () => deleteCollection(ctx(), { collectionUid: 'col-1' }),
  },
  {
    label: 'request',
    entityType: REQUEST_COLLECTION_ENTITY_TYPE,
    version: REQUEST_COLLECTION_MUTATOR_VERSION,
    rootsPath: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
    create: () => createRequestCollection(ctx(), { collectionUid: 'col-1', payload: { name: 'API' }, orderKey: 'mm' }),
    remove: () => deleteRequestCollection(ctx(), { collectionUid: 'col-1' }),
  },
  {
    label: 'template',
    entityType: TEMPLATE_COLLECTION_ENTITY_TYPE,
    version: TEMPLATE_COLLECTION_MUTATOR_VERSION,
    rootsPath: WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
    create: () => createTemplateCollection(ctx(), { collectionUid: 'col-1', payload: { name: 'API' }, orderKey: 'mm' }),
    remove: () => deleteTemplateCollection(ctx(), { collectionUid: 'col-1' }),
  },
];

describe('workspace roots', () => {
  it('is one fixed singleton parent', () => {
    expect(WORKSPACE_ROOTS_REF).toEqual({ type: WORKSPACE_ROOTS_ENTITY_TYPE, uid: WORKSPACE_ROOTS_ID });
  });
});

describe.each(trees)('$label collection lifecycle', ({ entityType, version, rootsPath, create, remove }) => {
  it("create mints the entity + the roots slot on the tree's own set, under the catalog version", () => {
    const intent = create();
    expect(intent.batch.mutations.map((m) => m.mutatorVersion)).toEqual([version, version]);
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'create', type: entityType, id: 'col-1', payload: { name: 'API' } },
      {
        kind: 'addToSet',
        type: WORKSPACE_ROOTS_ENTITY_TYPE,
        id: WORKSPACE_ROOTS_ID,
        path: rootsPath,
        itemId: 'col-1',
        item: { uid: 'col-1' },
        orderKey: 'mm',
      },
    ]);
  });

  it('delete tombstones the roots slot then the entity', () => {
    expect(remove().batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'removeFromSet',
        type: WORKSPACE_ROOTS_ENTITY_TYPE,
        id: WORKSPACE_ROOTS_ID,
        path: rootsPath,
        itemId: 'col-1',
      },
      { kind: 'delete', type: entityType, id: 'col-1' },
    ]);
  });
});

describe('moveCollection', () => {
  it('collections never nest — a move is always a moveBefore on the roots set', () => {
    const intent = moveCollection(ctx(), { collectionUid: 'col-1', orderKey: 'qz' });
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'moveBefore',
        type: WORKSPACE_ROOTS_ENTITY_TYPE,
        id: WORKSPACE_ROOTS_ID,
        path: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
        itemId: 'col-1',
        orderKey: 'qz',
      },
    ]);
  });
});
