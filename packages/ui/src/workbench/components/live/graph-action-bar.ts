/**
 * Where the bar of a selected step's actions sits in the graph's pane
 * (the workflow runs plan, Decisions log, S31): above the node, under it
 * where the pane's top has no room — at the node's left, clear of the
 * lines that run at its middle — inside the pane's edges and off the map.
 * Pure.
 */

import type { PaneViewport, Point, Rect, Size } from './graph-minimap';

/** What the bar keeps between itself and the node, and off the map. */
const GAP = 6;
/** What the bar keeps between itself and the pane's edge. */
const EDGE = 4;

export interface ActionBarPlacement {
  /** The selected node's box, in the pane's own coordinates. */
  node: Rect;
  pane: Size;
  bar: Size;
  /** The band at the pane's top the bar stays out of — the pane's own button sits there. */
  topBand: number;
  /** How far under the node its connect ring reaches. */
  ringReach: number;
  /** What the bar's end keeps from the node's middle, where the node's lines run. */
  lineClear: number;
  /** A box of the pane the bar never lies on: the map, at rest. */
  avoid: Rect | null;
}

/** A node's box in the pane, from its place in the graph and the pane's pan and zoom. */
export function nodeRectInPane(node: Point, nodeSize: Size, viewport: PaneViewport): Rect {
  return {
    x: viewport.x + node.x * viewport.scale,
    y: viewport.y + node.y * viewport.scale,
    width: nodeSize.width * viewport.scale,
    height: nodeSize.height * viewport.scale,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The bar's top-left corner in the pane — `null` while the node is out of view. */
export function placeActionBar({
  node,
  pane,
  bar,
  topBand,
  ringReach,
  lineClear,
  avoid,
}: ActionBarPlacement): Point | null {
  const inView = node.x < pane.width && node.x + node.width > 0 && node.y < pane.height && node.y + node.height > 0;
  if (!inView) return null;

  const lowest = pane.height - bar.height - EDGE;
  const above = node.y - GAP - bar.height;
  const below = node.y + node.height + ringReach + GAP;
  // Above where there is room, under where there is not; over a node that fills the pane.
  const y = above >= topBand ? above : below <= lowest ? below : Math.min(topBand, lowest);

  // From the node's left edge, or further left where it would reach the
  // node's middle: a line into the node, its label and its capsule stay
  // in reach, and so does the ring a line is drawn from.
  const left = Math.min(node.x, node.x + node.width / 2 - lineClear - bar.width);
  const x = Math.max(EDGE, Math.min(left, pane.width - bar.width - EDGE));
  const clear = avoid !== null && overlaps({ x, y, ...bar }, avoid) ? Math.max(EDGE, avoid.x - GAP - bar.width) : x;
  return { x: Math.round(clear), y: Math.round(y) };
}
