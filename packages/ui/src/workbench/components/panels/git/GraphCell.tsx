/**
 * GraphCell — one commit row's slice of the log graph, rendered as an
 * isolated SVG from the pure layout's row data (dot lane + half-row
 * edges), so the list never measures across rows. When the layout is
 * absent (a text-filtered log is no longer contiguous history — edges
 * would lie) the cell degrades to a plain dot.
 */

import type React from 'react';
import type { GraphRow } from './graph';

export const GRAPH_ROW_HEIGHT = 26;
const LANE_WIDTH = 10;
const LEFT_PAD = 8;
const DOT_RADIUS = 3.5;

const laneX = (lane: number): number => LEFT_PAD + lane * LANE_WIDTH;

function edgePath(fromX: number, fromY: number, toX: number, toY: number): string {
  if (fromX === toX) return `M${fromX} ${fromY} L${toX} ${toY}`;
  const midY = (fromY + toY) / 2;
  return `M${fromX} ${fromY} C${fromX} ${midY} ${toX} ${midY} ${toX} ${toY}`;
}

export interface GraphCellProps {
  row: GraphRow | null;
  /** Widest lane count of the whole log — keeps every cell (and so the
   *  subject column) left-aligned across rows. */
  maxLanes: number;
  /** Fallback dot color for layout-less (filtered) rendering. */
  fallbackColor: string;
}

const GraphCell: React.FC<GraphCellProps> = ({ row, maxLanes, fallbackColor }) => {
  const lanes = Math.max(1, row === null ? 1 : maxLanes);
  const width = LEFT_PAD + lanes * LANE_WIDTH;
  const mid = GRAPH_ROW_HEIGHT / 2;
  return (
    <svg
      aria-hidden
      width={width}
      height={GRAPH_ROW_HEIGHT}
      style={{ flex: '0 0 auto', display: 'block' }}
      data-testid="git-tool-graph-cell"
    >
      {row !== null &&
        row.edges.map((edge, index) => {
          const key = `${edge.span}:${edge.from}:${edge.to}:${index}`;
          const from = laneX(edge.from);
          const to = laneX(edge.to);
          if (edge.span === 'top')
            return <path key={key} d={edgePath(from, 0, to, mid)} stroke={edge.color} strokeWidth={1.5} fill="none" />;
          if (edge.span === 'bottom')
            return (
              <path
                key={key}
                d={edgePath(from, mid, to, GRAPH_ROW_HEIGHT)}
                stroke={edge.color}
                strokeWidth={1.5}
                fill="none"
              />
            );
          return (
            <path
              key={key}
              d={edgePath(from, 0, to, GRAPH_ROW_HEIGHT)}
              stroke={edge.color}
              strokeWidth={1.5}
              fill="none"
            />
          );
        })}
      <circle
        cx={laneX(row?.lane ?? 0)}
        cy={mid}
        r={DOT_RADIUS}
        fill={row?.color ?? fallbackColor}
      />
    </svg>
  );
};

export default GraphCell;
