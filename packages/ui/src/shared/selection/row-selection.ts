/**
 * row-selection — the multi-selection contract (`multi-selection.ts`)
 * over a list addressed by ROW NUMBER, of any length: a plain click
 * selects the row alone, Cmd/Ctrl+click toggles it, Shift+click selects
 * the run from the anchor on top of the selection the anchor was made
 * with, a step moves the cursor (Shift extends), a right-click inside
 * the selection keeps it.
 *
 * The selected rows are held as RANGES — in order and apart — so a
 * Shift+click across a million rows is one range, and whether a row is
 * selected is a search among the ranges, never a set of every row.
 * Nothing here knows how long the list is: a consumer never hands in a
 * row its list does not hold, and drops the selection with the list.
 * Pure shaping; no React.
 */

import type { SelectModifiers } from './multi-selection';

/** A run of selected rows: `[first, last]`, both inclusive. */
export interface RowRange {
  first: number;
  last: number;
}

export interface RowSelectionAnchor {
  row: number;
  /** The selection as it stood when the anchor was set — what a range grows on top of. */
  base: readonly RowRange[];
}

export interface RowSelection {
  /** The selected rows — ranges in order, no two touching. */
  ranges: readonly RowRange[];
  /** The range anchor — the last plain or toggled click, with the selection it was set on. */
  anchor: RowSelectionAnchor | null;
  /** The keyboard cursor — the last row clicked or stepped to. */
  lead: number | null;
}

const NO_ROWS: readonly RowRange[] = [];

export const EMPTY_ROW_SELECTION: RowSelection = { ranges: NO_ROWS, anchor: null, lead: null };

/** The range that holds `row`, by its place among the ranges; -1 for none. */
function rangeOf(ranges: readonly RowRange[], row: number): number {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (ranges[middle].last < row) low = middle + 1;
    else if (ranges[middle].first > row) high = middle - 1;
    else return middle;
  }
  return -1;
}

export function rowSelected(ranges: readonly RowRange[], row: number): boolean {
  return rangeOf(ranges, row) !== -1;
}

export function selectedRowCount(ranges: readonly RowRange[]): number {
  let count = 0;
  for (const range of ranges) count += range.last - range.first + 1;
  return count;
}

/** The first `limit` selected rows, in list order. */
export function selectedRows(ranges: readonly RowRange[], limit: number): number[] {
  const rows: number[] = [];
  for (const range of ranges) {
    for (let row = range.first; row <= range.last; row += 1) {
      if (rows.length >= limit) return rows;
      rows.push(row);
    }
  }
  return rows;
}

/** The ranges with every row between `a` and `b` selected, either direction; the input is never mutated. */
export function withRows(ranges: readonly RowRange[], a: number, b: number): RowRange[] {
  let first = Math.min(a, b);
  let last = Math.max(a, b);
  const before: RowRange[] = [];
  const after: RowRange[] = [];
  for (const range of ranges) {
    if (range.last < first - 1) before.push(range);
    else if (range.first > last + 1) after.push(range);
    else {
      first = Math.min(first, range.first);
      last = Math.max(last, range.last);
    }
  }
  return [...before, { first, last }, ...after];
}

/** The ranges with `row` flipped in or out; the input is never mutated. */
export function toggleRow(ranges: readonly RowRange[], row: number): RowRange[] {
  const at = rangeOf(ranges, row);
  if (at === -1) return withRows(ranges, row, row);
  const { first, last } = ranges[at];
  return [
    ...ranges.slice(0, at),
    ...(first < row ? [{ first, last: row - 1 }] : []),
    ...(row < last ? [{ first: row + 1, last }] : []),
    ...ranges.slice(at + 1),
  ];
}

/** The selection of `row` alone, anchored there on an empty base. */
export function selectRowOnly(row: number): RowSelection {
  return { ranges: [{ first: row, last: row }], anchor: { row, base: NO_ROWS }, lead: row };
}

/** The anchor a range grows from — the set one, else the cursor, else the row itself on the current selection. */
function rangeAnchor(selection: RowSelection, row: number): RowSelectionAnchor {
  if (selection.anchor !== null) return selection.anchor;
  return { row: selection.lead ?? row, base: selection.ranges };
}

/** The selection after a click on `row` with the modifiers held. */
export function selectRowOnClick(selection: RowSelection, row: number, modifiers: SelectModifiers): RowSelection {
  if (modifiers.range) {
    const anchor = rangeAnchor(selection, row);
    return { ranges: withRows(anchor.base, anchor.row, row), anchor, lead: row };
  }
  if (modifiers.toggle) {
    const ranges = toggleRow(selection.ranges, row);
    return { ranges, anchor: { row, base: ranges }, lead: row };
  }
  return selectRowOnly(row);
}

/** The selection after the keyboard lands on `row` — Shift extends the range from the anchor. */
export function selectRowOnStep(selection: RowSelection, row: number, extend: boolean): RowSelection {
  if (!extend) return selectRowOnly(row);
  const anchor = rangeAnchor(selection, row);
  return { ranges: withRows(anchor.base, anchor.row, row), anchor, lead: row };
}

/** The selection after a right-click on `row` — kept when the row is already in it. */
export function selectRowOnContextMenu(selection: RowSelection, row: number): RowSelection {
  return rowSelected(selection.ranges, row) ? selection : selectRowOnly(row);
}
