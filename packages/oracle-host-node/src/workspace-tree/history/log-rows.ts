/**
 * A stretch of a list's rows as a view shows them — each commit read
 * from git by its hash, with what the list alone knows of it: its
 * graph cell, whether the checked-out commit reaches it, the rows its
 * joins and its child sit on, and the linear run it belongs to.
 *
 * The list holds no commit's text; a stretch costs one read of its
 * commits by hash, wherever in the history it is. What that read is —
 * with each commit's changed paths or without — is its caller's.
 */

import { type LogGraphEdge, type LogGraphRow, logGraphRows } from '@openheaders/core/workspace-tree';
import { type CommitLogFileChange, type CommitLogHead, historyShaOf } from '../../git';
import type { LogList } from './derive-list';
import { describeRun, type LogRunInfo, runOfEdge, runOfRow } from './list-runs';

/** A cell's edge, with the run it is part of — absent where it is part of none. */
export interface LogRowEdge extends LogGraphEdge {
  run?: number;
}

/** A row's commit — its changed paths only where the read asked for them. */
export type LogRowCommit = CommitLogHead & { files?: CommitLogFileChange[] };

/** Reads a stretch's commits by their full hashes, in the order given; null when git cannot read them. */
export type LogCommitsReader = (shas: readonly string[]) => Promise<readonly LogRowCommit[] | null>;

export interface LogRow {
  /** The commit — `onHead` says whether the checked-out commit reaches it. */
  entry: LogRowCommit;
  cell: Omit<LogGraphRow, 'edges'> & { edges: LogRowEdge[] };
  /** The rows its joins lead to, the first parent's first — at or past the list's count when one leaves the list. */
  parents: number[];
  /** The nearest row above that is joined to it; -1 for none. */
  child: number;
  /** The run a pointer over the row names — absent where there is none. */
  run?: number;
}

export interface LogRowsPage {
  rows: LogRow[];
  /** The runs the rows and their edges name. */
  runs: LogRunInfo[];
}

/** Rows `[from, from + count)` of `list` — fewer where it ends. Null when git cannot read their commits. */
export async function readLogRows(
  read: LogCommitsReader,
  list: LogList,
  from: number,
  count: number,
): Promise<LogRowsPage | null> {
  const end = Math.min(list.skeleton.count, from + count);
  if (from < 0 || from >= end) return { rows: [], runs: [] };
  const { history, onHead } = list.generation;
  const shas: string[] = [];
  for (let row = from; row < end; row += 1) shas.push(historyShaOf(history, list.historyRows[row]));
  const entries = await read(shas);
  // A commit git no longer holds (the history moved under the list): the stretch is not this list's any more.
  if (entries === null || entries.length !== shas.length || entries.some((entry, at) => entry.sha !== shas[at])) {
    return null;
  }

  const { starts, parents } = list.skeleton;
  const cells = logGraphRows(list.graph, list.layout, from, end - from);
  const named = new Set<number>();
  /** A run as a row or an edge carries it: left out where there is none. */
  const carried = (found: number): { run?: number } => {
    if (found === -1) return {};
    named.add(found);
    return { run: found };
  };
  const rows = entries.map((entry, at): LogRow => {
    const row = from + at;
    const cell = cells[at];
    return {
      entry: { ...entry, onHead: onHead[list.historyRows[row]] === 1 },
      cell: {
        lane: cell.lane,
        color: cell.color,
        laneCount: cell.laneCount,
        edges: cell.edges.map((edge) => ({ ...edge, ...carried(runOfEdge(list, edge)) })),
      },
      parents: Array.from(parents.subarray(starts[row], starts[row + 1])),
      child: list.childRows[row],
      ...carried(runOfRow(list, row)),
    };
  });
  const { folding } = list;
  const runs =
    folding === null ? [] : [...named].sort((a, b) => a - b).map((found) => describeRun(list, folding, found));
  return { rows, runs };
}
