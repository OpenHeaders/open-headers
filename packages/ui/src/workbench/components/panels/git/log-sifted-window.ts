/**
 * log-sifted-window — the list's first rows with a text applied: the
 * commits that match, still drawn as a graph (the reference's reading
 * of a search). Each one is joined to the nearest listed commits it
 * descends from, a join that passes over hidden commits drawn as the
 * stubs, and each wears the colour it has in the whole list.
 *
 * The contraction and the layout are core's, over the rows' own joins
 * by number: a row arrives with the rows its parents sit on, and a join
 * of its cell says whether it already passes over commits the host left
 * out. A parent past the window is unknown — the line ends there. Pure.
 */

import type { WorkspaceTreeLogEntryWire, WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import { contractLog, type LogSkeleton, computeLogGraph as layOutLog } from '@openheaders/core/workspace-tree';
import { GRAPH_LANE_COLORS } from './graph';
import type { GraphCellRow } from './log-cell';

export interface SiftedWindow {
  /** The commits that stay, in list order. */
  entries: WorkspaceTreeLogEntryWire[];
  /** Their graph cells, row for row. */
  graph: GraphCellRow[];
}

/**
 * The window as a skeleton: row `i` is the list's row `i`. A parent past
 * the window keeps its number in the list — past the window's count it
 * is a commit the window does not hold, each one its own.
 */
function windowSkeleton(rows: readonly WorkspaceTreeLogRowWire[]): LogSkeleton {
  const count = rows.length;
  const starts = new Int32Array(count + 1);
  const parents: number[] = [];
  const skips: number[] = [];
  for (let row = 0; row < count; row += 1) {
    starts[row] = parents.length;
    for (const parent of rows[row].parents) {
      parents.push(parent);
      // The row's own join to that parent, as its cell draws it.
      const passes = rows[row].cell.edges.some(
        (edge) => edge.child === row && edge.parent === parent && edge.collapsed,
      );
      skips.push(passes ? 1 : 0);
    }
  }
  starts[count] = parents.length;
  return { count, starts, parents: Int32Array.from(parents), skips: Uint8Array.from(skips) };
}

/**
 * The rows of `rows` — the list's first, in order — that `keeps` lets
 * stay, with their graph. Every commit's colour is the whole list's, so
 * no lane's colour is left for the layout to decide: the checked-out
 * commit, which owns a colour where chains meet, has no say here.
 */
export function siftLogWindow(
  rows: readonly WorkspaceTreeLogRowWire[],
  keeps: (entry: WorkspaceTreeLogEntryWire) => boolean,
): SiftedWindow {
  const listed = Uint8Array.from(rows, (row) => (keeps(row.entry) ? 1 : 0));
  const sifted = contractLog(windowSkeleton(rows), listed);
  const entries = Array.from(sifted.rows, (row) => rows[row].entry);
  const cells = layOutLog({
    skeleton: sifted.skeleton,
    headRow: -1,
    known: Uint8Array.from(sifted.rows, (row) => rows[row].cell.color),
  });
  const graph = cells.map((cell) => ({
    lane: cell.lane,
    color: GRAPH_LANE_COLORS[cell.color],
    laneCount: cell.laneCount,
    edges: cell.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      color: GRAPH_LANE_COLORS[edge.color],
      span: edge.span,
      collapsed: edge.collapsed,
      lit: false,
    })),
  }));
  return { entries, graph };
}
