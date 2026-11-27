import {
  fitWorldInBox,
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

describe('viewportCentredOn', () => {
  it('puts the point at the middle of the pane and keeps the zoom', () => {
    const pane = { width: 600, height: 300 };
    const viewport = viewportCentredOn({ x: 400, y: 250 }, pane, 0.5);

    expect(viewport).toEqual({ scale: 0.5, x: 100, y: 25 });
    const view = viewRectOf(viewport, pane);
    expect({ x: view.x + view.width / 2, y: view.y + view.height / 2 }).toEqual({ x: 400, y: 250 });
  });
});
