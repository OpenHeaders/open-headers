/**
 * tree-dnd-zone — classify a drag-over's drop zone against a row.
 *
 * A container row (folder) has three bands: 'before' — insert as a
 * sibling above; 'into' — drop inside, the row becomes the parent;
 * 'after' — insert as a sibling below. The edge bands default to 25%
 * of the row each, the convention of file managers and IDE project
 * views.
 *
 * A row that cannot be dropped INTO (a leaf; a collection while a
 * collection is dragged) has two bands split at the middle — the row
 * is only ever a sibling anchor. Collection rows receiving a folder or
 * a leaf are coerced to 'into' by the caller regardless of pointer
 * position: nothing sits beside a top-level container.
 */

export type DropZone = 'before' | 'into' | 'after';
export type SiblingZone = Exclude<DropZone, 'into'>;

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

export function classifySiblingZone(pointerY: number, rect: RowRect): SiblingZone {
  if (rect.height <= 0) return 'after';
  return pointerY - rect.top < rect.height / 2 ? 'before' : 'after';
}
