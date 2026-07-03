/**
 * Quick-create destination heuristic — `quick-rule-destination`.
 *
 * Rules created from the panel land in a folder named after the
 * captured URL's registrable domain, inside the first local collection,
 * reused when it already exists and minted at save when it doesn't. Pin
 * the domain heuristic, the reuse-vs-mint split, the override paths
 * (explicit collection / folder / root), and the degrade cases (no
 * collections, deleted folder pick, unparseable URL).
 */

import type { CollectionTree, TreeNode } from '@openheaders/core/types';
import {
  domainFolderName,
  listFolderOptions,
  resolveQuickDestination,
} from '@openheaders/ui/panel/data/rule-create/quick-rule-destination';
import { describe, expect, it } from 'vitest';

const URL = 'https://api.openheaders.io/v1/users';

function folder(uid: string, name: string, path: string, children: TreeNode[] = []): TreeNode {
  return { type: 'folder', uid, name, path, children };
}

function makeTree(over: Partial<CollectionTree> = {}): CollectionTree {
  return {
    schemaVersion: 1,
    uid: 'col-1',
    path: 'rules/collection-col-1',
    name: 'My Rules',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    tree: [],
    ...over,
  };
}

describe('domainFolderName', () => {
  it('collapses subdomains to the registrable domain and strips www', () => {
    expect(domainFolderName('https://api.openheaders.io/v1')).toBe('openheaders.io');
    expect(domainFolderName('https://www.openheaders.io/')).toBe('openheaders.io');
    expect(domainFolderName('https://openheaders.io')).toBe('openheaders.io');
  });

  it('keeps three labels for public second-level TLDs', () => {
    expect(domainFolderName('https://api.openheaders.co.uk/x')).toBe('openheaders.co.uk');
  });

  it('passes IPs, localhost, and single labels through', () => {
    expect(domainFolderName('http://127.0.0.1:3000/x')).toBe('127.0.0.1');
    expect(domainFolderName('http://localhost:5173/')).toBe('localhost');
  });

  it('returns null for unparseable URLs', () => {
    expect(domainFolderName('not a url')).toBeNull();
    expect(domainFolderName('')).toBeNull();
  });
});

describe('resolveQuickDestination — auto (heuristic)', () => {
  it('mints the domain folder when the collection has none', () => {
    const plan = resolveQuickDestination(URL, [makeTree()], null);
    expect(plan.collection?.uid).toBe('col-1');
    expect(plan.folderPath).toBeNull();
    expect(plan.newFolderName).toBe('openheaders.io');
    expect(plan.folderLabel).toBe('openheaders.io');
  });

  it('reuses an existing top-level domain folder', () => {
    const tree = makeTree({
      tree: [folder('f-1', 'openheaders.io', 'rules/collection-col-1/openheaders-io-f-1')],
    });
    const plan = resolveQuickDestination(URL, [tree], null);
    expect(plan.folderPath).toBe('rules/collection-col-1/openheaders-io-f-1');
    expect(plan.newFolderName).toBeNull();
    expect(plan.folderLabel).toBe('openheaders.io');
  });

  it('degrades to the collection root when the URL yields no domain', () => {
    const plan = resolveQuickDestination('not a url', [makeTree()], null);
    expect(plan.folderPath).toBeNull();
    expect(plan.newFolderName).toBeNull();
    expect(plan.folderLabel).toBeNull();
  });

  it('carries a null collection when the workspace has none', () => {
    const plan = resolveQuickDestination(URL, [], null);
    expect(plan.collection).toBeNull();
    expect(plan.newFolderName).toBe('openheaders.io');
  });
});

describe('resolveQuickDestination — overrides', () => {
  const treeA = makeTree({
    tree: [folder('f-1', 'openheaders.io', 'rules/collection-col-1/openheaders-io-f-1')],
  });
  const treeB = makeTree({ uid: 'col-2', path: 'rules/collection-col-2', name: 'Other', tree: [] });

  it('root pins the collection root', () => {
    const plan = resolveQuickDestination(URL, [treeA], { folder: { kind: 'root' } });
    expect(plan.folderPath).toBeNull();
    expect(plan.newFolderName).toBeNull();
  });

  it('an explicit folder pins that folder', () => {
    const plan = resolveQuickDestination(URL, [treeA], {
      folder: { kind: 'folder', path: 'rules/collection-col-1/openheaders-io-f-1' },
    });
    expect(plan.folderPath).toBe('rules/collection-col-1/openheaders-io-f-1');
    expect(plan.folderLabel).toBe('openheaders.io');
  });

  it('a folder deleted since it was picked degrades to the root', () => {
    const plan = resolveQuickDestination(URL, [treeA], { folder: { kind: 'folder', path: 'rules/gone' } });
    expect(plan.folderPath).toBeNull();
    expect(plan.newFolderName).toBeNull();
  });

  it('switching collections re-applies the domain heuristic inside it', () => {
    const plan = resolveQuickDestination(URL, [treeA, treeB], { collectionUid: 'col-2', folder: { kind: 'auto' } });
    expect(plan.collection?.uid).toBe('col-2');
    expect(plan.newFolderName).toBe('openheaders.io');
  });
});

describe('listFolderOptions', () => {
  it('flattens nested folders depth-first with depths', () => {
    const tree = [
      folder('f-1', 'a', 'rules/c/a', [folder('f-2', 'b', 'rules/c/a/b')]),
      folder('f-3', 'c', 'rules/c/c'),
    ];
    expect(listFolderOptions(tree)).toEqual([
      { path: 'rules/c/a', name: 'a', depth: 0 },
      { path: 'rules/c/a/b', name: 'b', depth: 1 },
      { path: 'rules/c/c', name: 'c', depth: 0 },
    ]);
  });
});
