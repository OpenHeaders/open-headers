// @vitest-environment jsdom
/**
 * Hovering a sidebar row lights its parent's indent guide in the
 * primary down the parent's whole visible subtree — the drop guide's
 * picture for a pointer at rest. Pins: the guide spans at the parent's
 * level on every row of the subtree (and no other), a root row clears
 * it, leaving the tree clears it, and a live drag guide suppresses it.
 */

import type { TreeNode } from '@openheaders/ui/workbench/components/sidebar/types';
import { GUIDE_PARENT_CLASS, useGuideHover } from '@openheaders/ui/workbench/components/sidebar/useGuideHover';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type React from 'react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});

function node(id: string, depth: number, parentId?: string): TreeNode {
  return {
    id,
    kind: depth === 0 ? 'folder' : 'leaf',
    label: id,
    depth,
    expandable: depth === 0,
    parentId,
    icon: null,
    canRename: false,
    canDelete: false,
    canAddChild: false,
  };
}

// col > [a, sub > [b], c], other
const NODES: TreeNode[] = [
  node('col', 0),
  node('a', 1, 'col'),
  node('sub', 1, 'col'),
  node('b', 2, 'sub'),
  node('c', 1, 'col'),
  node('other', 0),
];

const Tree: React.FC<{ nodes: TreeNode[]; dragging?: boolean }> = ({ nodes, dragging }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useGuideHover(ref, nodes);
  return (
    <div ref={ref} data-testid="tree">
      {dragging && <span className="tree-dnd-guide" />}
      {nodes.map((n) => (
        <div key={n.id} data-item-id={n.id}>
          {Array.from({ length: n.depth }, (_, level) => (
            <span key={level} className="rules-sidebar-item-guide" data-guide-level={level} />
          ))}
          {n.label}
        </div>
      ))}
    </div>
  );
};

function litRows(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(`.${GUIDE_PARENT_CLASS}`)).map(
    (span) =>
      `${span.closest('[data-item-id]')?.getAttribute('data-item-id')}@${span.getAttribute('data-guide-level')}`,
  );
}

describe('useGuideHover', () => {
  it('lights the parent level guide on every row of the parent subtree', () => {
    const { getByTestId, getByText } = render(<Tree nodes={NODES} />);
    fireEvent.mouseOver(getByText('a'));
    expect(litRows(getByTestId('tree'))).toEqual(['a@0', 'sub@0', 'b@0', 'c@0']);
    fireEvent.mouseOver(getByText('b'));
    expect(litRows(getByTestId('tree'))).toEqual(['b@1']);
  });

  it('clears on a root row and when the pointer leaves the tree', () => {
    const { getByTestId, getByText } = render(<Tree nodes={NODES} />);
    fireEvent.mouseOver(getByText('c'));
    expect(litRows(getByTestId('tree'))).toHaveLength(4);
    fireEvent.mouseOver(getByText('other'));
    expect(litRows(getByTestId('tree'))).toEqual([]);
    fireEvent.mouseOver(getByText('c'));
    fireEvent.mouseLeave(getByTestId('tree'));
    expect(litRows(getByTestId('tree'))).toEqual([]);
  });

  it('stays dark while a drag paints its own guide', () => {
    const { getByTestId, getByText } = render(<Tree nodes={NODES} dragging />);
    fireEvent.mouseOver(getByText('a'));
    expect(litRows(getByTestId('tree'))).toEqual([]);
  });
});
