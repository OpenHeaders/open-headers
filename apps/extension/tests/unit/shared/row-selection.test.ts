/**
 * Pure-model suite for the selection over row numbers
 * (`shared/selection/row-selection`): the ranges (in order, no two
 * touching), then plain, toggled (Cmd/Ctrl) and ranged (Shift) clicks,
 * the right-click rule and Shift+step extension — the contract of the
 * shared multi-selection, over a list of any length.
 */

import {
  EMPTY_ROW_SELECTION,
  type RowRange,
  rowSelected,
  selectedRowCount,
  selectedRows,
  selectRowOnClick,
  selectRowOnContextMenu,
  selectRowOnly,
  selectRowOnStep,
  toggleRow,
  withRows,
} from '@openheaders/ui/shared/selection';
import { describe, expect, it } from 'vitest';

const plain = { toggle: false, range: false };
const toggle = { toggle: true, range: false };
const range = { toggle: false, range: true };
const r = (first: number, last: number = first): RowRange => ({ first, last });

describe('withRows', () => {
  it('selects the run between two rows, either direction', () => {
    expect(withRows([], 3, 7)).toEqual([r(3, 7)]);
    expect(withRows([], 7, 3)).toEqual([r(3, 7)]);
    expect(withRows([], 5, 5)).toEqual([r(5)]);
  });

  it('keeps the ranges in order and apart', () => {
    expect(withRows([r(10, 12)], 2, 4)).toEqual([r(2, 4), r(10, 12)]);
    expect(withRows([r(2, 4)], 10, 12)).toEqual([r(2, 4), r(10, 12)]);
    expect(withRows([r(2, 4), r(20, 22)], 10, 12)).toEqual([r(2, 4), r(10, 12), r(20, 22)]);
  });

  it('joins a run to the ranges it meets or touches', () => {
    expect(withRows([r(2, 4)], 4, 9)).toEqual([r(2, 9)]);
    expect(withRows([r(2, 4)], 5, 9)).toEqual([r(2, 9)]);
    expect(withRows([r(6, 9)], 2, 5)).toEqual([r(2, 9)]);
    expect(withRows([r(2, 4), r(8, 9), r(20, 22)], 3, 8)).toEqual([r(2, 9), r(20, 22)]);
    expect(withRows([r(2, 4), r(8, 9), r(20, 22)], 0, 30)).toEqual([r(0, 30)]);
  });

  it('leaves a range one row apart on its own', () => {
    expect(withRows([r(2, 4)], 6, 9)).toEqual([r(2, 4), r(6, 9)]);
    expect(withRows([r(6, 9)], 2, 4)).toEqual([r(2, 4), r(6, 9)]);
  });

  it('holds a run of a million rows as one range and never mutates the input', () => {
    const base = [r(5)];
    expect(withRows(base, 0, 999_999)).toEqual([r(0, 999_999)]);
    expect(base).toEqual([r(5)]);
  });
});

describe('toggleRow', () => {
  it('adds an unselected row and takes a selected one out, never mutating the input', () => {
    const base = [r(2, 4)];
    expect(toggleRow(base, 8)).toEqual([r(2, 4), r(8)]);
    expect(toggleRow(base, 5)).toEqual([r(2, 5)]);
    expect(toggleRow(base, 3)).toEqual([r(2), r(4)]);
    expect(toggleRow(base, 2)).toEqual([r(3, 4)]);
    expect(toggleRow(base, 4)).toEqual([r(2, 3)]);
    expect(toggleRow([r(7)], 7)).toEqual([]);
    expect(base).toEqual([r(2, 4)]);
  });

  it('splits the range the row sits in and leaves the others', () => {
    expect(toggleRow([r(0, 1), r(10, 20), r(30, 31)], 15)).toEqual([r(0, 1), r(10, 14), r(16, 20), r(30, 31)]);
  });
});

describe('what is selected', () => {
  const ranges = [r(2, 4), r(10), r(500_000, 900_000)];

  it('finds a row among the ranges', () => {
    for (const row of [2, 3, 4, 10, 500_000, 700_000, 900_000]) expect(rowSelected(ranges, row)).toBe(true);
    for (const row of [0, 1, 5, 9, 11, 499_999, 900_001]) expect(rowSelected(ranges, row)).toBe(false);
    expect(rowSelected([], 0)).toBe(false);
  });

  it('counts the rows and lists the first of them in order', () => {
    expect(selectedRowCount(ranges)).toBe(3 + 1 + 400_001);
    expect(selectedRowCount([])).toBe(0);
    expect(selectedRows(ranges, 6)).toEqual([2, 3, 4, 10, 500_000, 500_001]);
    expect(selectedRows(ranges, 3)).toEqual([2, 3, 4]);
    expect(selectedRows([r(7, 8)], 200)).toEqual([7, 8]);
    expect(selectedRows(ranges, 0)).toEqual([]);
  });
});

describe('selectRowOnClick', () => {
  it('a plain click selects the row alone and anchors there on an empty base', () => {
    const next = selectRowOnClick(EMPTY_ROW_SELECTION, 5, plain);
    expect(next).toEqual({ ranges: [r(5)], anchor: { row: 5, base: [] }, lead: 5 });
    expect(selectRowOnClick(next, 9, plain)).toEqual(selectRowOnly(9));
  });

  it('a toggled click flips the row and anchors on the toggled set', () => {
    const one = selectRowOnly(5);
    const two = selectRowOnClick(one, 9, toggle);
    expect(two).toEqual({ ranges: [r(5), r(9)], anchor: { row: 9, base: [r(5), r(9)] }, lead: 9 });
    const out = selectRowOnClick(two, 5, toggle);
    expect(out).toEqual({ ranges: [r(9)], anchor: { row: 5, base: [r(9)] }, lead: 5 });
  });

  it('a ranged click selects the run from the anchor, either direction, the anchor staying', () => {
    const anchored = selectRowOnly(5);
    const down = selectRowOnClick(anchored, 9, range);
    expect(down.ranges).toEqual([r(5, 9)]);
    expect(down.anchor).toEqual(anchored.anchor);
    expect(down.lead).toBe(9);
    // A second ranged click re-ranges from the same anchor, not from the last row clicked.
    const up = selectRowOnClick(down, 2, range);
    expect(up.ranges).toEqual([r(2, 5)]);
    expect(up.lead).toBe(2);
  });

  it('a ranged click after a toggled one adds the run to the toggled set', () => {
    const toggled = selectRowOnClick(selectRowOnly(2), 10, toggle);
    const ranged = selectRowOnClick(toggled, 13, range);
    expect(ranged.ranges).toEqual([r(2), r(10, 13)]);
    expect(selectRowOnClick(ranged, 11, range).ranges).toEqual([r(2), r(10, 11)]);
  });

  it('a ranged click with no anchor grows from the cursor, else selects the row, on what is selected', () => {
    const fromLead = selectRowOnClick({ ranges: [r(4)], anchor: null, lead: 4 }, 7, range);
    expect(fromLead.ranges).toEqual([r(4, 7)]);
    expect(fromLead.anchor).toEqual({ row: 4, base: [r(4)] });
    expect(selectRowOnClick(EMPTY_ROW_SELECTION, 7, range).ranges).toEqual([r(7)]);
  });

  it('ranges across a million rows as one range', () => {
    expect(selectRowOnClick(selectRowOnly(0), 999_999, range).ranges).toEqual([r(0, 999_999)]);
  });
});

describe('selectRowOnStep', () => {
  it('a plain step collapses the selection onto the row', () => {
    const wide = selectRowOnClick(selectRowOnly(2), 9, range);
    expect(selectRowOnStep(wide, 10, false)).toEqual(selectRowOnly(10));
  });

  it('a Shift step extends the range from the anchor and moves the cursor', () => {
    const one = selectRowOnly(5);
    const two = selectRowOnStep(one, 6, true);
    expect(two).toEqual({ ranges: [r(5, 6)], anchor: one.anchor, lead: 6 });
    const back = selectRowOnStep(selectRowOnStep(two, 5, true), 4, true);
    expect(back).toEqual({ ranges: [r(4, 5)], anchor: one.anchor, lead: 4 });
  });
});

describe('selectRowOnContextMenu', () => {
  it('keeps the selection when the row is in it and selects the row alone when it is not', () => {
    const wide = selectRowOnClick(selectRowOnly(2), 9, range);
    expect(selectRowOnContextMenu(wide, 6)).toBe(wide);
    expect(selectRowOnContextMenu(wide, 12)).toEqual(selectRowOnly(12));
  });
});
