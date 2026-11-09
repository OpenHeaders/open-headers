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
 *
 * The hover fragment (the reference): the lit edges and nodes wear a
 * pale halo, the fragment's two ends grow, its interior nodes a touch;
 * a collapsed edge is a stub out of each end (a dashed trace where it
 * passes other rows). The pointer over the cell reports the hover and
 * a click the toggle; the row's own click stays with the row.
 */

import type React from 'react';
import type { GraphRow } from './graph';
import { edgeKey } from './graph';

export const GRAPH_ROW_HEIGHT = 26;
const LANE_WIDTH = 16;
const LEFT_PAD = 8;
const DOT_RADIUS = 3.5;
const RING_RADIUS = 4;
const RING_CORE_RADIUS = 1.5;
const EDGE_WIDTH = 1.5;
const LIT_EDGE_WIDTH = 2;
const HALO = 1.25;
const STUB = 5;
/** The gap an edge leaves before the HEAD ring — the ring's outer edge. */
const RING_GAP = RING_RADIUS + EDGE_WIDTH / 2;
const HALO_COLOR = 'var(--oh-git-graph-halo)';

const laneX = (lane: number): number => LEFT_PAD + lane * LANE_WIDTH;

function edgePath(fromX: number, fromY: number, toX: number, toY: number): string {
  if (fromX === toX) return `M${fromX} ${fromY} L${toX} ${toY}`;
  const midY = (fromY + toY) / 2;
  return `M${fromX} ${fromY} C${fromX} ${midY} ${toX} ${midY} ${toX} ${toY}`;
}

export type GraphHighlight = 'end' | 'interior';

export interface GraphCellProps {
  row: GraphRow | null;
  /** Widest lane count of the whole log — keeps every cell (and so the
   *  subject column) left-aligned across rows. */
  maxLanes: number;
  /** This row is the checked-out commit — the hollow ring. */
  isHead?: boolean;
  /** Fallback dot color for layout-less (filtered) rendering. */
  fallbackColor: string;
  /** The row's part in the lit fragment, if any. */
  highlight?: GraphHighlight | null;
  /** The lit fragment's edges by `edgeKey`. */
  litEdges?: ReadonlySet<string> | null;
  /** The pointer entered (true) or left (false) the cell. */
  onHover?: (hovering: boolean) => void;
  /** A click on the cell — the fragment toggle. */
  onToggle?: () => void;
}

const GraphCell: React.FC<GraphCellProps> = ({
  row,
  maxLanes,
  isHead = false,
  fallbackColor,
  highlight = null,
  litEdges = null,
  onHover,
  onToggle,
}) => {
  const lanes = Math.max(1, row === null ? 1 : maxLanes);
  const width = LEFT_PAD + lanes * LANE_WIDTH;
  const mid = GRAPH_ROW_HEIGHT / 2;
  const dotX = laneX(row?.lane ?? 0);
  const dotColor = row?.color ?? fallbackColor;
  const grow = highlight === 'end' ? 1.5 : highlight === 'interior' ? 0.5 : 0;
  const dotRadius = DOT_RADIUS + grow;
  const ringRadius = RING_RADIUS + (highlight === null ? 0 : 1);
  const ringWidth = highlight === null ? EDGE_WIDTH : LIT_EDGE_WIDTH;
  const gap = isHead ? ringRadius + ringWidth / 2 : 0;
  // A stub starts at the node's outer edge — the halo's when lit.
  const stubGap = (isHead ? gap : dotRadius) + (highlight === null ? 0 : HALO);

  const edges =
    row === null
      ? []
      : row.edges.map((edge, index) => {
          const from = laneX(edge.from);
          const to = laneX(edge.to);
          const lit = litEdges !== null && litEdges.has(edgeKey(edge.child, edge.parent));
          let d: string;
          let dashed = false;
          if (edge.collapsed) {
            if (edge.span === 'top') d = `M${to} ${mid - stubGap - STUB} L${to} ${mid - stubGap}`;
            else if (edge.span === 'bottom') d = `M${from} ${mid + stubGap} L${from} ${mid + stubGap + STUB}`;
            else {
              d = edgePath(from, 0, to, GRAPH_ROW_HEIGHT);
              dashed = true;
            }
          } else if (edge.span === 'top') d = edgePath(from, 0, to, mid - gap);
          else if (edge.span === 'bottom') d = edgePath(from, mid + gap, to, GRAPH_ROW_HEIGHT);
          else d = edgePath(from, 0, to, GRAPH_ROW_HEIGHT);
          return { key: `${edge.span}:${edge.from}:${edge.to}:${index}`, d, color: edge.color, lit, dashed };
        });

  return (
    <svg
      aria-hidden
      width={width}
      height={GRAPH_ROW_HEIGHT}
      style={{ flex: '0 0 auto', display: 'block', cursor: highlight === null ? undefined : 'pointer' }}
      data-testid="git-tool-graph-cell"
      data-head={isHead || undefined}
      data-highlight={highlight ?? undefined}
      onMouseEnter={onHover === undefined ? undefined : () => onHover(true)}
      onMouseLeave={onHover === undefined ? undefined : () => onHover(false)}
      onClick={
        onToggle === undefined
          ? undefined
          : (event) => {
              event.stopPropagation();
              onToggle();
            }
      }
    >
      <rect width={width} height={GRAPH_ROW_HEIGHT} fill="transparent" />
      {edges
        .filter((edge) => edge.lit)
        .map((edge) => (
          <path
            key={`halo:${edge.key}`}
            d={edge.d}
            style={{ stroke: HALO_COLOR }}
            strokeWidth={LIT_EDGE_WIDTH + HALO * 2}
            strokeDasharray={edge.dashed ? '2 3' : undefined}
            fill="none"
          />
        ))}
      {edges.map((edge) => (
        <path
          key={edge.key}
          d={edge.d}
          style={{ stroke: edge.color }}
          strokeWidth={edge.lit ? LIT_EDGE_WIDTH : EDGE_WIDTH}
          strokeDasharray={edge.dashed ? '2 3' : undefined}
          fill="none"
        />
      ))}
      {isHead ? (
        <>
          {highlight !== null && (
            <circle
              cx={dotX}
              cy={mid}
              r={ringRadius}
              style={{ stroke: HALO_COLOR }}
              strokeWidth={ringWidth + HALO * 2}
              fill="none"
            />
          )}
          <circle cx={dotX} cy={mid} r={ringRadius} style={{ stroke: dotColor }} strokeWidth={ringWidth} fill="none" />
          <circle cx={dotX} cy={mid} r={RING_CORE_RADIUS + grow / 2} style={{ fill: dotColor }} />
        </>
      ) : (
        <>
          {highlight !== null && <circle cx={dotX} cy={mid} r={dotRadius + HALO} style={{ fill: HALO_COLOR }} />}
          <circle cx={dotX} cy={mid} r={dotRadius} style={{ fill: dotColor }} />
        </>
      )}
    </svg>
  );
};

export default GraphCell;
