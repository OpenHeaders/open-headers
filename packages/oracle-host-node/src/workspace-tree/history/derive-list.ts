/**
 * The list one ask names, made out of a reading of the history — in
 * the order the log has always derived what it shows:
 *
 *   1. the scope: the rows its refs reach, in the history's own order;
 *   2. Sort › Topologically: those rows re-listed;
 *   3. the sifts — First Parent, No Merges, and the commits a walk
 *      under User / Date / Paths names — as ONE contraction, each
 *      commit that stays wearing the colour it has in the unsifted
 *      list;
 *   4. or, on a list that sifts nothing, the folded linear runs;
 *   5. the graph's layout over what is listed.
 *
 * Every model is core's, over rows by number. The long passes are taken
 * a stretch at a time and the thread is handed back between any two.
 */

import {
  advanceLogLayout,
  beginLogLayout,
  contractLogSteps,
  type DerivedLog,
  firstParentOnly,
  firstParentReach,
  flaggedRows,
  foldRuns,
  type LogGraphInput,
  type LogLayout,
  type LogRuns,
  type LogSkeleton,
  linearRuns,
  pickRows,
  reachFrom,
  topologicalRows,
} from '@openheaders/core/workspace-tree';
import { breathe, historyRowOf, LOG_SCOPE_HEAD } from '../../git';
import type { HistoryGeneration } from './generation';
import { isSifted, type LogAsk, type LogFolds } from './log-ask';

/** Rows the layout sweeps before it hands the thread back. */
const LAYOUT_STRETCH_ROWS = 20_000;

/** The linear runs of a list that sifts nothing. */
export interface LogFolding {
  /** The list with no run folded — what the runs are numbered over. */
  unfolded: LogSkeleton;
  /** The history's row behind each row of the unfolded list. */
  historyRows: Int32Array;
  runs: LogRuns;
  /** Per run: 1 where the list folds it. */
  folded: Uint8Array;
  /** The unfolded list's row behind each listed row; null while no run is folded (the two are one list). */
  rows: Int32Array | null;
  /** The two ends of every folded run, by the unfolded list's row — either one names the run it closes over. */
  ends: ReadonlyMap<number, number>;
}

export interface LogList {
  generation: HistoryGeneration;
  /** The rows listed, each with the rows its parents sit on. */
  skeleton: LogSkeleton;
  /** The history's row behind each listed row. */
  historyRows: Int32Array;
  /** Per row: the nearest row above that is joined to it; -1 for none. */
  childRows: Int32Array;
  /** What the layout was made over — the cells of any stretch are made from it on demand. */
  graph: LogGraphInput;
  layout: LogLayout;
  /** Null on a sifted list: its graph is a contraction's, and no run of it folds. */
  folding: LogFolding | null;
}

type Listed = Pick<LogList, 'skeleton' | 'historyRows' | 'graph' | 'folding'>;

/** Per row: the nearest row above joined to it — the last one a pass down the list meets. */
function nearestChildren(skeleton: LogSkeleton): Int32Array {
  const { count, starts, parents } = skeleton;
  const child = new Int32Array(count).fill(-1);
  for (let row = 0; row < count; row += 1) {
    for (let pointer = starts[row]; pointer < starts[row + 1]; pointer += 1) {
      if (parents[pointer] < count) child[parents[pointer]] = row;
    }
  }
  return child;
}

function identity(count: number): Int32Array {
  const rows = new Int32Array(count);
  for (let row = 0; row < count; row += 1) rows[row] = row;
  return rows;
}

/** Flags of a source's rows, as flags of the list whose rows come from it. */
function carried(flags: Uint8Array, rows: Int32Array): Uint8Array {
  const out = new Uint8Array(rows.length);
  for (let row = 0; row < rows.length; row += 1) out[row] = flags[rows[row]];
  return out;
}

/** The rows of a list made from a list — each led through to what the first one was made from. */
function through(rows: Int32Array, source: Int32Array): Int32Array {
  const out = new Int32Array(rows.length);
  for (let row = 0; row < rows.length; row += 1) out[row] = source[rows[row]];
  return out;
}

async function laidOut(input: LogGraphInput): Promise<LogLayout> {
  const layout = beginLogLayout(input.skeleton.count);
  while (!advanceLogLayout(input, layout, LAYOUT_STRETCH_ROWS)) await breathe();
  return layout;
}

/** The rows a scope's refs reach, in the history's order — the whole history for every ref. */
function scopedLog(generation: HistoryGeneration, scope: readonly string[] | null): DerivedLog {
  const { skeleton } = generation.history;
  if (scope === null) return { skeleton, rows: identity(skeleton.count) };
  return pickRows(skeleton, flaggedRows(reachFrom(skeleton, scopeTips(generation, scope))));
}

/** The history's rows a scope's members stand on; a member this reading does not hold is left out. */
function scopeTips(generation: HistoryGeneration, scope: readonly string[]): number[] {
  const tips: number[] = [];
  for (const name of scope) {
    const row = name === LOG_SCOPE_HEAD ? generation.headRow : (generation.refRows.get(name) ?? -1);
    if (row !== -1) tips.push(row);
  }
  return tips;
}

/** Per run: 1 where the ask folds it. A name that is no run's first commit in this list folds nothing. */
function foldedRuns(generation: HistoryGeneration, base: DerivedLog, runs: LogRuns, folds: LogFolds): Uint8Array {
  const folded = new Uint8Array(runs.count).fill(folds.all ? 1 : 0);
  if (folds.runs.length === 0) return folded;
  const placed = new Int32Array(generation.history.skeleton.count).fill(-1);
  for (let row = 0; row < base.rows.length; row += 1) placed[base.rows[row]] = row;
  for (const sha of folds.runs) {
    const row = historyRowOf(generation.history, sha);
    const at = row === -1 ? -1 : placed[row];
    const run = at === -1 ? -1 : runs.runOf[at];
    if (run !== -1 && runs.firsts[run] === at) folded[run] = folds.all ? 0 : 1;
  }
  return folded;
}

async function foldedList(generation: HistoryGeneration, ask: LogAsk, base: DerivedLog): Promise<Listed> {
  const runs = linearRuns(base.skeleton, carried(generation.anchors, base.rows));
  await breathe();
  const folded = foldedRuns(generation, base, runs, ask.folds);
  const derived = folded.includes(1) ? foldRuns(base.skeleton, runs, folded) : null;
  const ends = new Map<number, number>();
  for (let run = 0; derived !== null && run < runs.count; run += 1) {
    if (folded[run] === 0) continue;
    if (!ends.has(runs.tops[run])) ends.set(runs.tops[run], run);
    if (!ends.has(runs.bottoms[run])) ends.set(runs.bottoms[run], run);
  }
  const skeleton = derived === null ? base.skeleton : derived.skeleton;
  const historyRows = derived === null ? base.rows : through(derived.rows, base.rows);
  return {
    skeleton,
    historyRows,
    graph: {
      skeleton,
      headRow: historyRows.indexOf(generation.headRow),
      branchHeads: carried(generation.branchHeads, historyRows),
    },
    folding: {
      unfolded: base.skeleton,
      historyRows: base.rows,
      runs,
      folded,
      rows: derived === null ? null : derived.rows,
      ends,
    },
  };
}

async function siftedList(
  generation: HistoryGeneration,
  ask: LogAsk,
  base: DerivedLog,
  named: Uint8Array | null,
): Promise<Listed> {
  const { count, starts } = base.skeleton;
  // The colour each commit wears before anything is sifted out — it keeps it.
  const whole = await laidOut({
    skeleton: base.skeleton,
    headRow: base.rows.indexOf(generation.headRow),
    branchHeads: carried(generation.branchHeads, base.rows),
  });
  await breathe();

  const listed = new Uint8Array(count).fill(1);
  if (ask.firstParent) {
    // Walked from the refs the log lists: the scope's own, or every ref and the checked-out commit.
    const placed = new Int32Array(generation.history.skeleton.count).fill(-1);
    for (let row = 0; row < count; row += 1) placed[base.rows[row]] = row;
    const tips =
      ask.scope === null
        ? flaggedRows(carried(generation.anchors, base.rows))
        : scopeTips(generation, ask.scope).map((row) => placed[row]);
    const reached = firstParentReach(base.skeleton, tips);
    for (let row = 0; row < count; row += 1) listed[row] &= reached[row];
    await breathe();
  }
  for (let row = 0; row < count; row += 1) {
    if (ask.noMerges && starts[row + 1] - starts[row] > 1) listed[row] = 0;
    if (named !== null && named[base.rows[row]] === 0) listed[row] = 0;
  }
  await breathe();

  const steps = contractLogSteps(ask.firstParent ? firstParentOnly(base.skeleton) : base.skeleton, listed);
  let step = steps.next();
  while (step.done !== true) {
    await breathe();
    step = steps.next();
  }
  const derived = step.value;
  const historyRows = through(derived.rows, base.rows);
  return {
    skeleton: derived.skeleton,
    historyRows,
    graph: {
      skeleton: derived.skeleton,
      headRow: historyRows.indexOf(generation.headRow),
      known: carried(whole.colors, derived.rows),
    },
    folding: null,
  };
}

/**
 * The list `ask` names over `generation`. `named` flags the history's
 * rows a walk under the ask's User / Date / Paths names — null when the
 * ask has none.
 */
export async function deriveLogList(
  generation: HistoryGeneration,
  ask: LogAsk,
  named: Uint8Array | null,
): Promise<LogList> {
  let base = scopedLog(generation, ask.scope);
  await breathe();
  if (ask.topological) {
    const order = topologicalRows(base.skeleton, {
      lead: base.rows.indexOf(generation.headRow),
      last: carried(generation.upstream, base.rows),
    });
    await breathe();
    base = { skeleton: pickRows(base.skeleton, order).skeleton, rows: through(order, base.rows) };
    await breathe();
  }
  const listed = isSifted(ask)
    ? await siftedList(generation, ask, base, named)
    : await foldedList(generation, ask, base);
  await breathe();
  const childRows = nearestChildren(listed.skeleton);
  await breathe();
  return { generation, ...listed, childRows, layout: await laidOut(listed.graph) };
}
