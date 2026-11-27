/**
 * The places of a workflow graph's nodes once they are moved by hand
 * (the workflow runs plan, Decisions log, S31): where every node stands
 * in an arranged graph, the places a drop keeps, and the box the nodes
 * fill. Pure.
 *
 * A graph is arranged from its first move: that drop keeps the place of
 * every node, so none follows the computed layout any more. A step that
 * has no place yet — one added since, or come from a teammate — lands
 * under its parent, clear of the nodes already there, and is kept there
 * at the next drop.
 */

import type { WorkflowNodePlaces } from '@openheaders/core/utils';
import type { Point, Rect, Size } from './graph-minimap';

/** What a moved node's corner snaps to, in the graph's own units. */
export const PLACE_GRID = 8;

export interface PlacedStep {
  id: string;
  uid: string;
  /** The ids of the steps it waits on. */
  parents: readonly string[];
}

export interface PlaceMetrics {
  node: Size;
  /** The space between two nodes side by side, and between a step and the one under it. */
  gapX: number;
  gapY: number;
}

export function snapPlace(point: Point): Point {
  // `+ 0`: a corner snapped back to the origin is 0, not -0.
  return {
    x: Math.round(point.x / PLACE_GRID) * PLACE_GRID + 0,
    y: Math.round(point.y / PLACE_GRID) * PLACE_GRID + 0,
  };
}

function liesOn(a: Point, b: Point, node: Size): boolean {
  return Math.abs(a.x - b.x) < node.width && Math.abs(a.y - b.y) < node.height;
}

/**
 * Where every node stands in an arranged graph, by step id. A step with
 * a place stands there; one with none lands under the first of its
 * parents that stands somewhere — or, with none, where the computed
 * layout puts it — moved right until it lies on no other node.
 */
export function placedPositions(
  steps: readonly PlacedStep[],
  computed: ReadonlyMap<string, Point>,
  places: WorkflowNodePlaces,
  metrics: PlaceMetrics,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  for (const step of steps) {
    const place = places[step.uid];
    if (place !== undefined) positions.set(step.id, { x: place.x, y: place.y });
  }
  for (const step of steps) {
    if (positions.has(step.id)) continue;
    const parent = step.parents.map((id) => positions.get(id)).find((at) => at !== undefined);
    const landing =
      parent !== undefined
        ? { x: parent.x, y: parent.y + metrics.node.height + metrics.gapY }
        : (computed.get(step.id) ?? { x: 0, y: 0 });
    const taken = [...positions.values()];
    let at = landing;
    while (taken.some((other) => liesOn(at, other, metrics.node))) {
      at = { x: at.x + metrics.node.width + metrics.gapX, y: at.y };
    }
    positions.set(step.id, at);
  }
  return positions;
}

/** The places a drop keeps: every node where it stands, by step uid. */
export function freezePlaces(steps: readonly PlacedStep[], positions: ReadonlyMap<string, Point>): WorkflowNodePlaces {
  const places: WorkflowNodePlaces = {};
  for (const step of steps) {
    const at = positions.get(step.id);
    if (at !== undefined) places[step.uid] = { x: at.x, y: at.y };
  }
  return places;
}

/** The box the nodes fill, with `pad` around them. */
export function boundsOfNodes(positions: Iterable<Point>, node: Size, pad: number): Rect {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const at of positions) {
    left = Math.min(left, at.x);
    top = Math.min(top, at.y);
    right = Math.max(right, at.x + node.width);
    bottom = Math.max(bottom, at.y + node.height);
  }
  if (left > right) return { x: 0, y: 0, width: node.width + pad * 2, height: node.height + pad * 2 };
  return { x: left - pad, y: top - pad, width: right - left + pad * 2, height: bottom - top + pad * 2 };
}
