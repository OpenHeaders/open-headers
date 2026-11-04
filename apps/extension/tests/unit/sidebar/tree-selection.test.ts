/**
 * Unit tests for `tree-selection` — which sidebar rows take part in
 * the shared multi-selection (the math itself is pinned under
 * `shared/multi-selection`).
 */

import { isSelectableRow, selectableRowIds } from '@openheaders/ui/workbench/components/sidebar/tree-selection';
import type { TreeNode } from '@openheaders/ui/workbench/components/sidebar/types';
import { describe, expect, it } from 'vitest';

const node = (id: string, kind: TreeNode['kind'], depth: number): TreeNode => ({
  id,
  kind,
  label: id,
  depth,
  expandable: kind !== 'leaf',
  icon: null,
  canRename: true,
  canDelete: true,
  canAddChild: kind !== 'leaf',
});

// col-a › folder-f › (empty placeholder) · grpc-x · col-b › leaf-y
const rows: TreeNode[] = [
  node('col-a', 'group', 0),
  node('folder-f', 'folder', 1),
  node('empty-f', 'placeholder', 2),
  node('grpc-x', 'leaf', 1),
  node('col-b', 'group', 0),
  node('leaf-y', 'leaf', 1),
];

describe('isSelectableRow', () => {
  it('every real row is selectable, whatever its kind or depth; placeholders are not', () => {
    expect(rows.map(isSelectableRow)).toEqual([true, true, false, true, true, true]);
  });
});

describe('selectableRowIds', () => {
  it('is the display order without the placeholders', () => {
    expect(selectableRowIds(rows)).toEqual(['col-a', 'folder-f', 'grpc-x', 'col-b', 'leaf-y']);
  });
});
