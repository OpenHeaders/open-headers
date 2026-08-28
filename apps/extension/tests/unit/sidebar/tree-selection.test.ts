/**
 * Unit tests for `tree-selection` — the pure math behind the sidebar's
 * Cmd/Ctrl+click toggle and Shift+click range over the visible rows.
 */

import {
  isSelectableRow,
  rangeSelection,
  toggleSelection,
} from '@openheaders/ui/workbench/components/sidebar/tree-selection';
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

describe('toggleSelection', () => {
  it('adds an absent id and removes a present one, never mutating the input', () => {
    const base = new Set(['col-a']);
    expect([...toggleSelection(base, 'grpc-x')]).toEqual(['col-a', 'grpc-x']);
    expect([...toggleSelection(base, 'col-a')]).toEqual([]);
    expect([...base]).toEqual(['col-a']);
  });
});

describe('rangeSelection', () => {
  it('selects the visible run between the anchor and the row, either direction, across depths and kinds', () => {
    const down = rangeSelection(rows, { id: 'folder-f', base: new Set() }, 'col-b');
    expect([...down]).toEqual(['folder-f', 'grpc-x', 'col-b']);
    const up = rangeSelection(rows, { id: 'leaf-y', base: new Set() }, 'grpc-x');
    expect([...up]).toEqual(['grpc-x', 'col-b', 'leaf-y']);
  });

  it('grows on the anchor base and skips placeholders', () => {
    const next = rangeSelection(rows, { id: 'col-a', base: new Set(['leaf-y']) }, 'grpc-x');
    expect([...next]).toEqual(['leaf-y', 'col-a', 'folder-f', 'grpc-x']);
  });

  it('a second range from the same anchor replaces the first, not extends it', () => {
    const anchor = { id: 'col-a', base: new Set<string>() };
    rangeSelection(rows, anchor, 'col-b');
    expect([...rangeSelection(rows, anchor, 'folder-f')]).toEqual(['col-a', 'folder-f']);
  });

  it('an anchor no longer visible falls back to picking the row alone', () => {
    expect([...rangeSelection(rows, { id: 'gone', base: new Set(['col-a']) }, 'leaf-y')]).toEqual(['col-a', 'leaf-y']);
  });
});
