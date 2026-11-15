/**
 * log-row-selection — the log's reading of the selection over row
 * numbers (`shared/selection/row-selection`): which row the details
 * pane follows after a click, and where an arrow lands. The twin of
 * `log-selection.ts`, which reads the same of a list of named commits.
 * Pure shaping; no React.
 */

import {
  type RowSelection,
  rowSelected,
  type SelectModifiers,
  selectRowOnClick,
} from '@openheaders/ui/shared/selection';

export interface RowClickOutcome {
  /** The selection after the click — what the hook will hold. */
  next: RowSelection;
  /** The row the details pane follows; null when nothing stays selected. */
  lead: number | null;
}

/**
 * The selection and the details row after a click on `row`: the clicked
 * row while it stays selected (a plain click, a range, a toggle in),
 * else the first row still selected (a toggle out), else none.
 */
export function rowClickOutcome(selection: RowSelection, row: number, modifiers: SelectModifiers): RowClickOutcome {
  const next = selectRowOnClick(selection, row, modifiers);
  if (rowSelected(next.ranges, row)) return { next, lead: row };
  return { next, lead: next.ranges[0]?.first ?? null };
}

/**
 * The row an arrow lands on in a list of `total` rows: one step from
 * the cursor, held to the list's ends; the first row when there is no
 * cursor or it sits past the list; null on an empty list.
 */
export function stepRowTarget(total: number, lead: number | null, delta: 1 | -1): number | null {
  if (total <= 0) return null;
  if (lead === null || lead >= total) return 0;
  return Math.min(total - 1, Math.max(0, lead + delta));
}
