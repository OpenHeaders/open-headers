/**
 * The geometry of the workflow graph's minimap (the workflow runs plan,
 * Decisions log, S31): how the whole graph sits in the map's box, which
 * point of the graph is under a point of the box, and what a pane shows
 * of the graph through its viewport. Pure.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point, Size {}

/** A pane's pan and zoom: translate, then scale, from its top-left corner. */
export interface PaneViewport extends Point {
  scale: number;
}

export interface WorldFit {
  /** Box pixels a unit of the world. */
  scale: number;
  /** Where the world's top-left corner sits in the box. */
  left: number;
  top: number;
}

/** A world in a box: whole, as large as it fits, in the middle. */
export function fitWorldInBox(world: Size, box: Size): WorldFit {
  if (world.width <= 0 || world.height <= 0) return { scale: 0, left: box.width / 2, top: box.height / 2 };
  const scale = Math.min(box.width / world.width, box.height / world.height);
  return { scale, left: (box.width - world.width * scale) / 2, top: (box.height - world.height * scale) / 2 };
}

/** The point of the world under a point of the box. */
export function worldPointAt(fit: WorldFit, point: Point): Point {
  if (fit.scale === 0) return { x: 0, y: 0 };
  return { x: (point.x - fit.left) / fit.scale, y: (point.y - fit.top) / fit.scale };
}

/** The part of the world a pane shows through its viewport. */
export function viewRectOf(viewport: PaneViewport, pane: Size): Rect {
  return {
    x: (0 - viewport.x) / viewport.scale,
    y: (0 - viewport.y) / viewport.scale,
    width: pane.width / viewport.scale,
    height: pane.height / viewport.scale,
  };
}

/** The viewport that shows a point of the world at the middle of a pane, at a zoom. */
export function viewportCentredOn(point: Point, pane: Size, scale: number): PaneViewport {
  return { scale, x: pane.width / 2 - point.x * scale, y: pane.height / 2 - point.y * scale };
}
