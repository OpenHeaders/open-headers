/**
 * GraphCell — one commit row's slice of the log graph, rendered as an
 * isolated SVG from the pure layout's row data (dot lane + half-row
 * edges), so the list never measures across rows. When the layout is
 * absent (a text-filtered log is no longer contiguous history — edges
 * would lie) the cell degrades to a plain dot. The reference's
 * reading: lanes 16 px apart, 1.5 px edges, the checked-out commit a
 * hollow ring with a centre dot whose edges stop at the ring. Colours
 * arrive as the palette tokens and resolve through the style, so the
 * theme decides the hue.
 */

import type React from 'react';
import type { GraphRow } from './graph';

export const GRAPH_ROW_HEIGHT = 26;
const LANE_WIDTH = 16;
const LEFT_PAD = 8;
const DOT_RADIUS = 3.5;
const RING_RADIUS = 4;
const RING_CORE_RADIUS = 1.5;
const EDGE_WIDTH = 1.5;
/** The gap an edge leaves before the HEAD ring — the ring's outer edge. */
const RING_GAP = RING_RADIUS + EDGE_WIDTH / 2;

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
  /** This row is the checked-out commit — the hollow ring. */
  isHead?: boolean;
  /** Fallback dot color for layout-less (filtered) rendering. */
  fallbackColor: string;
}

const GraphCell: React.FC<GraphCellProps> = ({ row, maxLanes, isHead = false, fallbackColor }) => {
  const lanes = Math.max(1, row === null ? 1 : maxLanes);
  const width = LEFT_PAD + lanes * LANE_WIDTH;
  const mid = GRAPH_ROW_HEIGHT / 2;
  const gap = isHead ? RING_GAP : 0;
  const dotX = laneX(row?.lane ?? 0);
  const dotColor = row?.color ?? fallbackColor;
  return (
    <svg
      aria-hidden
      width={width}
      height={GRAPH_ROW_HEIGHT}
      style={{ flex: '0 0 auto', display: 'block' }}
      data-testid="git-tool-graph-cell"
      data-head={isHead || undefined}
    >
      {row !== null &&
        row.edges.map((edge, index) => {
          const key = `${edge.span}:${edge.from}:${edge.to}:${index}`;
          const from = laneX(edge.from);
          const to = laneX(edge.to);
          const d =
            edge.span === 'top'
              ? edgePath(from, 0, to, mid - gap)
              : edge.span === 'bottom'
                ? edgePath(from, mid + gap, to, GRAPH_ROW_HEIGHT)
                : edgePath(from, 0, to, GRAPH_ROW_HEIGHT);
          return <path key={key} d={d} style={{ stroke: edge.color }} strokeWidth={EDGE_WIDTH} fill="none" />;
        })}
      {isHead ? (
        <>
          <circle
            cx={dotX}
            cy={mid}
            r={RING_RADIUS}
            style={{ stroke: dotColor }}
            strokeWidth={EDGE_WIDTH}
            fill="none"
          />
          <circle cx={dotX} cy={mid} r={RING_CORE_RADIUS} style={{ fill: dotColor }} />
        </>
      ) : (
        <circle cx={dotX} cy={mid} r={DOT_RADIUS} style={{ fill: dotColor }} />
      )}
    </svg>
  );
};

export default GraphCell;
