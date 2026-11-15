/**
 * log-selected-commits — the commits of the rows a log has selected:
 * what the details, the files, the pick's rule and the patch read.
 *
 * They are held apart from the pages the list draws from
 * (`log-row-pages.ts`): a page is let go once the view has scrolled far
 * from it, and a selection outlives the scroll. A selected row's commit
 * is taken from its page while that is held, and read from the host
 * otherwise — the missing rows in as few reads as cover them. Like
 * every row number, the held ones are one list's: another list's are
 * dropped with it.
 *
 * Only so many are read together. Past that the selection is a number
 * of rows and no more — nothing is read, and whatever acts on the set
 * holds. Pure — the read itself is `use-selected-commits.ts`.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import { type RowRange, selectedRowCount, selectedRows } from '@openheaders/ui/shared/selection';
import {
  LOG_PAGE_ROWS,
  type LogRowPages,
  type LogRowStretch,
  type LogRowsAnswer,
  type LogRowsAsk,
  logRowAt,
} from './log-row-pages';

/** The most selected rows whose commits are read together. */
export const SELECTED_COMMITS_MAX = 200;
/** The most rows one read asks the host for. */
const READ_ROWS = 2 * LOG_PAGE_ROWS;

export interface SelectedCommits {
  /** The two names of the list the rows are of; null while none is held. */
  ask: LogRowsAsk | null;
  list: string | null;
  /** The selected rows' commits read so far, by row. */
  commits: ReadonlyMap<number, WorkspaceTreeLogEntryWire>;
}

export const NO_SELECTED_COMMITS: SelectedCommits = { ask: null, list: null, commits: new Map() };

/** What the selected rows are to whatever reads them. */
export type SelectedSet =
  | { kind: 'none' }
  /** More rows than are read together: their number, and nothing of their commits. */
  | { kind: 'over'; count: number }
  /** A selected row's commit is not read yet. */
  | { kind: 'reading'; count: number }
  /** Every selected row's commit, in list order — newest first. */
  | { kind: 'commits'; entries: WorkspaceTreeLogEntryWire[] };

/** The rows whose commits are read: the selected ones in list order — none past the most read together. */
export function selectedCommitRows(ranges: readonly RowRange[]): number[] {
  return selectedRowCount(ranges) > SELECTED_COMMITS_MAX ? [] : selectedRows(ranges, SELECTED_COMMITS_MAX);
}

/**
 * The commits kept for the rows selected now (`rows`), of the list the
 * view holds: a row no longer selected is let go, one whose page is
 * held is taken from it, and another list's are dropped whole. The
 * same object while nothing of it changed.
 */
export function keepSelectedCommits(
  kept: SelectedCommits,
  held: LogRowPages,
  rows: readonly number[],
): SelectedCommits {
  const same = kept.ask === held.ask && kept.list === held.list;
  const commits = new Map<number, WorkspaceTreeLogEntryWire>();
  let changed = !same;
  for (const row of rows) {
    const had = same ? kept.commits.get(row) : undefined;
    const entry = had ?? logRowAt(held, row)?.entry;
    if (entry === undefined) continue;
    commits.set(row, entry);
    if (had === undefined) changed = true;
  }
  if (!changed && commits.size === kept.commits.size) return kept;
  return { ask: held.ask, list: held.list, commits };
}

/**
 * The stretch to read next for the selected rows whose commit is not
 * kept, or null when every one is: from the first missing row as far as
 * the last missing one that one read still reaches.
 */
export function nextSelectedRead(kept: SelectedCommits, rows: readonly number[]): LogRowStretch | null {
  let from = -1;
  let last = -1;
  for (const row of rows) {
    if (kept.commits.has(row)) continue;
    if (from === -1) from = row;
    if (row >= from + READ_ROWS) break;
    last = row;
  }
  return from === -1 ? null : { from, count: last - from + 1 };
}

/**
 * The kept commits with the host's answer to a read from row `from` of
 * the list named `ask`: the selected rows among the ones it sent. An
 * answer of another list than the kept one changes nothing.
 */
export function takeSelectedRows(
  kept: SelectedCommits,
  ask: LogRowsAsk,
  from: number,
  answer: LogRowsAnswer,
  rows: readonly number[],
): SelectedCommits {
  if (kept.ask !== ask || kept.list !== answer.list) return kept;
  const commits = new Map(kept.commits);
  for (const row of rows) {
    const sent = answer.rows[row - from];
    if (sent !== undefined) commits.set(row, sent.entry);
  }
  return { ...kept, commits };
}

/** The selection `ranges` as its readers take it, from the commits kept. */
export function selectedSet(kept: SelectedCommits, ranges: readonly RowRange[]): SelectedSet {
  const count = selectedRowCount(ranges);
  if (count === 0) return { kind: 'none' };
  if (count > SELECTED_COMMITS_MAX) return { kind: 'over', count };
  const entries: WorkspaceTreeLogEntryWire[] = [];
  for (const row of selectedRows(ranges, SELECTED_COMMITS_MAX)) {
    const entry = kept.commits.get(row);
    if (entry === undefined) return { kind: 'reading', count };
    entries.push(entry);
  }
  return { kind: 'commits', entries };
}

/**
 * What the panes beside the list show for the selection: the set itself
 * — but while its commits are being read, or while the tab's commit is
 * on its way to a selected row (`arriving`: a list read anew holds no
 * selected row until the commit's row is found, and the list selects it
 * a draw after that), what they showed before (`shown`) stays. A pane
 * never blinks empty between two answers.
 */
export function shownSelectedSet(set: SelectedSet, shown: SelectedSet, arriving: boolean): SelectedSet {
  if (set.kind === 'reading') return shown;
  return set.kind === 'none' && arriving ? shown : set;
}
