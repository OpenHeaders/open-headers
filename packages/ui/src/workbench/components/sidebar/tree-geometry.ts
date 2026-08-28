/**
 * Sidebar tree row geometry, shared by the row renderer and the
 * folder drag handle so both compute the same columns.
 *
 * Every row reserves the caret slot (empty on leaves) so an expandable
 * row's icon and label line up with its siblings, and one level of
 * indent is exactly slot + row gap: a child's caret sits under its
 * parent's icon. The gap mirrors `.rules-sidebar-item { gap }`; the
 * inset and margin mirror its `padding` and `margin`.
 */
export const CARET_SLOT = 12;
export const ROW_GAP = 4;
export const ROW_INDENT = CARET_SLOT + ROW_GAP;
export const ROW_INSET = 8;
export const ROW_MARGIN = 4;

/** Left padding of a row at `depth`. */
export function rowPaddingLeft(depth: number): number {
  return ROW_INSET + depth * ROW_INDENT;
}
