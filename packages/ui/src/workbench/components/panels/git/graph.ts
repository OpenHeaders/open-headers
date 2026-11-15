/**
 * The log graph as the Git tool window's list draws it — the layout is
 * core's (the lane sweep over a log's rows by number); here a list of
 * named commits is handed to it and its answer is read back in the
 * list's own terms: per row the dot's lane, the half-row edges around
 * it and the pass-through edges of unrelated lanes, each edge naming
 * the two commits it joins and each colour a palette token, so the list
 * draws every row as an isolated SVG cell with no cross-row
 * measurement.
 *
 * Every edge names the two commits it joins, so a view can light the
 * edges of a fragment, and an edge the view collapsed (a hidden linear
 * run between two ends) is flagged — the cell draws it as the stubs.
 *
 * A view that lays out only SOME of a log's commits (a filtered list)
 * hands in the colour each commit wears in the whole log's layout, so
 * a commit keeps its colour whatever else is hidden.
 */

import { LOG_COLOR_UNKNOWN, computeLogGraph as layOutLog, numberLog } from '@openheaders/core/workspace-tree';

/** One graph edge inside a row's cell, in lane coordinates. */
export interface GraphEdge {
  /** Lane at the edge's starting horizontal position. */
  from: number;
  /** Lane at the edge's ending horizontal position. */
  to: number;
  color: string;
  /** Which half of the row the edge spans: `top` converges into the
   *  dot, `bottom` forks out of it, `pass` crosses the full row. */
  span: 'top' | 'bottom' | 'pass';
  /** The newer commit the edge descends from. */
  child: string;
  /** The older commit the edge reaches. */
  parent: string;
  /** The edge stands for a collapsed run — drawn as stubs, not a line. */
  collapsed: boolean;
}

/** The key a view names an edge by — the child and the parent it joins. */
export const edgeKey = (child: string, parent: string): string => `${child}>${parent}`;

export interface LogGraphOptions {
  /** The checked-out commit — the lane opening on it owns the shared history below every fork. */
  headSha?: string | null;
  /** Edges (by `edgeKey`) that skip a collapsed run. */
  collapsedEdges?: ReadonlySet<string>;
  /** Commits a branch (local or remote) points at — a lane reaching one restarts its colour there. */
  branchHeads?: ReadonlySet<string>;
  /** A commit's colour in the whole log's layout — it wears that one here, and so does the lane that reaches it. */
  colors?: ReadonlyMap<string, string>;
}

/** Render data for one log row. */
export interface GraphRow {
  /** The commit dot's lane. */
  lane: number;
  color: string;
  edges: GraphEdge[];
  /** Lanes occupied while this row renders — the cell's width driver. */
  laneCount: number;
}

/** The lane palette — per-theme tokens (`--oh-git-lane-N`); index = the layout's colour number. */
export const GRAPH_LANE_COLORS = [
  'var(--oh-git-lane-0)',
  'var(--oh-git-lane-1)',
  'var(--oh-git-lane-2)',
  'var(--oh-git-lane-3)',
  'var(--oh-git-lane-4)',
  'var(--oh-git-lane-5)',
  'var(--oh-git-lane-6)',
  'var(--oh-git-lane-7)',
] as const;

const COLOR_NUMBER = new Map<string, number>(GRAPH_LANE_COLORS.map((token, number) => [token, number]));

/**
 * Lay out the graph for `entries` in log order (newest first). Rows are
 * answered in the same order. A truncated log (the tail cut by the
 * fetch limit) simply leaves lanes running off the last row's bottom.
 * A head entering the window draws no edge above its dot.
 */
export function computeLogGraph(
  entries: ReadonlyArray<{ sha: string; parents: readonly string[] }>,
  options: LogGraphOptions = {},
): GraphRow[] {
  const { skeleton, shas, numberOf } = numberLog(entries);
  const { collapsedEdges, branchHeads, colors } = options;

  if (collapsedEdges !== undefined && collapsedEdges.size > 0) {
    const skips = new Uint8Array(skeleton.parents.length);
    for (let row = 0; row < skeleton.count; row += 1) {
      for (let pointer = skeleton.starts[row]; pointer < skeleton.starts[row + 1]; pointer += 1) {
        if (collapsedEdges.has(edgeKey(shas[row], shas[skeleton.parents[pointer]]))) skips[pointer] = 1;
      }
    }
    skeleton.skips = skips;
  }
  const heads = new Uint8Array(skeleton.count);
  if (branchHeads !== undefined) {
    for (let row = 0; row < skeleton.count; row += 1) {
      if (branchHeads.has(shas[row])) heads[row] = 1;
    }
  }
  const known = new Uint8Array(shas.length).fill(LOG_COLOR_UNKNOWN);
  if (colors !== undefined) {
    for (const [sha, token] of colors) {
      const commit = numberOf.get(sha);
      const number = COLOR_NUMBER.get(token);
      if (commit !== undefined && number !== undefined) known[commit] = number;
    }
  }
  const headSha = options.headSha ?? null;
  const headRow = headSha === null ? -1 : (numberOf.get(headSha) ?? -1);

  return layOutLog({ skeleton, headRow, branchHeads: heads, known }).map((cell) => ({
    lane: cell.lane,
    color: GRAPH_LANE_COLORS[cell.color],
    laneCount: cell.laneCount,
    edges: cell.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      color: GRAPH_LANE_COLORS[edge.color],
      span: edge.span,
      child: edge.child === -1 ? '' : shas[edge.child],
      parent: shas[edge.parent],
      collapsed: edge.collapsed,
    })),
  }));
}
