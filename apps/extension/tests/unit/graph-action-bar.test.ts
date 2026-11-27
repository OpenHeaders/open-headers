/**
 * Where the bar of a selected step's actions sits in the graph's pane:
 * above its node at the node's left, clear of the lines at its middle;
 * under it where the pane's top has no room; inside the pane's edges, off
 * the map, and nowhere while the node is out of view.
 */

import {
  type ActionBarPlacement,
  nodeRectInPane,
  placeActionBar,
} from '@openheaders/ui/workbench/components/live/graph-action-bar';
import { describe, expect, it } from 'vitest';

const PANE = { width: 500, height: 400 };
const BAR = { width: 98, height: 26 };
const NODE = { width: 208, height: 82 };

function place(overrides: Partial<ActionBarPlacement>): ReturnType<typeof placeActionBar> {
  return placeActionBar({
    node: { x: 100, y: 150, ...NODE },
    pane: PANE,
    bar: BAR,
    topBand: 40,
    ringReach: 6,
    lineClear: 18,
    avoid: null,
    ...overrides,
  });
}

describe('nodeRectInPane', () => {
  it('moves a node’s place by the pane’s pan and sizes it by the zoom', () => {
    expect(nodeRectInPane({ x: 24, y: 178 }, NODE, { x: 10, y: -20, scale: 0.5 })).toEqual({
      x: 22,
      y: 69,
      width: 104,
      height: 41,
    });
  });
});

describe('placeActionBar', () => {
  it('sits above the node, its end short of the node’s middle', () => {
    // The node's middle is at 204: the bar ends at 186.
    expect(place({})).toEqual({ x: 88, y: 118 });
  });

  it('starts at the node’s left edge where the node is wide enough to keep it off the middle', () => {
    expect(place({ node: { x: 100, y: 150, width: 416, height: 164 } })).toEqual({ x: 100, y: 118 });
  });

  it('reaches left of a node drawn small, and still ends short of its middle', () => {
    // A node at half size: its middle at 152, less 9 for the lines at that zoom.
    expect(place({ node: { x: 100, y: 150, width: 104, height: 41 }, lineClear: 9 })).toEqual({ x: 45, y: 118 });
  });

  it('goes under the node, clear of its connect ring, where it would enter the band at the pane’s top', () => {
    expect(place({ node: { x: 100, y: 71, ...NODE } })).toEqual({ x: 88, y: 165 });
    expect(place({ node: { x: 100, y: 72, ...NODE } })).toEqual({ x: 88, y: 40 });
  });

  it('stays over a node that leaves no room above or under it', () => {
    expect(place({ node: { x: 100, y: 10, width: 416, height: 380 } })).toEqual({ x: 100, y: 40 });
  });

  it('is held inside the pane’s sides', () => {
    expect(place({ node: { x: -150, y: 150, ...NODE } })?.x).toBe(4);
    expect(place({ node: { x: 440, y: 150, ...NODE } })?.x).toBe(398);
  });

  it('moves left of the map where it would lie on it', () => {
    const map = { x: 368, y: 312, width: 120, height: 80 };
    expect(place({ node: { x: 330, y: 330, ...NODE }, avoid: map })).toEqual({ x: 264, y: 298 });
    expect(place({ node: { x: 330, y: 360, ...NODE }, avoid: map })).toEqual({ x: 264, y: 328 });
    // Clear of the map already: it stays by its node.
    expect(place({ node: { x: 280, y: 330, ...NODE }, avoid: map })).toEqual({ x: 268, y: 298 });
  });

  it('is nowhere while the node is out of view', () => {
    expect(place({ node: { x: 100, y: -82, ...NODE } })).toBeNull();
    expect(place({ node: { x: 500, y: 150, ...NODE } })).toBeNull();
    expect(place({ node: { x: 100, y: 400, ...NODE } })).toBeNull();
    expect(place({ node: { x: -208, y: 150, ...NODE } })).toBeNull();
  });
});
