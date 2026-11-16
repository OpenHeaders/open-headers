/**
 * log-cell — a row's graph cell as the list draws it, made from the
 * cell the host sends with the row (`oh.workspaceTree.logRows`): a
 * colour arrives as a palette NUMBER and is the theme's token here, and
 * the linear run under the pointer is lit by its number — the edges
 * that carry it, its two ends, and the rows between them.
 *
 * Nothing is laid out in the view: the host lays the whole list out and
 * a row's cell is complete by itself — its width too, which is the
 * row's own and no other row's. Pure.
 */

import type { WorkspaceTreeLogCellWire, WorkspaceTreeLogRunWire } from '@openheaders/core/bridge';
import { GRAPH_LANE_COLORS } from './graph';

/** One graph edge inside a row's cell, in lane coordinates. */
export interface GraphCellEdge {
  from: number;
  to: number;
  /** A palette token. */
  color: string;
  /** Which half of the row the edge spans: `top` converges into the dot, `bottom` forks out of it, `pass` crosses the row. */
  span: 'top' | 'bottom' | 'pass';
  /** The edge passes over hidden commits — drawn as stubs, not a line. */
  collapsed: boolean;
  /** The edge is part of the lit run. */
  lit: boolean;
}

/** What the cell draws for one row. */
export interface GraphCellRow {
  /** The commit dot's lane. */
  lane: number;
  /** A palette token. */
  color: string;
  edges: GraphCellEdge[];
}

/** A row's part in the lit run: one of its two ends, or a commit between them. */
export type GraphHighlight = 'end' | 'interior';

/** The host's cell with its colours as tokens and the edges of run `lit` marked; null lights none. */
export function logCellRow(cell: WorkspaceTreeLogCellWire, lit: number | null): GraphCellRow {
  return {
    lane: cell.lane,
    color: GRAPH_LANE_COLORS[cell.color],
    edges: cell.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      color: GRAPH_LANE_COLORS[edge.color],
      span: edge.span,
      collapsed: edge.collapsed,
      lit: lit !== null && edge.run === lit,
    })),
  };
}

/**
 * How far right a row's own cell draws, in lanes from the first — what
 * the row's subject is indented by, whatever the rows around it draw
 * (the reference's reading). The dot counts its lane and a line straight
 * down a lane counts it; a line that slants reaches its far lane only at
 * the row's edge and counts half a lane short of it. A folded line out
 * of the dot is a stub on the dot's own lane.
 */
export function graphCellReach(row: GraphCellRow): number {
  let reach = row.lane;
  for (const edge of row.edges) {
    if (edge.collapsed && edge.span !== 'pass') continue;
    const far = Math.max(edge.from, edge.to);
    reach = Math.max(reach, edge.from === edge.to ? far : far - 0.5);
  }
  return reach;
}

/**
 * Row `row`'s part in the lit run. The run's ends are told by their
 * rows; a row between them carries the run's number as its own (an end
 * may carry it too — the run under it — and is still an end).
 */
export function logRowHighlight(
  row: number,
  run: number | undefined,
  lit: WorkspaceTreeLogRunWire | null,
): GraphHighlight | null {
  if (lit === null) return null;
  if (row === lit.top || row === lit.bottom) return 'end';
  return run === lit.run ? 'interior' : null;
}
