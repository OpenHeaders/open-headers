import {
  boxAround,
  centreAfterTravel,
  fitWorldInBox,
  pressOnMap,
  viewportCentredOn,
  viewRectOf,
  worldPointAt,
} from '@openheaders/ui/workbench/components/live/graph-minimap';
import { describe, expect, it } from 'vitest';

describe('fitWorldInBox', () => {
  it('a tall world fills the box’s height and sits in the middle of its width', () => {
    expect(fitWorldInBox({ width: 200, height: 400 }, { width: 120, height: 80 })).toEqual({
      scale: 0.2,
      left: 40,
      top: 0,
    });
  });

  it('a wide world fills the box’s width and sits in the middle of its height', () => {
    expect(fitWorldInBox({ width: 1200, height: 400 }, { width: 120, height: 80 })).toEqual({
      scale: 0.1,
      left: 0,
      top: 20,
    });
  });

  it('a world with no extent has no scale', () => {
    expect(fitWorldInBox({ width: 0, height: 0 }, { width: 120, height: 80 }).scale).toBe(0);
  });
});

describe('worldPointAt', () => {
  const fit = fitWorldInBox({ width: 200, height: 400 }, { width: 120, height: 80 });

  it('the box’s middle is the world’s middle', () => {
    expect(worldPointAt(fit, { x: 60, y: 40 })).toEqual({ x: 100, y: 200 });
  });

  it('a point beside the drawing is a point outside the world', () => {
    expect(worldPointAt(fit, { x: 0, y: 0 })).toEqual({ x: -200, y: 0 });
  });

  it('a world with no extent answers its origin', () => {
    const none = fitWorldInBox({ width: 0, height: 0 }, { width: 120, height: 80 });

    expect(worldPointAt(none, { x: 60, y: 40 })).toEqual({ x: 0, y: 0 });
  });
});

describe('viewRectOf', () => {
  it('a pane at rest shows the world from its origin, a pane’s size of it', () => {
    expect(viewRectOf({ x: 0, y: 0, scale: 1 }, { width: 600, height: 300 })).toEqual({
      x: 0,
      y: 0,
      width: 600,
      height: 300,
    });
  });

  it('a pane panned and zoomed out shows more of the world, from further in', () => {
    expect(viewRectOf({ x: -100, y: 50, scale: 0.5 }, { width: 600, height: 300 })).toEqual({
      x: 200,
      y: -100,
      width: 1200,
      height: 600,
    });
  });
});

describe('boxAround', () => {
  const graph = { x: 0, y: 0, width: 256, height: 284 };

  it('a view inside the graph leaves the graph’s box', () => {
    expect(boxAround(graph, { x: 40, y: 60, width: 100, height: 80 })).toEqual(graph);
  });

  it('a view larger than the graph is the box', () => {
    const view = { x: -272, y: 0, width: 800, height: 600 };

    expect(boxAround(graph, view)).toEqual(view);
  });

  it('a view panned away is taken in with the graph', () => {
    // From 572 left of the graph to its right edge at 256; from 200 above it to the view's lower edge at 400.
    expect(boxAround(graph, { x: -572, y: -200, width: 800, height: 600 })).toEqual({
      x: -572,
      y: -200,
      width: 828,
      height: 600,
    });
  });
});

describe('pressOnMap', () => {
  it('a pane with no size yet: the pressed point of the graph, in the scale the graph is drawn at', () => {
    // 200 by 400 in a box 120 by 80 is drawn at 0.2, 40 in from the left: the box's middle is the graph's.
    expect(
      pressOnMap({ x: 0, y: 0, width: 200, height: 400 }, null, { width: 120, height: 80 }, { x: 60, y: 40 }),
    ).toEqual({ centre: { x: 100, y: 200 }, scale: 0.2 });
  });

  it('the scale is the map’s once the pane shows the pressed point, not the one the press was read in', () => {
    const graph = { x: 0, y: 0, width: 400, height: 200 };
    // The pane shows what lies right of the graph: the map holds 800 by 200, at 0.125 in a box
    // 100 by 50, 12.5 down. The point 25, 25 of the box is the graph's middle.
    const press = pressOnMap(
      graph,
      { x: 400, y: 0, width: 400, height: 200 },
      { width: 100, height: 50 },
      { x: 25, y: 25 },
    );

    // With its middle there the pane shows the graph and nothing else: the map is drawn at 0.25.
    expect(press).toEqual({ centre: { x: 200, y: 100 }, scale: 0.25 });
  });

  it('a graph with no extent is pressed at its origin, in no scale', () => {
    expect(pressOnMap({ x: 0, y: 0, width: 0, height: 0 }, null, { width: 120, height: 80 }, { x: 60, y: 40 })).toEqual(
      {
        centre: { x: 0, y: 0 },
        scale: 0,
      },
    );
  });
});

describe('centreAfterTravel', () => {
  it('moves the view’s middle by the pointer’s travel, in the scale of the press', () => {
    // 10 right and 5 up at 0.25 a unit: 40 and 20 of the graph.
    expect(centreAfterTravel({ centre: { x: 200, y: 100 }, scale: 0.25 }, { x: 10, y: -5 })).toEqual({ x: 240, y: 80 });
  });

  it('a press in no scale stays where it was', () => {
    expect(centreAfterTravel({ centre: { x: 0, y: 0 }, scale: 0 }, { x: 10, y: -5 })).toEqual({ x: 0, y: 0 });
  });
});

describe('viewportCentredOn', () => {
  it('puts the point at the middle of the pane and keeps the zoom', () => {
    const pane = { width: 600, height: 300 };
    const viewport = viewportCentredOn({ x: 400, y: 250 }, pane, 0.5);

    expect(viewport).toEqual({ scale: 0.5, x: 100, y: 25 });
    const view = viewRectOf(viewport, pane);
    expect({ x: view.x + view.width / 2, y: view.y + view.height / 2 }).toEqual({ x: 400, y: 250 });
  });
});
