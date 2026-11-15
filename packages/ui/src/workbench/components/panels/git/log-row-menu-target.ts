/**
 * log-row-menu-target — what the commit menu covers when it opens on a
 * row of the list over row numbers (`log-row-menu.tsx` builds it): the
 * selection the row sits in, or the row alone.
 *
 * A row knows where its child and its first parent are listed — the
 * walks go by ROW. A set's commits are the selection's own read
 * (`log-selected-commits.ts`): while they are not all read, or are more
 * than are read together, the menu covers no commit yet. Pure.
 */

import { type RowRange, rowSelected, selectedRowCount } from '@openheaders/ui/shared/selection';
import type { LogRowMenuTarget } from './log-row-menu';
import { type LogRowPages, logRowAt } from './log-row-pages';
import type { SelectedSet } from './log-selected-commits';

/** A pick or a revert takes a commit with ONE parent — a merge and the first commit have no single change. */
const applies = (entry: { parents: readonly string[] }): boolean => entry.parents.length === 1;

/**
 * The menu's target on row `row` of the held list: `ranges` are the
 * selected rows and `set` their commits as read so far.
 */
export function logRowMenuTarget(
  held: LogRowPages,
  ranges: readonly RowRange[],
  set: SelectedSet,
  row: number,
): LogRowMenuTarget<number> {
  if (rowSelected(ranges, row) && selectedRowCount(ranges) >= 2) {
    const entries = set.kind === 'commits' ? set.entries : null;
    return {
      shas: entries === null ? null : entries.map((entry) => entry.sha),
      child: null,
      parent: null,
      applies: entries?.every(applies) === true,
    };
  }
  const at = logRowAt(held, row);
  if (at === null) return { shas: null, child: null, parent: null, applies: false };
  const parent = at.parents[0];
  return {
    shas: [at.entry.sha],
    child: at.child >= 0 ? at.child : null,
    // A join that leaves the list is numbered at or past its length.
    parent: parent !== undefined && parent < held.total ? parent : null,
    applies: applies(at.entry),
  };
}
