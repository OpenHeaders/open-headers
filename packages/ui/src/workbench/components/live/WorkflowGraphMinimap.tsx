/**
 * WorkflowGraphMinimap — the whole graph, small, in the pane's
 * bottom-right corner (the workflow runs plan, Decisions log, S31): a
 * rectangle a step in its run state's colour, and an outline round what
 * the pane shows. It grows under the pointer, up and left from its
 * corner. A press puts the pressed point at the middle of the pane; a
 * press held and moved pans.
 *
 * The map's world is the box that holds the graph and what the pane
 * shows (S34): the outline is always whole, and the steps are drawn
 * smaller as the view zooms out or pans away from them. While the map
 * is pressed its world holds still — the press moves the view, and a
 * world that followed it would move under the pointer.
 *
 * The drawing is fitted by the SVG's own view box, so it follows the
 * box as it grows; a press is read through the same fit
 * (`fitWorldInBox`).
 */

import { theme } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import {
  boxAround,
  fitWorldInBox,
  type PaneViewport,
  type Point,
  type Rect,
  type Size,
  viewRectOf,
  worldPointAt,
} from './graph-minimap';
import { STEP_MARK_FILL } from './StepGlyph';
import type { StepMarkKind } from './step-mark';
import { usePaneSize } from './use-pane-size';

export const MINIMAP_SIZE: Size = { width: 120, height: 80 };
export const MINIMAP_SIZE_OPEN: Size = { width: 240, height: 160 };
/** What the map keeps between itself and the pane's right and bottom edges. */
export const MINIMAP_OFFSET = { right: 12, bottom: 8 };
/** What the box keeps between its edge and the drawing. */
const INSET = 4;

export interface MinimapNode extends Point {
  id: string;
  kind: StepMarkKind;
}

interface Props {
  /** The box the graph fills; nodes placed by hand may leave the origin. */
  world: Rect;
  nodes: readonly MinimapNode[];
  nodeSize: Size;
  /** The graph's pane, and its pan and zoom: what it shows is the map's outline. */
  pane: React.RefObject<HTMLDivElement | null>;
  viewport: PaneViewport;
  /** A point of the graph was pressed: the pane shows it at its middle. */
  onCentre: (point: Point) => void;
}

const WorkflowGraphMinimap: React.FC<Props> = ({ world, nodes, nodeSize, pane, viewport, onCentre }) => {
  const { token } = theme.useToken();
  const [over, setOver] = useState(false);
  // The world the map held as it was pressed — `null` while it is not.
  const [held, setHeld] = useState<Rect | null>(null);
  const dragging = held !== null;
  const size = over || dragging ? MINIMAP_SIZE_OPEN : MINIMAP_SIZE;

  const paneSize = usePaneSize(pane);
  const view = paneSize === null ? null : viewRectOf(viewport, paneSize);
  const around = view === null ? world : boxAround(world, view);
  const shown = held ?? around;

  // The drawing's own box — the map's, less its edge.
  const drawingRef = useRef<SVGSVGElement>(null);

  const centreAt = (e: React.PointerEvent<HTMLDivElement>, drawn: Rect) => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fit = fitWorldInBox(drawn, { width: rect.width, height: rect.height });
    const within = worldPointAt(fit, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    onCentre({ x: drawn.x + within.x, y: drawn.y + within.y });
  };

  return (
    <div
      data-testid="wf-graph-minimap"
      data-graph-interactive=""
      data-open={over || dragging ? 'true' : undefined}
      aria-hidden="true"
      onPointerEnter={() => setOver(true)}
      onPointerLeave={() => setOver(false)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setHeld(around);
        centreAt(e, around);
      }}
      onPointerMove={(e) => {
        if (held !== null) centreAt(e, held);
      }}
      onPointerUp={() => setHeld(null)}
      onPointerCancel={() => setHeld(null)}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        ...MINIMAP_OFFSET,
        zIndex: 3,
        boxSizing: 'border-box',
        width: size.width,
        height: size.height,
        maxWidth: 'calc(100% - 24px)',
        maxHeight: 'calc(100% - 16px)',
        padding: INSET,
        borderRadius: 6,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
        boxShadow: token.boxShadowTertiary,
        overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'pointer',
        touchAction: 'none',
        transition: 'width 120ms ease, height 120ms ease',
      }}
    >
      <svg
        ref={drawingRef}
        width="100%"
        height="100%"
        viewBox={`${shown.x} ${shown.y} ${shown.width} ${shown.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      >
        {nodes.map((node) => (
          <rect
            key={node.id}
            data-testid={`wf-graph-minimap-node-${node.id}`}
            data-run-state={node.kind}
            x={node.x}
            y={node.y}
            width={nodeSize.width}
            height={nodeSize.height}
            rx={12}
            style={{ fill: STEP_MARK_FILL[node.kind] }}
          />
        ))}
        {view !== null && (
          <rect
            data-testid="wf-graph-minimap-view"
            x={view.x}
            y={view.y}
            width={view.width}
            height={view.height}
            vectorEffect="non-scaling-stroke"
            style={{
              fill: 'color-mix(in srgb, var(--oh-wf-text) 6%, transparent)',
              stroke: 'var(--oh-wf-text-secondary)',
              strokeWidth: 1,
            }}
          />
        )}
      </svg>
    </div>
  );
};

export default WorkflowGraphMinimap;
