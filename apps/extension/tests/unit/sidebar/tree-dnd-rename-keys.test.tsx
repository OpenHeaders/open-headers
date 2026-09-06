/**
 * The inline rename lives INSIDE a sortable row. Enter commits it and
 * Space belongs to the name being typed — neither may start a drag of
 * the row: the tree's keyboard half is Alt+Arrow (`useTreeKeyboardMoves`),
 * so no dnd-kit keyboard sensor listens on the rows. Pins the sidebar
 * bug where Enter in the rename input turned the row into the dashed
 * placeholder with the overlay pill hanging beside it.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { TreeDnd, type TreeDndConfig } from '@openheaders/ui/workbench/components/sidebar/TreeDnd';
import type { TreeNode } from '@openheaders/ui/workbench/components/sidebar/types';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

const CONFIG: TreeDndConfig = {
  collectionIdPrefix: 'col-',
  folderIdPrefix: 'folder-',
  leafKinds: [{ idPrefix: 'rule-', entityType: RULE_ENTITY_TYPE }],
  lookupChildren: () => [],
  lookupCollections: () => [],
  move: vi.fn(),
};

const NODES: TreeNode[] = [
  {
    id: 'col-c1',
    kind: 'group',
    label: 'Suite',
    depth: 0,
    expandable: true,
    icon: null,
    canRename: true,
    canDelete: true,
    canAddChild: true,
  },
  {
    id: 'rule-r1',
    kind: 'leaf',
    parentId: 'col-c1',
    label: 'Probe',
    depth: 1,
    expandable: false,
    icon: null,
    canRename: true,
    canDelete: true,
    canAddChild: false,
  },
];

function renderTree() {
  return render(
    <TreeDnd
      nodes={NODES}
      config={CONFIG}
      selectedIds={new Set()}
      onMoved={() => {}}
      renderNode={(node) => (
        <div data-item-id={node.id}>
          {node.id === 'rule-r1' ? (
            <input className="rules-sidebar-rename-input" aria-label="rename" defaultValue={node.label} />
          ) : (
            node.label
          )}
        </div>
      )}
    />,
  );
}

describe('TreeDnd × the inline rename input', () => {
  it('Enter and Space inside the rename input leave the row in place — no drag starts', () => {
    const { getByLabelText, container } = renderTree();
    const input = getByLabelText('rename');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(input, { key: ' ', code: 'Space' });
    expect(document.querySelector('.tree-dnd-pill')).toBeNull();
    const row = container.querySelector('[data-item-id="rule-r1"]')?.parentElement as HTMLElement | null;
    expect(row?.style.visibility ?? '').toBe('');
  });
});
