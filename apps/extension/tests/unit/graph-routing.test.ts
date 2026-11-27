/**
 * Pure-function tests for `routeGraph` — where the workflow graph's
 * lines run, leave their parent and carry their label.
 */

import { arrowHeadPath, type RouteNode, routeGraph } from '@openheaders/ui/workbench/components/live/graph-routing';
import { describe, expect, it } from 'vitest';

const METRICS = { nodeWidth: 100, nodeHeight: 40, layerGap: 60 };
const NONE = new Set<string>();

/** A node of the given layer: layers are 100 apart. */
const at = (id: string, layer: number, x: number): RouteNode => ({ id, x, y: layer * 100 });

describe('routeGraph', () => {
  it('a step straight under its only parent: one stroke, its own arrowhead, the label above the step', () => {
    const { lines, capsules } = routeGraph(
      [at('a', 0, 0), at('b', 1, 0)],
      [{ from: 'a', to: 'b', lanes: [] }],
      NONE,
      METRICS,
    );
    expect(capsules).toEqual([]);
    expect(lines).toEqual([
      {
        from: 'a',
        to: 'b',
        d: 'M 50 40 L 50 94',
        port: { x: 50, y: 40 },
        arrow: { x: 50, y: 99 },
        label: { x: 58, y: 79, align: 'left' },
      },
    ]);
  });

  it('a step with a run condition over two parents: the lines meet at a capsule, one arrow goes on', () => {
    const { lines, capsules } = routeGraph(
      [at('a', 0, 0), at('b', 0, 120), at('c', 1, 60)],
      [
        { from: 'a', to: 'c', lanes: [] },
        { from: 'b', to: 'c', lanes: [] },
      ],
      new Set(['c']),
      METRICS,
    );
    expect(lines).toEqual([
      {
        from: 'a',
        to: 'c',
        d: 'M 50 40 L 50 60 Q 50 70 60 70 L 110 70',
        port: { x: 50, y: 40 },
        label: { x: 58, y: 46, align: 'left' },
      },
      {
        from: 'b',
        to: 'c',
        d: 'M 170 40 L 170 60 Q 170 70 160 70 L 110 70',
        port: { x: 170, y: 40 },
        label: { x: 178, y: 46, align: 'left' },
      },
    ]);
    expect(capsules).toEqual([
      { stepId: 'c', centre: { x: 110, y: 70 }, d: 'M 110 70 L 110 94', arrow: { x: 110, y: 99 } },
    ]);
  });

  it('two parents and no run condition: no capsule, each line ends in its own arrowhead, labelled by its port', () => {
    const { lines, capsules } = routeGraph(
      [at('a', 0, 0), at('b', 0, 120), at('c', 1, 60)],
      [
        { from: 'a', to: 'c', lanes: [] },
        { from: 'b', to: 'c', lanes: [] },
      ],
      NONE,
      METRICS,
    );
    expect(capsules).toEqual([]);
    expect(lines[0]).toMatchObject({
      d: 'M 50 40 L 50 60 Q 50 70 60 70 L 100 70 Q 110 70 110 80 L 110 94',
      arrow: { x: 110, y: 99 },
      label: { x: 58, y: 46, align: 'left' },
    });
    expect(lines[1].arrow).toEqual({ x: 110, y: 99 });
  });

  it('a run condition over one parent draws no capsule', () => {
    const { capsules } = routeGraph(
      [at('a', 0, 0), at('b', 1, 0)],
      [{ from: 'a', to: 'b', lanes: [] }],
      new Set(['b']),
      METRICS,
    );
    expect(capsules).toEqual([]);
  });

  it('two lines into steps that each have another parent leave by two ports, each labelled on its own side', () => {
    const { lines } = routeGraph(
      [at('o1', 0, -100), at('p', 0, 100), at('o2', 0, 300), at('c1', 1, 0), at('c2', 1, 200)],
      [
        { from: 'o1', to: 'c1', lanes: [] },
        { from: 'p', to: 'c1', lanes: [] },
        { from: 'p', to: 'c2', lanes: [] },
        { from: 'o2', to: 'c2', lanes: [] },
      ],
      NONE,
      METRICS,
    );
    const toC1 = lines.find((line) => line.from === 'p' && line.to === 'c1');
    const toC2 = lines.find((line) => line.from === 'p' && line.to === 'c2');
    expect(toC1).toMatchObject({ port: { x: 122, y: 40 }, label: { x: 114, y: 46, align: 'right' } });
    expect(toC2).toMatchObject({ port: { x: 178, y: 40 }, label: { x: 186, y: 46, align: 'left' } });
  });

  it("a parent's only-children share one port and are labelled above each child", () => {
    const { lines } = routeGraph(
      [at('a', 0, 120), at('b', 1, 0), at('c', 1, 120), at('d', 1, 240)],
      [
        { from: 'a', to: 'b', lanes: [] },
        { from: 'a', to: 'c', lanes: [] },
        { from: 'a', to: 'd', lanes: [] },
      ],
      NONE,
      METRICS,
    );
    expect(lines.map((line) => line.port)).toEqual([
      { x: 170, y: 40 },
      { x: 170, y: 40 },
      { x: 170, y: 40 },
    ]);
    expect(lines.map((line) => line.label)).toEqual([
      { x: 58, y: 79, align: 'left' },
      { x: 178, y: 79, align: 'left' },
      { x: 298, y: 79, align: 'left' },
    ]);
    expect(lines[1].d).toBe('M 170 40 L 170 94');
  });

  it('a line that passes a layer keeps to its lane, and the line straight down stays straight', () => {
    const { lines } = routeGraph(
      [at('a', 0, 0), at('b', 1, 0), at('c', 2, 0)],
      [
        { from: 'a', to: 'b', lanes: [] },
        { from: 'a', to: 'c', lanes: [125] },
        { from: 'b', to: 'c', lanes: [] },
      ],
      NONE,
      METRICS,
    );
    expect(lines[0]).toMatchObject({ d: 'M 50 40 L 50 94', port: { x: 50, y: 40 } });
    expect(lines[1]).toMatchObject({
      d:
        'M 78 40 L 78 60 Q 78 70 88 70 L 115 70 Q 125 70 125 80 L 125 160 Q 125 170 115 170' +
        ' L 60 170 Q 50 170 50 180 L 50 194',
      port: { x: 78, y: 40 },
      arrow: { x: 50, y: 199 },
      label: { x: 86, y: 46, align: 'left' },
    });
    expect(lines[2]).toMatchObject({ d: 'M 50 140 L 50 194', label: { x: 58, y: 146, align: 'left' } });
  });

  it('a line to a step that is not below its parent goes round the side of both', () => {
    const { lines } = routeGraph(
      [at('a', 1, 0), at('c', 2, 0)],
      [
        { from: 'a', to: 'c', lanes: [] },
        { from: 'c', to: 'a', lanes: [] },
      ],
      NONE,
      METRICS,
    );
    const back = lines.find((line) => line.from === 'c');
    expect(back?.port).toEqual({ x: 50, y: 240 });
    expect(back?.arrow).toEqual({ x: 50, y: 99 });
    expect(back?.d.startsWith('M 50 240 L 50 248 Q 50 256 58 256')).toBe(true);
    expect(back?.d.endsWith('L 50 94')).toBe(true);
  });

  it('a step placed far under its parent: the line runs across half a layer’s gap above the step', () => {
    const { lines } = routeGraph(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 300, y: 500 },
      ],
      [{ from: 'a', to: 'b', lanes: [] }],
      NONE,
      METRICS,
    );
    expect(lines).toEqual([
      {
        from: 'a',
        to: 'b',
        d: 'M 50 40 L 50 460 Q 50 470 60 470 L 340 470 Q 350 470 350 480 L 350 494',
        port: { x: 50, y: 40 },
        arrow: { x: 350, y: 499 },
        label: { x: 358, y: 479, align: 'left' },
      },
    ]);
  });

  it('a step placed beside its parent is not below it: the line goes round the side', () => {
    const { lines } = routeGraph(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 200, y: 0 },
      ],
      [{ from: 'a', to: 'b', lanes: [] }],
      NONE,
      METRICS,
    );
    expect(lines[0].port).toEqual({ x: 50, y: 40 });
    expect(lines[0].arrow).toEqual({ x: 250, y: -1 });
    expect(lines[0].d).toBe(
      'M 50 40 L 50 48 Q 50 56 58 56 L 306 56 Q 316 56 316 46 L 316 -6 Q 316 -16 306 -16' +
        ' L 255 -16 Q 250 -16 250 -11 L 250 -6',
    );
  });

  it('a step goes down from its parent only where its meeting line is clear under the parent', () => {
    const route = (childY: number) =>
      routeGraph(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 0, y: childY },
        ],
        [{ from: 'a', to: 'b', lanes: [] }],
        NONE,
        METRICS,
      ).lines[0];

    // The meeting line is 30 above the step; it must be 16 under the parent's lower edge at 40.
    expect(route(86).d).toBe('M 50 40 L 50 80');
    expect(route(85).d.startsWith('M 50 40 L 50 48 Q 50 56 58 56')).toBe(true);
  });

  it('an edge to a step that is not placed is not routed', () => {
    const { lines } = routeGraph([at('a', 0, 0)], [{ from: 'a', to: 'ghost', lanes: [] }], NONE, METRICS);
    expect(lines).toEqual([]);
  });
});

describe('arrowHeadPath', () => {
  it('is a triangle that points down at its tip', () => {
    expect(arrowHeadPath({ x: 50, y: 99 })).toBe('M 46 93 L 54 93 L 50 99 Z');
  });
});
