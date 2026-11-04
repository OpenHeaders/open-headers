/**
 * tree-selection — what a sidebar tree row is selectable FOR: the
 * multi-selection math itself is the shared `@openheaders/ui/shared/
 * selection` model (toggle, the anchor-based range); the sidebar hands
 * it the ids of its selectable visible rows. Placeholders (empty-state
 * blocks) are never rows. What a selection is used for is the
 * consumer's call: the drag takes the tree's participants, the export
 * takes the rows with an export identity.
 */

import type { TreeNode } from './types';

export function isSelectableRow(node: TreeNode): boolean {
  return node.kind !== 'placeholder';
}

/** The ids of the selectable visible rows, in display order — the order a range runs over. */
export function selectableRowIds(rows: readonly TreeNode[]): string[] {
  const ids: string[] = [];
  for (const row of rows) if (isSelectableRow(row)) ids.push(row.id);
  return ids;
}
