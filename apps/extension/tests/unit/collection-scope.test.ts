import type { Collection, CollectionTree, FolderNode, TreeNode, Variable } from '@openheaders/core/types';
import { VariableResolver } from '@openheaders/core/variables';
import {
  type CollectionFamilies,
  type CollectionTreeFamilies,
  feedCollectionVariablesToResolver,
  findCollectionByPath,
  findCollectionByUid,
  findCollectionWithFamily,
  findFolderByUid,
  iterateAllCollections,
} from '@openheaders/ui/shared/variables';
import { describe, expect, it } from 'vitest';

function coll(uid: string, path: string, vars: Variable[] = []): Collection {
  return {
    schemaVersion: 5,
    uid,
    path,
    name: path.split('/').pop() ?? path,
    variables: vars,
    defaultEnvironmentId: null,
    pinnedEnvironmentIds: [],
  } as Collection;
}

const RULE_A = coll('rc-a', 'rules/A', [{ uid: '0b02d0ac', name: 'X', value: 'rule', type: 'default' }]);
const RULE_B = coll('rc-b', 'rules/B');
const REQ_A = coll('qc-a', 'requests/A', [{ uid: 'f044b24a', name: 'X', value: 'request', type: 'default' }]);
const REQ_NESTED = coll('qc-n', 'requests/A/nested');
const TEMPL_A = coll('tc-a', 'templates/A', [{ uid: '60c01e79', name: 'X', value: 'template', type: 'default' }]);

const FAMILIES: CollectionFamilies = {
  ruleCollections: [RULE_A, RULE_B],
  requestCollections: [REQ_A, REQ_NESTED],
  templateCollections: [TEMPL_A],
};

describe('findCollectionByUid', () => {
  it('finds across all three families', () => {
    expect(findCollectionByUid('rc-a', FAMILIES)).toBe(RULE_A);
    expect(findCollectionByUid('qc-a', FAMILIES)).toBe(REQ_A);
    expect(findCollectionByUid('tc-a', FAMILIES)).toBe(TEMPL_A);
  });
  it('returns null for unknown uid', () => {
    expect(findCollectionByUid('does-not-exist', FAMILIES)).toBeNull();
  });
});

describe('findCollectionWithFamily', () => {
  it('tags rule, request, and template collections with the right family', () => {
    expect(findCollectionWithFamily('rc-a', FAMILIES)?.family).toBe('rule');
    expect(findCollectionWithFamily('qc-a', FAMILIES)?.family).toBe('request');
    expect(findCollectionWithFamily('tc-a', FAMILIES)?.family).toBe('template');
  });
  it('returns null for unknown uid', () => {
    expect(findCollectionWithFamily('does-not-exist', FAMILIES)).toBeNull();
  });
});

describe('findCollectionByPath', () => {
  it('matches a rule path against a rule collection', () => {
    expect(findCollectionByPath('rules/A/r1', FAMILIES)).toBe(RULE_A);
  });
  it('matches a request path against a request collection (NOT a rule one)', () => {
    expect(findCollectionByPath('requests/A/q1', FAMILIES)).toBe(REQ_A);
  });
  it('matches a template path against a template collection', () => {
    expect(findCollectionByPath('templates/A/t1', FAMILIES)).toBe(TEMPL_A);
  });
  it('prefers the longest prefix within a family', () => {
    expect(findCollectionByPath('requests/A/nested/q1', FAMILIES)).toBe(REQ_NESTED);
  });
  it('returns null for an orphan path', () => {
    expect(findCollectionByPath('orphan/x', FAMILIES)).toBeNull();
  });
});

describe('feedCollectionVariablesToResolver', () => {
  it('feeds variables from every family into one resolver', () => {
    const resolver = new VariableResolver();
    feedCollectionVariablesToResolver(resolver, FAMILIES);
    expect(resolver.resolve('X', { collectionId: 'rc-a' })?.value).toBe('rule');
    expect(resolver.resolve('X', { collectionId: 'qc-a' })?.value).toBe('request');
    expect(resolver.resolve('X', { collectionId: 'tc-a' })?.value).toBe('template');
  });

  it('drops uids no longer present when previousUids is provided', () => {
    const resolver = new VariableResolver();
    const first = feedCollectionVariablesToResolver(resolver, FAMILIES);
    expect(resolver.resolve('X', { collectionId: 'rc-a' })?.value).toBe('rule');
    // Re-feed without RULE_A
    feedCollectionVariablesToResolver(
      resolver,
      { ...FAMILIES, ruleCollections: [RULE_B] },
      first,
    );
    expect(resolver.resolve('X', { collectionId: 'rc-a' })).toBeNull();
    // Other families intact.
    expect(resolver.resolve('X', { collectionId: 'qc-a' })?.value).toBe('request');
  });
});

describe('iterateAllCollections', () => {
  it('yields all five collections in family order', () => {
    const uids = [...iterateAllCollections(FAMILIES)].map((c) => c.uid);
    expect(uids).toEqual(['rc-a', 'rc-b', 'qc-a', 'qc-n', 'tc-a']);
  });
});

function folder(uid: string, name: string, path: string, children: TreeNode[] = []): FolderNode {
  return { type: 'folder', uid, name, path, children };
}

function tree(col: Collection, treeNodes: TreeNode[]): CollectionTree {
  return { ...col, tree: treeNodes };
}

const RULE_FOLDER = folder('rf-1', 'Auth', 'rules/A/auth');
const RULE_FOLDER_NESTED = folder('rf-2', 'OAuth', 'rules/A/auth/oauth');
const RULE_TREE = tree(RULE_A, [
  { ...RULE_FOLDER, children: [RULE_FOLDER_NESTED] } as FolderNode,
]);
const REQ_FOLDER = folder('qf-1', 'Login', 'requests/A/login');
const REQ_TREE = tree(REQ_A, [REQ_FOLDER]);
const TPL_FOLDER = folder('tf-1', 'Headers', 'templates/A/headers');
const TPL_TREE = tree(TEMPL_A, [TPL_FOLDER]);

const TREE_FAMILIES: CollectionTreeFamilies = {
  ruleTrees: [RULE_TREE],
  requestTrees: [REQ_TREE],
  templateTrees: [TPL_TREE],
};

describe('findFolderByUid', () => {
  it('returns the rule family + correct collection metadata for a rule folder', () => {
    const hit = findFolderByUid('rf-1', TREE_FAMILIES);
    expect(hit).not.toBeNull();
    expect(hit?.family).toBe('rule');
    expect(hit?.folder.uid).toBe('rf-1');
    expect(hit?.collectionUid).toBe('rc-a');
    expect(hit?.collectionName).toBe('A');
    expect(hit?.folderTrail).toEqual([]);
  });

  it('returns the parent trail for a nested folder', () => {
    const hit = findFolderByUid('rf-2', TREE_FAMILIES);
    expect(hit?.family).toBe('rule');
    expect(hit?.folder.uid).toBe('rf-2');
    expect(hit?.folderTrail).toEqual(['Auth']);
  });

  it('disambiguates request and template folders by uid', () => {
    expect(findFolderByUid('qf-1', TREE_FAMILIES)?.family).toBe('request');
    expect(findFolderByUid('tf-1', TREE_FAMILIES)?.family).toBe('template');
  });

  it('returns null for an unknown uid', () => {
    expect(findFolderByUid('does-not-exist', TREE_FAMILIES)).toBeNull();
  });
});
