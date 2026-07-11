/**
 * Pure-function tests for the "Create Workflow from collection/folder"
 * seed helper. Covers:
 *
 *   - collectRequestSeeds walks the container subtree depth-first so
 *     seed order always matches the sidebar's visual order, including
 *     requests nested in folders.
 *   - `selectedUids` filters to the picker's checked set while tree
 *     order — not selection order — decides result order.
 *   - Folders contribute nothing themselves; empty trees / empty
 *     selections yield empty seed lists.
 */

import type { FolderNode, RequestNode, TreeNode } from '@openheaders/core/types';
import { collectRequestSeeds } from '@openheaders/ui/workbench/components/live/workflow-seed';
import { describe, expect, it } from 'vitest';

function req(uid: string, name: string, method = 'GET'): RequestNode {
  return { type: 'request', uid, name, path: `requests/auth-c0000001/${name}-${uid}`, method };
}

function folder(uid: string, name: string, children: TreeNode[]): FolderNode {
  return { type: 'folder', uid, name, path: `requests/auth-c0000001/${name}-${uid}`, children };
}

const TREE: TreeNode[] = [
  req('r1000001', 'login', 'POST'),
  folder('f1000001', 'tokens', [req('r1000002', 'refresh', 'POST'), req('r1000003', 'introspect')]),
  req('r1000004', 'profile'),
];

describe('collectRequestSeeds', () => {
  it('collects all requests depth-first in sidebar order', () => {
    expect(collectRequestSeeds(TREE)).toEqual([
      { requestUid: 'r1000001', requestName: 'login', method: 'POST' },
      { requestUid: 'r1000002', requestName: 'refresh', method: 'POST' },
      { requestUid: 'r1000003', requestName: 'introspect', method: 'GET' },
      { requestUid: 'r1000004', requestName: 'profile', method: 'GET' },
    ]);
  });

  it('filters to the selected uid set', () => {
    const seeds = collectRequestSeeds(TREE, new Set(['r1000003', 'r1000001']));
    expect(seeds.map((s) => s.requestUid)).toEqual(['r1000001', 'r1000003']);
  });

  it('keeps tree order regardless of selection-set construction order', () => {
    const seeds = collectRequestSeeds(TREE, new Set(['r1000004', 'r1000002']));
    expect(seeds.map((s) => s.requestUid)).toEqual(['r1000002', 'r1000004']);
  });

  it('returns empty for an empty tree, folders-only tree, or empty selection', () => {
    expect(collectRequestSeeds([])).toEqual([]);
    expect(collectRequestSeeds([folder('f1000002', 'empty', [])])).toEqual([]);
    expect(collectRequestSeeds(TREE, new Set())).toEqual([]);
  });

  it('descends nested folders', () => {
    const nested: TreeNode[] = [folder('f1000003', 'outer', [folder('f1000004', 'inner', [req('r1000005', 'deep')])])];
    expect(collectRequestSeeds(nested).map((s) => s.requestUid)).toEqual(['r1000005']);
  });
});
