/**
 * The list's first rows with a text applied
 * (`panels/git/log-sifted-window`): the commits that stay, still a
 * graph — each joined to the nearest listed commits it descends from, a
 * join over hidden commits drawn as the stubs, each in the colour it
 * wears in the whole list, a line ending where it leaves the window.
 */

import type { WorkspaceTreeLogEdgeWire, WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import { GRAPH_LANE_COLORS } from '@openheaders/ui/workbench/components/panels/git/graph';
import { siftLogWindow } from '@openheaders/ui/workbench/components/panels/git/log-sifted-window';
import { describe, expect, it } from 'vitest';

interface Made {
  parents: number[];
  color?: number;
  /** The parents its own join already passes over hidden commits to. */
  passes?: number[];
  /** Other rows' joins that cross its cell. */
  crossing?: WorkspaceTreeLogEdgeWire[];
}

/** The window: row `i` is commit `c<i>`, joined to the rows named. */
function windowOf(made: Made[]): WorkspaceTreeLogRowWire[] {
  return made.map(({ parents, color = 0, passes = [], crossing = [] }, at) => ({
    entry: {
      sha: `c${at}`,
      parents: parents.map((parent) => `c${parent}`),
      authorName: 'John Doe',
      authorEmail: 'john@openheaders.io',
      authoredAt: '2026-11-15T10:00:00.000Z',
      subject: `commit ${at}`,
      coAuthors: [],
      files: [],
    },
    cell: {
      lane: 0,
      color,
      laneCount: 1,
      edges: [
        ...crossing,
        ...parents.map(
          (parent): WorkspaceTreeLogEdgeWire => ({
            from: 0,
            to: 0,
            color,
            span: 'bottom',
            child: at,
            parent,
            collapsed: passes.includes(parent),
          }),
        ),
      ],
    },
    parents,
    child: at - 1,
  }));
}

/** One line, newest first: each commit joined to the row under it, the last to a commit past the window. */
const line = (count: number): Made[] => Array.from({ length: count }, (_, at) => ({ parents: [at + 1] }));

const keeping =
  (...rows: number[]) =>
  (entry: { sha: string }): boolean =>
    rows.includes(Number(entry.sha.slice(1)));

/** Each row's edges as its cell draws them: the half of the row, the lanes where they are not the first, a `~` on one that passes over hidden commits. */
const cells = (graph: ReturnType<typeof siftLogWindow>['graph']): string[][] =>
  graph.map((row) =>
    row.edges.map(
      (edge) =>
        `${edge.span}${edge.from === 0 && edge.to === 0 ? '' : `:${edge.from}>${edge.to}`}${edge.collapsed ? '~' : ''}`,
    ),
  );

describe('siftLogWindow', () => {
  it('lists the commits that stay, in list order', () => {
    const sifted = siftLogWindow(windowOf(line(6)), keeping(1, 3, 4));
    expect(sifted.entries.map((entry) => entry.sha)).toEqual(['c1', 'c3', 'c4']);
    expect(sifted.graph).toHaveLength(3);
  });

  it('lists none, with no graph, when nothing stays', () => {
    expect(siftLogWindow(windowOf(line(6)), keeping())).toEqual({ entries: [], graph: [] });
  });

  it('joins two commits that stay next to each other with a plain line', () => {
    expect(cells(siftLogWindow(windowOf(line(6)), keeping(3, 4)).graph)).toEqual([['bottom'], ['top']]);
  });

  it('joins a commit to the nearest listed one under it, over the hidden ones, as the stubs', () => {
    expect(cells(siftLogWindow(windowOf(line(6)), keeping(1, 3, 4)).graph)).toEqual([
      ['bottom~'],
      ['top~', 'bottom'],
      ['top'],
    ]);
  });

  it('keeps a join the host already drew over hidden commits as the stubs', () => {
    const made = line(6);
    made[3] = { parents: [4], passes: [4] };
    expect(cells(siftLogWindow(windowOf(made), keeping(3, 4)).graph)).toEqual([['bottom~'], ['top~']]);
  });

  it('reads each of a merge’s joins by its own parent — one over hidden commits, the other plain', () => {
    const made: Made[] = [{ parents: [1, 2], passes: [2] }, { parents: [3] }, { parents: [3] }, { parents: [4] }];
    // The second side's line crosses c1's row on its way to c2, stubbed as it left the merge.
    expect(cells(siftLogWindow(windowOf(made), keeping(0, 1, 2)).graph)).toEqual([
      ['bottom', 'bottom:0>1~'],
      ['top', 'pass:1>0~'],
      ['top~'],
    ]);
  });

  it('reads a row’s join off its OWN edge — not off another row’s that crosses its cell to the same parent', () => {
    // c0 reaches c2 over hidden commits and its line crosses c1's cell; c1's own join to c2 is plain.
    const made: Made[] = [
      { parents: [2], passes: [2] },
      {
        parents: [2],
        crossing: [{ from: 1, to: 1, color: 0, span: 'pass', child: 0, parent: 2, collapsed: true }],
      },
      { parents: [3] },
    ];
    expect(cells(siftLogWindow(windowOf(made), keeping(1, 2)).graph)).toEqual([['bottom'], ['top']]);
  });

  it('ends a line where it leaves the window', () => {
    expect(cells(siftLogWindow(windowOf(line(6)), keeping(4, 5)).graph)).toEqual([['bottom'], ['top']]);
  });

  it('never joins two lines that leave the window for different commits', () => {
    // c0 and c1 are two heads; each leaves for a commit of its own past the window.
    const sifted = siftLogWindow(windowOf([{ parents: [7] }, { parents: [9] }]), keeping(0, 1));
    expect(cells(sifted.graph)).toEqual([[], []]);
  });

  it('joins a merge to what each side leads to among the listed', () => {
    // c0 merges c1 (the line c1 > c3 > c5) and c2 (the line c2 > c4 > c5).
    const made: Made[] = [
      { parents: [1, 2] },
      { parents: [3] },
      { parents: [4] },
      { parents: [5] },
      { parents: [5] },
      { parents: [6] },
    ];
    expect(cells(siftLogWindow(windowOf(made), keeping(0, 3, 4)).graph)).toEqual([
      ['bottom~', 'bottom:0>1~'],
      ['top~', 'pass:1>0~'],
      ['top~'],
    ]);
    // Both sides lead to c5 alone: one join, not two.
    expect(cells(siftLogWindow(windowOf(made), keeping(0, 5)).graph)).toEqual([['bottom~'], ['top~']]);
  });

  it('draws each commit in the colour it wears in the whole list', () => {
    const made = line(6).map((row, at) => ({ ...row, color: at < 3 ? 5 : 2 }));
    const sifted = siftLogWindow(windowOf(made), keeping(1, 4));
    expect(sifted.graph.map((row) => row.color)).toEqual([GRAPH_LANE_COLORS[5], GRAPH_LANE_COLORS[2]]);
  });

  it('draws a fork as the layout lays it: each dot on its lane, each edge with its lanes, its half and its colour', () => {
    // Two heads: c0 joins c3 directly; c1 joins it through c2, which the text hides.
    const made: Made[] = [
      { parents: [3], color: 1 },
      { parents: [2], color: 4 },
      { parents: [3], color: 4 },
      { parents: [4], color: 1 },
      { parents: [9], color: 1 },
    ];
    const one = GRAPH_LANE_COLORS[1];
    const four = GRAPH_LANE_COLORS[4];
    expect(siftLogWindow(windowOf(made), keeping(0, 1, 3, 4)).graph).toEqual([
      {
        lane: 0,
        color: one,
        laneCount: 1,
        edges: [{ from: 0, to: 0, color: one, span: 'bottom', collapsed: false, lit: false }],
      },
      {
        lane: 1,
        color: four,
        laneCount: 2,
        edges: [
          { from: 1, to: 1, color: four, span: 'bottom', collapsed: true, lit: false },
          { from: 0, to: 0, color: one, span: 'pass', collapsed: false, lit: false },
        ],
      },
      {
        lane: 0,
        color: one,
        laneCount: 2,
        edges: [
          { from: 0, to: 0, color: one, span: 'top', collapsed: false, lit: false },
          { from: 1, to: 0, color: four, span: 'top', collapsed: true, lit: false },
          { from: 0, to: 0, color: one, span: 'bottom', collapsed: false, lit: false },
        ],
      },
      {
        lane: 0,
        color: one,
        laneCount: 1,
        edges: [{ from: 0, to: 0, color: one, span: 'top', collapsed: false, lit: false }],
      },
    ]);
  });

  it('gives a one-lane line one lane, each row a dot on it', () => {
    const sifted = siftLogWindow(windowOf(line(6)), keeping(1, 3, 4));
    expect(sifted.graph.map((row) => [row.lane, row.laneCount])).toEqual([
      [0, 1],
      [0, 1],
      [0, 1],
    ]);
  });
});
