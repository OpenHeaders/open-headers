/**
 * Row-window virtualization for a list whose rows are all ONE height —
 * a log of any length. No array of heights and no prefix sums: a row's
 * place is its number times the height, so a million rows cost what ten
 * do.
 *
 * An engine clamps how tall a scroller's content can be (Chromium at
 * 33,554,428 px — 1,290,554 rows of 26 px — and at half that,
 * 16,777,214 px, on a display that scales by two). A list taller than that is
 * scrolled through a spacer as tall as the engine allows: the
 * scrollbar's travel stands for the whole list, and the mounted rows
 * are placed where the viewport is. Below the clamp the two are the
 * same thing and a pixel scrolled is a pixel of rows. The height the
 * engine really gave is READ BACK from the scroller, so no engine's
 * clamp is assumed here beyond the one asked for.
 *
 * Pure: a caller reads its scroller (its height, the height its content
 * was given, where it is scrolled) and is told the rows to mount, where
 * to draw them, and where to scroll for a row.
 */

/** The tallest spacer asked of an engine — Chromium's own clamp; one that gives less is read back. */
export const MAX_SPACER_PX = 33_554_428;

/** Pixels of rows mounted beyond each viewport edge, so a fast wheel fling stays painted. */
const OVERSCAN_PX = 600;

export interface FixedRowGeometry {
  /** Rows in the list. */
  count: number;
  /** One row's height, in pixels. */
  rowPx: number;
  /** The scroller's height. */
  viewportPx: number;
  /** The height of the scroller's content as the engine laid it out — the spacer's, at most the list's own. */
  heightPx: number;
}

export interface FixedRowWindow {
  /** First mounted row (inclusive). */
  start: number;
  /** End of the mounted rows (exclusive). */
  end: number;
  /** Where the first mounted row is drawn, in pixels from the top of the scroller's content. */
  offsetPx: number;
}

/** The spacer to ask the engine for: the list's own height, up to the tallest one asked. */
export function fixedRowSpacerPx(count: number, rowPx: number): number {
  return Math.min(count * rowPx, MAX_SPACER_PX);
}

/** How far the scroller travels, and how far the list does: equal while the list fits its spacer. */
function travel(geometry: FixedRowGeometry): { scroller: number; list: number } {
  const { count, rowPx, viewportPx, heightPx } = geometry;
  return { scroller: Math.max(0, heightPx - viewportPx), list: Math.max(0, count * rowPx - viewportPx) };
}

/** The list's own pixel at the viewport's top edge for a scroll position. */
function listTop(geometry: FixedRowGeometry, scrollTop: number): number {
  const { scroller, list } = travel(geometry);
  if (scroller === 0) return 0;
  const at = Math.min(Math.max(0, scrollTop), scroller);
  return list === scroller ? at : (at / scroller) * list;
}

/** The rows to mount for a scroll position, and where to draw them. */
export function computeFixedRowWindow(geometry: FixedRowGeometry, scrollTop: number): FixedRowWindow {
  const { count, rowPx, viewportPx } = geometry;
  if (count <= 0 || rowPx <= 0) return { start: 0, end: 0, offsetPx: 0 };
  const top = listTop(geometry, scrollTop);
  const start = Math.max(0, Math.floor((top - OVERSCAN_PX) / rowPx));
  const end = Math.min(count, Math.ceil((top + viewportPx + OVERSCAN_PX) / rowPx));
  // The rows are drawn where the viewport is: the scroller's own position, less how far into the list's pixels row `start` sits above it.
  const { scroller } = travel(geometry);
  const at = Math.min(Math.max(0, scrollTop), scroller);
  return { start, end, offsetPx: at - (top - start * rowPx) };
}

/** The rows the viewport itself shows for a scroll position — no overscan: `[first, last]`, both inclusive. */
export function visibleFixedRows(geometry: FixedRowGeometry, scrollTop: number): { first: number; last: number } {
  const { count, rowPx, viewportPx } = geometry;
  if (count <= 0 || rowPx <= 0) return { first: 0, last: -1 };
  const top = listTop(geometry, scrollTop);
  return {
    first: Math.min(count - 1, Math.floor(top / rowPx)),
    last: Math.min(count - 1, Math.max(0, Math.ceil((top + viewportPx) / rowPx) - 1)),
  };
}

/**
 * The scroll position that brings `row` into view: centred, or moved
 * the least that shows it whole (`nearest` — where it already shows,
 * the position given is kept).
 */
export function scrollTopForRow(
  geometry: FixedRowGeometry,
  row: number,
  align: 'center' | 'nearest',
  scrollTop: number,
): number {
  const { count, rowPx, viewportPx } = geometry;
  const { scroller, list } = travel(geometry);
  if (count <= 0 || scroller === 0) return 0;
  // A row past either end lands on the end: the position is held to the list's travel below.
  const rowTop = row * rowPx;
  let top = rowTop - (viewportPx - rowPx) / 2;
  if (align === 'nearest') {
    const current = listTop(geometry, scrollTop);
    if (rowTop >= current && rowTop + rowPx <= current + viewportPx) return scrollTop;
    top = rowTop < current ? rowTop : rowTop + rowPx - viewportPx;
  }
  const clamped = Math.min(Math.max(0, top), list);
  return list === scroller ? clamped : (clamped / list) * scroller;
}
