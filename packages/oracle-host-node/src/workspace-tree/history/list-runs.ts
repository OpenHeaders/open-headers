/**
 * The linear runs of a list, as its rows and its graph's edges name
 * them — the run a pointer over a row lights and a press on its dot
 * folds, the run an edge is part of, and a run as the view is told of
 * it. A list that sifts has none.
 *
 * A run is numbered over the list with nothing folded; a listed row is
 * led back to that list first, and a run's ends — never hidden — are
 * led forward to where they are listed.
 */

import { type LogGraphEdge, runAt } from '@openheaders/core/workspace-tree';
import { historyShaOf } from '../../git';
import type { LogFolding, LogList } from './derive-list';

/** A run as a view is told of it. */
export interface LogRunInfo {
  run: number;
  /** The hash of the first commit the run hides when folded — the name an ask folds it by. */
  first: string;
  /** The listed row above its stretch, and the one under it. */
  top: number;
  bottom: number;
  /** How many commits its stretch hides when folded. */
  hidden: number;
  folded: boolean;
}

const unfoldedRow = (folding: LogFolding, row: number): number => (folding.rows === null ? row : folding.rows[row]);

/** Where a row of the unfolded list is listed; -1 for one a fold hides. */
function listedRow(folding: LogFolding, unfolded: number): number {
  const { rows } = folding;
  if (rows === null) return unfolded;
  let low = 0;
  let high = rows.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (rows[middle] === unfolded) return middle;
    if (rows[middle] < unfolded) low = middle + 1;
    else high = middle - 1;
  }
  return -1;
}

/**
 * The run a pointer over `row` names: the folded run it is an end of
 * (either end opens it again), else the run it sits in or the one under
 * it along its first parent. -1 where there is none.
 */
export function runOfRow(list: LogList, row: number): number {
  const { folding } = list;
  if (folding === null) return -1;
  const at = unfoldedRow(folding, row);
  return folding.ends.get(at) ?? runAt(folding.unfolded, folding.runs, at);
}

/** The run `edge` is part of — a step down its stretch, or the one line a folded run is drawn as. -1 for none. */
export function runOfEdge(list: LogList, edge: LogGraphEdge): number {
  const { folding } = list;
  if (folding === null || edge.child === -1) return -1;
  const { runs, unfolded, folded } = folding;
  const child = unfoldedRow(folding, edge.child);
  const parent = edge.parent < list.skeleton.count ? unfoldedRow(folding, edge.parent) : -1;
  // A commit inside a stretch has one child and one parent: an edge into it or out of it is its run's.
  if (parent !== -1 && runs.runOf[parent] !== -1) return runs.runOf[parent];
  if (runs.runOf[child] !== -1) return runs.runOf[child];
  if (!edge.collapsed || parent === -1) return -1;
  // A folded run's own line: from its top to its bottom, over the stretch it hides.
  for (let pointer = unfolded.starts[child]; pointer < unfolded.starts[child + 1]; pointer += 1) {
    const into = unfolded.parents[pointer];
    const run = into < unfolded.count ? runs.runOf[into] : -1;
    if (run !== -1 && folded[run] === 1 && runs.bottoms[run] === parent) return run;
  }
  return -1;
}

export function describeRun(list: LogList, folding: LogFolding, run: number): LogRunInfo {
  const { runs } = folding;
  return {
    run,
    first: historyShaOf(list.generation.history, folding.historyRows[runs.firsts[run]]),
    top: listedRow(folding, runs.tops[run]),
    bottom: listedRow(folding, runs.bottoms[run]),
    hidden: runs.lengths[run],
    folded: folding.folded[run] === 1,
  };
}
