import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  FOLDER_TREE_KINDS,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_TREE_KINDS,
  resolveTreeParent,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_TREE_KINDS,
} from '../../../../src/sync';

const lookup = {
  collections: [{ uid: 'colaaaaa', path: 'rules/api-colaaaaa' }],
  folders: [{ uid: 'foldbbbb', path: 'rules/api-colaaaaa/auth-foldbbbb' }],
};

describe('resolveTreeParent — authoritative lists first', () => {
  it('matches a collection by exact path', () => {
    expect(resolveTreeParent('rules/api-colaaaaa', lookup, FOLDER_TREE_KINDS)).toEqual({
      type: COLLECTION_ENTITY_TYPE,
      uid: 'colaaaaa',
    });
  });

  it('matches a folder by exact path', () => {
    expect(resolveTreeParent('rules/api-colaaaaa/auth-foldbbbb', lookup, FOLDER_TREE_KINDS)).toEqual({
      type: FOLDER_ENTITY_TYPE,
      uid: 'foldbbbb',
    });
  });

  it('a list match wins over the segment even when the directory name was hand-renamed', () => {
    const renamed = { collections: [{ uid: 'colaaaaa', path: 'rules/hand-named' }], folders: [] };
    expect(resolveTreeParent('rules/hand-named', renamed, FOLDER_TREE_KINDS)).toEqual({
      type: COLLECTION_ENTITY_TYPE,
      uid: 'colaaaaa',
    });
  });
});

describe('resolveTreeParent — uid tail fallback', () => {
  const empty = { collections: [], folders: [] };

  it('a two-segment path under the tree prefix is a collection', () => {
    expect(resolveTreeParent('requests/billing-colcccc1', empty, REQUEST_FOLDER_TREE_KINDS)).toEqual({
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      uid: 'colcccc1',
    });
  });

  it('a deeper path is a folder, identified by its own last segment', () => {
    expect(
      resolveTreeParent('requests/billing-colcccc1/v2-folddddd/auth-foldeee1', empty, REQUEST_FOLDER_TREE_KINDS),
    ).toEqual({ type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'foldeee1' });
  });

  it('a bare-uid segment (empty slug) resolves', () => {
    expect(resolveTreeParent('templates/colfffff', empty, TEMPLATE_FOLDER_TREE_KINDS)).toEqual({
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      uid: 'colfffff',
    });
  });

  it('refuses a path outside the tree, at the tree root, or without a uid tail', () => {
    expect(resolveTreeParent('requests/api-colaaaaa', empty, FOLDER_TREE_KINDS)).toBeNull();
    expect(resolveTreeParent('rules', empty, FOLDER_TREE_KINDS)).toBeNull();
    expect(resolveTreeParent('rules/hand-named', empty, FOLDER_TREE_KINDS)).toBeNull();
    expect(resolveTreeParent('rules/api-TOOLONGUID', empty, FOLDER_TREE_KINDS)).toBeNull();
  });
});
