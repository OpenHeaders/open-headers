/**
 * WorkflowGraphMinimap — the whole graph, small, in the pane's
 * bottom-right corner (the workflow runs plan, Decisions log, S31): a
 * rectangle a step in its run state's colour, and an outline round what
 * the pane shows. It grows under the pointer, up and left from its
 * corner. A press puts the pressed point at the middle of the pane; a
 * press held and moved pans by what the pointer travels.
 *
 * The map's world is the box that holds the graph and what the pane
 * shows (S34): the outline is always whole, and the steps are drawn
 * smaller as the view zooms out or pans away from them — through a drag
 * of the map too (S36), on every move of it.
 *
 * What is handed in as `beside` — the pane's zoom group — rides the
 * map's left edge, and goes with it as the map grows. The map stays
 * grown while the pointer goes from it onto that group, so the group is
 * never drawn away from under a press.
 *
 * The drawing is fitted by the SVG's own view box, so it follows the
 * box as it grows; a press is read through the same fit
 * (`pressOnMap`).
 */

import { theme } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import {
  boxAround,
  centreAfterTravel,
  type MapPress,
  type PaneViewport,
  type Point,
  pressOnMap,
  type Rect,
  type Size,
  viewRectOf,
} from './graph-minimap';
import { STEP_MARK_FILL } from './StepGlyph';
import type { StepMarkKind } from './step-mark';
import { usePaneSize } from './use-pane-size';

export const MINIMAP_SIZE: Size = { width: 120, height: 80 };
export const MINIMAP_SIZE_OPEN: Size = { width: 240, height: 160 };
/** What the map keeps between itself and the pane's right and bottom edges. */
export const MINIMAP_OFFSET = { right: 12, bottom: 8 };
/** What the map keeps between itself and what rides its left edge. */
export const MINIMAP_BESIDE_GAP = 6;
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
  /** Controls drawn at the map's left, level with its lower edge. */
  beside?: React.ReactNode;
}

/** A press held on the map: where the pointer was, and what its travel is read in. */
interface HeldPress extends MapPress {
  pointerId: number;
  x: number;
  y: number;
}

const WorkflowGraphMinimap: React.FC<Props> = ({ world, nodes, nodeSize, pane, viewport, onCentre, beside }) => {
  const { token } = theme.useToken();
  const [over, setOver] = useState(false);
  const pressRef = useRef<HeldPress | null>(null);
  const [dragging, setDragging] = useState(false);
  const size = over || dragging ? MINIMAP_SIZE_OPEN : MINIMAP_SIZE;

  const paneSize = usePaneSize(pane);
  const view = paneSize === null ? null : viewRectOf(viewport, paneSize);
  const shown = view === null ? world : boxAround(world, view);

  // The drawing's own box — the map's, less its edge.
  const drawingRef = useRef<SVGSVGElement>(null);

  const release = () => {
    pressRef.current = null;
    setDragging(false);
  };

  return (
    // The corner the map sits in. It takes no press of its own: the canvas under it stays the canvas.
    <div
      onPointerLeave={() => setOver(false)}
      style={{
        position: 'absolute',
        top: MINIMAP_OFFSET.bottom,
        left: MINIMAP_OFFSET.right,
        ...MINIMAP_OFFSET,
        zIndex: 3,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {beside !== undefined && (
        // The space between the two is the group's: the pointer crosses from the map without leaving.
        <div style={{ flex: 'none', paddingRight: MINIMAP_BESIDE_GAP, pointerEvents: 'auto' }}>{beside}</div>
      )}
      <div
        data-testid="wf-graph-minimap"
        data-graph-interactive=""
        data-open={over || dragging ? 'true' : undefined}
        aria-hidden="true"
        onPointerEnter={() => setOver(true)}
        onPointerDown={(e) => {
          const rect = drawingRef.current?.getBoundingClientRect();
          if (e.button !== 0 || !rect) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const press = pressOnMap(
            world,
            view,
            { width: rect.width, height: rect.height },
            { x: e.clientX - rect.left, y: e.clientY - rect.top },
          );
          pressRef.current = { ...press, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
          setDragging(true);
          onCentre(press.centre);
        }}
        onPointerMove={(e) => {
          const press = pressRef.current;
          if (press === null || press.pointerId !== e.pointerId) return;
          onCentre(centreAfterTravel(press, { x: e.clientX - press.x, y: e.clientY - press.y }));
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        style={{
          boxSizing: 'border-box',
          width: size.width,
          height: size.height,
          minWidth: 0,
          maxHeight: '100%',
          padding: INSET,
          borderRadius: 6,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
          boxShadow: token.boxShadowTertiary,
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'pointer',
          pointerEvents: 'auto',
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
    </div>
  );
};

export default WorkflowGraphMinimap;
