/**
 * log-cell — a row's graph cell as the list draws it, made from the
 * cell the host sends with the row (`oh.workspaceTree.logRows`): a
 * colour arrives as a palette NUMBER and is the theme's token here, and
 * the linear run under the pointer is lit by its number — the edges
 * that carry it, its two ends, and the rows between them.
 *
 * Nothing is laid out in the view: the host lays the whole list out and
 * a row's cell is complete by itself. Pure.
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
  /** Lanes occupied while the row renders. */
  laneCount: number;
  edges: GraphCellEdge[];
}

/** A row's part in the lit run: one of its two ends, or a commit between them. */
export type GraphHighlight = 'end' | 'interior';

/** The host's cell with its colours as tokens and the edges of run `lit` marked; null lights none. */
export function logCellRow(cell: WorkspaceTreeLogCellWire, lit: number | null): GraphCellRow {
  return {
    lane: cell.lane,
    color: GRAPH_LANE_COLORS[cell.color],
    laneCount: cell.laneCount,
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
