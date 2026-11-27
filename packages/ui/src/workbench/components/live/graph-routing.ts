/**
 * Pure routing of the workflow graph's lines (the workflows redesign,
 * Connections): where each dependency's line runs between two placed
 * nodes, where it leaves its parent and where its label sits.
 *
 * A line leaves its parent's lower edge at a port, drops to the middle
 * of the space under that layer, runs across and drops into its child —
 * square turns, rounded. One that passes a layer keeps to the lane the
 * layout gave it there.
 *
 * A step with a run condition over two or more dependencies has a
 * capsule where its lines meet, and one arrow from the capsule into the
 * step; every other line ends in an arrowhead of its own.
 *
 * A line into a step with several parents has a port to itself and its
 * label beside that port, the one stretch no other line shares; the
 * lines into a parent's only-children share one port and are labelled
 * above each child.
 *
 * A line to a step that is not below its parent — a cycle, which a
 * draft can hold until it is saved, or a step moved beside or above the
 * one it waits on — goes round the side of both. "Below" is read from
 * the two nodes' places, so the routing holds for nodes placed by hand
 * as for the computed layout's layers.
 *
 * Pure — no React, no DOM.
 */

import { type GraphEdge, spreadApart } from './graph-layout';

export interface Point {
  x: number;
  y: number;
}

/** A placed node: its top-left corner. */
export interface RouteNode {
  id: string;
  x: number;
  y: number;
}

export interface RouteMetrics {
  nodeWidth: number;
  nodeHeight: number;
  /** The space between two layers. */
  layerGap: number;
}

export interface RoutedLine {
  from: string;
  to: string;
  d: string;
  /** Where it leaves its parent. */
  port: Point;
  /** The tip of its own arrowhead — absent where the line ends at its step's capsule. */
  arrow?: Point;
  /** `x` is the label's left edge, or its right edge where it is set right. */
  label: Point & { align: 'left' | 'right' };
}

export interface RoutedCapsule {
  stepId: string;
  centre: Point;
  /** The one arrow from the capsule into its step. */
  d: string;
  arrow: Point;
}

export interface GraphRoutes {
  lines: RoutedLine[];
  capsules: RoutedCapsule[];
}

const CORNER = 10;
/** How far from its node's middle a port may stand, and how near two ports of one node come. */
const PORT_REACH = 28;
const PORT_APART = 20;
const LABEL_BESIDE = 8;
const LABEL_UNDER_PORT = 6;
const LABEL_OVER_STEP = 21;
/** A line stops short of its step by its arrowhead. */
const ARROW_LENGTH = 6;
const ROUND_THE_SIDE = 16;

/** The triangle of an arrowhead that points down at `tip`. */
export function arrowHeadPath(tip: Point): string {
  return `M ${tip.x - 4} ${tip.y - ARROW_LENGTH} L ${tip.x + 4} ${tip.y - ARROW_LENGTH} L ${tip.x} ${tip.y} Z`;
}

/** A path through the corners given, each turn rounded as far as its two stretches allow. */
function roundedPath(corners: readonly Point[]): string {
  const distinct = corners.filter((point, i) => {
    if (i === 0) return true;
    const before = corners[i - 1];
    return point.x !== before.x || point.y !== before.y;
  });
  // A point on a straight run is no turn.
  const points = distinct.filter((point, i) => {
    const before = distinct[i - 1];
    const after = distinct[i + 1];
    if (before === undefined || after === undefined) return true;
    return !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
  });
  const reach = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const toward = (from: Point, to: Point, by: number): Point => {
    const length = reach(from, to);
    return { x: from.x + ((to.x - from.x) * by) / length, y: from.y + ((to.y - from.y) * by) / length };
  };
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i];
    const radius = Math.min(CORNER, reach(points[i - 1], corner) / 2, reach(corner, points[i + 1]) / 2);
    const enter = toward(corner, points[i - 1], radius);
    const leave = toward(corner, points[i + 1], radius);
    d += ` L ${enter.x} ${enter.y} Q ${corner.x} ${corner.y} ${leave.x} ${leave.y}`;
  }
  const end = points[points.length - 1];
  return `${d} L ${end.x} ${end.y}`;
}

interface PortGroup {
  /** Where its lines head first. */
  aim: number;
  edges: GraphEdge[];
  /** Its lines are labelled beside it. */
  labelled: boolean;
}

/**
 * Route every edge between the placed nodes. `gated` holds the steps
 * that have a run condition. An edge's lanes are read in the nodes' own
 * coordinates.
 */
export function routeGraph(
  nodes: readonly RouteNode[],
  edges: readonly GraphEdge[],
  gated: ReadonlySet<string>,
  metrics: RouteMetrics,
): GraphRoutes {
  const { nodeWidth, nodeHeight, layerGap } = metrics;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const centreOf = (node: RouteNode): number => node.x + nodeWidth / 2;
  const routable = edges.filter((edge) => byId.has(edge.from) && byId.has(edge.to));

  const parentCount = new Map<string, number>();
  for (const edge of routable) parentCount.set(edge.to, (parentCount.get(edge.to) ?? 0) + 1);
  const meets = (stepId: string): boolean => (parentCount.get(stepId) ?? 0) > 1;
  const hasCapsule = (stepId: string): boolean => meets(stepId) && gated.has(stepId);
  // A line drops into its child where the stretch it runs across on — the
  // middle of a layer's gap above the child — is far enough under its parent.
  const goesDown = (edge: GraphEdge): boolean => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    return from !== undefined && to !== undefined && to.y - layerGap / 2 >= from.y + nodeHeight + ROUND_THE_SIDE;
  };
  const firstAim = (edge: GraphEdge): number => {
    const to = byId.get(edge.to);
    return edge.lanes[0] ?? (to === undefined ? 0 : centreOf(to));
  };

  // The ports of each parent, left to right by where their lines head.
  const ports = new Map<GraphEdge, { at: Point; labelled: boolean; align: 'left' | 'right' }>();
  for (const parent of nodes) {
    const outgoing = routable.filter((edge) => edge.from === parent.id);
    const shared = outgoing.filter((edge) => goesDown(edge) && !meets(edge.to));
    const groups: PortGroup[] = outgoing
      .filter((edge) => !shared.includes(edge))
      .map((edge) => ({ aim: firstAim(edge), edges: [edge], labelled: true }));
    if (shared.length > 0) {
      groups.push({
        aim: shared.reduce((sum, edge) => sum + firstAim(edge), 0) / shared.length,
        edges: shared,
        labelled: false,
      });
    }
    groups.sort((a, b) => a.aim - b.aim);
    const centre = centreOf(parent);
    // A node's one port is its middle; several lean each toward where its lines head.
    const xs = spreadApart(
      groups.map((group) => ({
        wish: groups.length === 1 ? centre : Math.min(centre + PORT_REACH, Math.max(centre - PORT_REACH, group.aim)),
        width: 0,
        weight: 1,
      })),
      PORT_APART,
    );
    groups.forEach((group, index) => {
      const at = { x: xs[index], y: parent.y + nodeHeight };
      const align = groups.length > 1 && at.x < centre ? 'right' : 'left';
      for (const edge of group.edges) ports.set(edge, { at, labelled: group.labelled, align });
    });
  }

  const lines: RoutedLine[] = [];
  for (const edge of routable) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    const port = ports.get(edge);
    if (from === undefined || to === undefined || port === undefined) continue;
    const target = centreOf(to);
    const corners: Point[] = [port.at];
    const capsule = hasCapsule(edge.to);
    if (goesDown(edge)) {
      let x = port.at.x;
      edge.lanes.forEach((lane, index) => {
        const turnAt = from.y + nodeHeight + layerGap / 2 + index * (nodeHeight + layerGap);
        corners.push({ x, y: turnAt }, { x: lane, y: turnAt });
        x = lane;
      });
      const meetAt = to.y - layerGap / 2;
      corners.push({ x, y: meetAt }, { x: target, y: meetAt });
      if (!capsule) corners.push({ x: target, y: to.y - ARROW_LENGTH });
    } else {
      const side = Math.max(from.x, to.x) + nodeWidth + ROUND_THE_SIDE;
      const below = port.at.y + ROUND_THE_SIDE;
      const above = to.y - ROUND_THE_SIDE;
      corners.push(
        { x: port.at.x, y: below },
        { x: side, y: below },
        { x: side, y: above },
        { x: target, y: above },
        { x: target, y: to.y - ARROW_LENGTH },
      );
    }
    lines.push({
      from: edge.from,
      to: edge.to,
      d: roundedPath(corners),
      port: port.at,
      ...(capsule && goesDown(edge) ? {} : { arrow: { x: target, y: to.y - 1 } }),
      label: port.labelled
        ? {
            x: port.at.x + (port.align === 'left' ? LABEL_BESIDE : -LABEL_BESIDE),
            y: port.at.y + LABEL_UNDER_PORT,
            align: port.align,
          }
        : { x: target + LABEL_BESIDE, y: to.y - LABEL_OVER_STEP, align: 'left' },
    });
  }

  const capsules: RoutedCapsule[] = nodes
    .filter((node) => hasCapsule(node.id))
    .map((node) => {
      const x = centreOf(node);
      const centre = { x, y: node.y - layerGap / 2 };
      return {
        stepId: node.id,
        centre,
        d: `M ${x} ${centre.y} L ${x} ${node.y - ARROW_LENGTH}`,
        arrow: { x, y: node.y - 1 },
      };
    });

  return { lines, capsules };
}
