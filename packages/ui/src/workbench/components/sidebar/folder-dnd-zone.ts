/**
 * folder-dnd-zone — classify a drag-over's drop zone against a row.
 *
 * The dnd surface for sibling-ordered folder trees (FolderDndTree) needs
 * three distinct gestures over a folder row:
 *
 *   - 'before' — insert dragged folder as a sibling, ABOVE the over-row.
 *   - 'into'   — drop dragged folder INTO the over-row (over-row becomes
 *                the new parent).
 *   - 'after'  — insert dragged folder as a sibling, BELOW the over-row.
 *
 * Splitting the row into top-edge / middle / bottom-edge bands matches
 * the convention every file-tree dnd UI uses (file managers and IDE
 * project view). Threshold defaults to 25% per edge band — adjustable
 * for callers that want a more aggressive 'into' affordance.
 *
 * For collection (group) rows that can't accept siblings (root-level
 * containers in our trees), callers coerce the result to 'into'
 * regardless of pointer position — there's no row above or below them
 * within the same parent.
 */

export type DropZone = 'before' | 'into' | 'after';

export interface RowRect {
  top: number;
  height: number;
}

export function classifyDropZone(pointerY: number, rect: RowRect, threshold = 0.25): DropZone {
  if (rect.height <= 0) return 'into';
  const offset = pointerY - rect.top;
  const beforeBoundary = rect.height * threshold;
  const afterBoundary = rect.height * (1 - threshold);
  if (offset < beforeBoundary) return 'before';
  if (offset > afterBoundary) return 'after';
  return 'into';
}
