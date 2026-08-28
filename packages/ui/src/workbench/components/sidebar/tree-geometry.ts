/**
 * Sidebar tree row geometry.
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

/** Left offsets, inside the row, of the indent guides for a row at
 *  `depth`: one per ancestor level, centered under that level's caret. */
export function rowGuideOffsets(depth: number): number[] {
  const offsets: number[] = [];
  for (let level = 0; level < depth; level++) offsets.push(rowPaddingLeft(level) + CARET_SLOT / 2);
  return offsets;
}
