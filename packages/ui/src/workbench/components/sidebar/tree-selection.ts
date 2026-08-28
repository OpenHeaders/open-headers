/**
 * tree-selection — pure math for the sidebar's multi-selection, the
 * IDE tree contract over the visible flat row list:
 *
 *   - Cmd/Ctrl+click toggles one row and makes it the anchor.
 *   - Shift+click selects the run of visible rows between the anchor
 *     and the clicked row — every depth, folders and leaves alike —
 *     on top of the selection the anchor was made with; the anchor
 *     stays, so a second Shift+click re-ranges from the same row
 *     rather than from the last one clicked.
 *   - A plain click collapses the selection and makes its row the
 *     anchor (the "current" row a range grows from).
 *
 * What a row is selectable FOR is the consumer's call: the drag takes
 * the tree's participants, the export takes the rows with an export
 * identity. Placeholders (empty-state blocks) are never rows.
 */

import type { TreeNode } from './types';

export interface SelectionAnchor {
  id: string;
  /** The selection as it stood when the anchor was set — what a range grows on top of. */
  base: ReadonlySet<string>;
}

export function isSelectableRow(node: TreeNode): boolean {
  return node.kind !== 'placeholder';
}

export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** The anchor's base plus every selectable visible row between the anchor and `id`, inclusive. */
export function rangeSelection(rows: readonly TreeNode[], anchor: SelectionAnchor, id: string): Set<string> {
  const a = rows.findIndex((n) => n.id === anchor.id);
  const b = rows.findIndex((n) => n.id === id);
  const next = new Set(anchor.base);
  if (a < 0 || b < 0) {
    next.add(id);
    return next;
  }
  const [from, to] = a <= b ? [a, b] : [b, a];
  for (let i = from; i <= to; i++) {
    const row = rows[i];
    if (isSelectableRow(row)) next.add(row.id);
  }
  return next;
}
