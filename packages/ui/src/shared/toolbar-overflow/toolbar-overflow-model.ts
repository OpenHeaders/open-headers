/**
 * toolbar-overflow-model — the pure fit behind a toolbar that folds its
 * tail behind a "more" chevron when the box is too short (or narrow):
 * given the items' extents along the main axis, the gap between them
 * and the room available, how many leading items stay in the bar.
 * When everything fits, everything stays; otherwise the chevron's own
 * slot is reserved first and the leading items that fit beside it
 * stay. A separator never ends the visible run and never opens the
 * folded one — it only ever sits between two items.
 */

export type ToolbarOverflowItem = { kind: 'item'; extent: number } | { kind: 'separator'; extent: number };

export interface ToolbarOverflowFit {
  /** How many leading entries of `items` stay in the bar. */
  visible: number;
  /** Index where the folded run starts (after any separator that would open it); `items.length` when nothing folds. */
  overflowStart: number;
}

export interface ToolbarOverflowInput {
  items: readonly ToolbarOverflowItem[];
  /** Room along the main axis, padding excluded. */
  available: number;
  /** Gap between consecutive entries. */
  gap: number;
  /** The chevron's extent along the main axis. */
  moreExtent: number;
}

function runExtent(items: readonly ToolbarOverflowItem[], count: number, gap: number): number {
  let total = 0;
  for (let i = 0; i < count; i += 1) total += items[i].extent + (i > 0 ? gap : 0);
  return total;
}

export function fitToolbarItems({ items, available, gap, moreExtent }: ToolbarOverflowInput): ToolbarOverflowFit {
  if (items.length === 0) return { visible: 0, overflowStart: 0 };
  if (runExtent(items, items.length, gap) <= available) return { visible: items.length, overflowStart: items.length };
  const room = available - moreExtent - gap;
  let visible = 0;
  while (visible < items.length && runExtent(items, visible + 1, gap) <= room) visible += 1;
  while (visible > 0 && items[visible - 1].kind === 'separator') visible -= 1;
  let overflowStart = visible;
  while (overflowStart < items.length && items[overflowStart].kind === 'separator') overflowStart += 1;
  return { visible, overflowStart };
}
