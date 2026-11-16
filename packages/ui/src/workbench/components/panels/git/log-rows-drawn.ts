/**
 * log-rows-drawn — the rows a log's list draws for where its scroller
 * stands.
 *
 * A read is asked and answered across the bridge: its rows land after
 * the frame that scrolled to them is painted. A list that drew only the
 * rows of its position would draw none while its scrollbar is dragged —
 * every answer lands where the view no longer is. So the position's own
 * rows are drawn where the list holds every one the viewport shows, and
 * otherwise the read rows NEAREST them stand in: the nearest page held,
 * as many of its rows as the viewport shows, held still in it until the
 * position's own land. No row is drawn empty while a read one can stand
 * in its place.
 *
 * Pure — the draw is `LogRowList`.
 */

import { LOG_PAGE_ROWS, type LogRowPages, type LogRowRange } from './log-row-pages';

export type LogRowsDrawn =
  /** The position's own rows, each at its place under the scroller. */
  | { standing: false }
  /** Rows `[first, last]` stand in the viewport, the first at its top. */
  | { standing: true; first: number; last: number };

const AT_THE_POSITION: LogRowsDrawn = { standing: false };

const pageOf = (row: number): number => Math.floor(row / LOG_PAGE_ROWS);

/**
 * What a list draws while its viewport shows rows `inView` of `held`:
 * those rows where every one is held — or none is held anywhere — else
 * rows of the held page nearest them, the earlier page where two are as
 * near.
 */
export function logRowsDrawn(held: LogRowPages, inView: LogRowRange): LogRowsDrawn {
  const { first } = inView;
  // A viewport measured over a longer list than the one held shows no row past this one's end.
  const last = Math.min(held.total - 1, inView.last);
  const firstPage = pageOf(first);
  const lastPage = pageOf(last);

  let missing = false;
  for (let page = firstPage; page <= lastPage; page += 1) missing ||= !held.pages.has(page);
  if (!missing) return AT_THE_POSITION;

  let nearest = -1;
  let gap = Number.POSITIVE_INFINITY;
  for (const page of held.pages.keys()) {
    const away = page < firstPage ? firstPage - page : page > lastPage ? page - lastPage : 0;
    if (away < gap || (away === gap && page < nearest)) {
      nearest = page;
      gap = away;
    }
  }
  if (nearest === -1) return AT_THE_POSITION;

  const shown = last - first + 1;
  const start = nearest * LOG_PAGE_ROWS;
  const end = start + (held.pages.get(nearest)?.rows.length ?? 0) - 1;
  // A page above the position, or its top part, stands on its last rows; one below, or its bottom part, on its first.
  return nearest <= firstPage
    ? { standing: true, first: Math.max(start, end - shown + 1), last: end }
    : { standing: true, first: start, last: Math.min(end, start + shown - 1) };
}
