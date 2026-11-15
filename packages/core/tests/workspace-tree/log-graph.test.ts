/**
 * The log graph over rows by number: the lane sweep (which lane a
 * commit lands on, what its edges join, which colour it wears) and the
 * layout that holds a whole list as checkpoints — the cells of any
 * stretch of rows are the cells the whole sweep makes for them.
 */

import { describe, expect, it } from 'vitest';
import {
  advanceLogLayout,
  beginLogLayout,
  computeLogGraph,
  LOG_COLOR_UNKNOWN,
  LOG_LANE_COLOR_COUNT,
  type LogGraphInput,
  layoutLog,
  logGraphRows,
  type NamedLogEntry,
  numberLog,
} from '../../src/workspace-tree';

interface NamedOptions {
  head?: string;
  branchHeads?: readonly string[];
  /** Pointers (child, parent) that pass over hidden commits. */
  skips?: readonly (readonly [string, string])[];
  known?: Readonly<Record<string, number>>;
}

function inputOf(entries: readonly NamedLogEntry[], options: NamedOptions = {}) {
  const { skeleton, shas, numberOf } = numberLog(entries);
  const number = (sha: string): number => numberOf.get(sha) ?? -1;
  if (options.skips !== undefined) {
    const skips = new Uint8Array(skeleton.parents.length);
    for (const [child, parent] of options.skips) {
      for (let pointer = skeleton.starts[number(child)]; pointer < skeleton.starts[number(child) + 1]; pointer += 1) {
        if (skeleton.parents[pointer] === number(parent)) skips[pointer] = 1;
      }
    }
    skeleton.skips = skips;
  }
  const input: LogGraphInput = { skeleton, headRow: options.head === undefined ? -1 : number(options.head) };
  if (options.branchHeads !== undefined) {
    input.branchHeads = new Uint8Array(skeleton.count);
    for (const sha of options.branchHeads) input.branchHeads[number(sha)] = 1;
  }
  if (options.known !== undefined) {
    input.known = new Uint8Array(shas.length).fill(LOG_COLOR_UNKNOWN);
    for (const [sha, color] of Object.entries(options.known)) input.known[number(sha)] = color;
  }
  return { input, number };
}

const graphOf = (entries: readonly NamedLogEntry[], options: NamedOptions = {}) => {
  const { input, number } = inputOf(entries, options);
  return { rows: computeLogGraph(input), number };
};

describe('the lane sweep lays a log out row by row', () => {
  it('keeps a line on one lane, each row joined to the rows beside it', () => {
    const { rows, number } = graphOf([
      { sha: 'c3', parents: ['c2'] },
      { sha: 'c2', parents: ['c1'] },
      { sha: 'c1', parents: [] },
    ]);
    expect(rows.map((row) => [row.lane, row.laneCount])).toEqual([
      [0, 1],
      [0, 1],
      [0, 1],
    ]);
    expect(rows[1].edges).toEqual([
      { from: 0, to: 0, color: 0, span: 'top', child: number('c3'), parent: number('c2'), collapsed: false },
      { from: 0, to: 0, color: 0, span: 'bottom', child: number('c2'), parent: number('c1'), collapsed: false },
    ]);
    // A head entering the list draws nothing above its dot; the root forks to no parent.
    expect(rows[0].edges.map((edge) => edge.span)).toEqual(['bottom']);
    expect(rows[2].edges.map((edge) => edge.span)).toEqual(['top']);
  });

  it('forks a merge to a lane per parent and brings the side line back into the base', () => {
    const { rows } = graphOf([
      { sha: 'm', parents: ['a', 'b'] },
      { sha: 'a', parents: ['root'] },
      { sha: 'b', parents: ['root'] },
      { sha: 'root', parents: [] },
    ]);
    expect(rows[0].edges.filter((edge) => edge.span === 'bottom').map((edge) => edge.to)).toEqual([0, 1]);
    expect(rows[0].laneCount).toBe(2);
    expect(rows[1].edges.some((edge) => edge.span === 'pass' && edge.from === 1 && edge.to === 1)).toBe(true);
    expect(rows[3].lane).toBe(0);
    expect(rows[3].edges.filter((edge) => edge.span === 'top').map((edge) => edge.from)).toEqual([0, 1]);
    // The merged line wears its own colour; the merge and the shared base keep the trunk's.
    expect(rows[2].color).not.toBe(rows[0].color);
    expect([rows[1].color, rows[3].color]).toEqual([rows[0].color, rows[0].color]);
  });

  // feat2 (the newest row, a side head) -> feat1 -> base; main1 -> base -> root
  const FORKED = [
    { sha: 'feat2', parents: ['feat1'] },
    { sha: 'main1', parents: ['base'] },
    { sha: 'feat1', parents: ['base'] },
    { sha: 'base', parents: ['root'] },
    { sha: 'root', parents: [] },
  ];

  it("gives the shared history to the checked-out commit's lane, else to the lane that opened first", () => {
    const owned = graphOf(FORKED, { head: 'main1' }).rows;
    expect(owned[3].color).toBe(owned[1].color);
    expect(owned[4].color).toBe(owned[1].color);
    expect(owned[2].color).toBe(owned[0].color);
    // Where the two lines meet, each edge arrives in its own line's colour.
    expect(
      owned[3].edges
        .filter((edge) => edge.span === 'top')
        .map((edge) => edge.color)
        .sort(),
    ).toEqual([owned[0].color, owned[1].color].sort());

    const unowned = graphOf(FORKED).rows;
    expect(unowned[3].color).toBe(unowned[0].color);
    expect(unowned[1].color).not.toBe(unowned[0].color);
  });

  it('restarts the colour at a branch head a travelled lane reaches, and not at one a fresh lane opened for', () => {
    // main2 (HEAD) -> main1 -> origin (a branch) -> old
    const reached = graphOf(
      [
        { sha: 'main2', parents: ['main1'] },
        { sha: 'main1', parents: ['origin'] },
        { sha: 'origin', parents: ['old'] },
        { sha: 'old', parents: [] },
      ],
      { head: 'main2', branchHeads: ['main2', 'origin'] },
    ).rows;
    expect(reached[1].color).toBe(reached[0].color);
    expect(reached[2].color).not.toBe(reached[0].color);
    expect(reached[3].color).toBe(reached[2].color);
    expect(reached[2].edges.find((edge) => edge.span === 'top')?.color).toBe(reached[0].color);

    // merge -> [main1, fix]; fix (a branch) -> base
    const { rows: opened, number } = graphOf(
      [
        { sha: 'merge', parents: ['main1', 'fix'] },
        { sha: 'main1', parents: ['base'] },
        { sha: 'fix', parents: ['base'] },
        { sha: 'base', parents: [] },
      ],
      { branchHeads: ['merge', 'fix'] },
    );
    const side = opened[0].edges.find((edge) => edge.span === 'bottom' && edge.parent === number('fix'));
    expect(opened[2].color).toBe(side?.color);
  });

  it('flags a pointer that passes over hidden commits at both its ends and on every row it crosses', () => {
    const { rows, number } = graphOf(
      [
        { sha: 'main3', parents: ['main1'] },
        { sha: 'side', parents: ['main1'] },
        { sha: 'main1', parents: [] },
      ],
      { skips: [['main3', 'main1']] },
    );
    expect(rows[0].edges.find((edge) => edge.span === 'bottom')?.collapsed).toBe(true);
    expect(rows[1].edges.find((edge) => edge.span === 'pass')?.collapsed).toBe(true);
    const into = rows[2].edges.filter((edge) => edge.span === 'top');
    expect(into.find((edge) => edge.child === number('main3'))?.collapsed).toBe(true);
    expect(into.find((edge) => edge.child === number('side'))?.collapsed).toBe(false);
  });

  it('numbers colours in the order lanes open, round the palette', () => {
    const heads = Array.from({ length: LOG_LANE_COLOR_COUNT + 1 }, (_, i) => ({ sha: `h${i}`, parents: [] }));
    const { rows } = graphOf(heads);
    expect(rows.map((row) => row.color)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  });

  it('has a commit wear the colour it has in the whole log, and the lane that reaches it too', () => {
    const { rows } = graphOf(
      [
        { sha: 'tip', parents: ['old'] },
        { sha: 'old', parents: [] },
      ],
      { known: { tip: 5, old: 3 } },
    );
    expect(rows.map((row) => row.color)).toEqual([5, 3]);
    expect(rows[0].edges[0].color).toBe(5);
  });

  it('keeps two lines apart that leave the list for different commits, and joins two that leave for the same', () => {
    const apart = graphOf([
      { sha: 'a', parents: ['gone1'] },
      { sha: 'm', parents: ['b', 'gone2'] },
      { sha: 'b', parents: [] },
    ]).rows;
    // `m` opens a lane for `gone2` beside the one already running for `gone1`.
    expect(apart[1].laneCount).toBe(3);

    const joined = graphOf([
      { sha: 'a', parents: ['gone'] },
      { sha: 'm', parents: ['b', 'gone'] },
      { sha: 'b', parents: [] },
    ]).rows;
    expect(joined[1].laneCount).toBe(2);
    expect(joined[1].edges.filter((edge) => edge.span === 'bottom').map((edge) => edge.to)).toEqual([1, 0]);
  });
});

/** A history with forks, merges and heads entering part-way — the same one every run. */
function tangle(count: number): NamedLogEntry[] {
  let seed = 7;
  const next = (below: number): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % below;
  };
  const entries: NamedLogEntry[] = [];
  for (let row = 0; row < count; row += 1) {
    const parents: string[] = [];
    const left = count - 1 - row;
    if (left > 0 && next(10) > 0) parents.push(`c${row + 1 + next(Math.min(left, 4))}`);
    if (left > 1 && next(4) === 0) {
      const second = `c${row + 1 + next(Math.min(left, 9))}`;
      if (!parents.includes(second)) parents.push(second);
    }
    entries.push({ sha: `c${row}`, parents });
  }
  return entries;
}

describe('the layout holds a whole list as checkpoints', () => {
  const entries = tangle(64);
  const { input } = inputOf(entries, { head: 'c3', branchHeads: ['c0', 'c9', 'c21', 'c40'] });
  const whole = computeLogGraph(input);

  it('makes, for any stretch of rows, the cells the whole sweep makes for them', () => {
    const layout = layoutLog(input, 5);
    expect(layout.checkpoints).toHaveLength(13);
    for (const [from, count] of [
      [0, 64],
      [0, 1],
      [4, 2],
      [5, 5],
      [17, 30],
      [63, 1],
      [60, 40],
    ]) {
      expect(logGraphRows(input, layout, from, count)).toEqual(whole.slice(from, from + count));
    }
    expect(logGraphRows(input, layout, 64, 10)).toEqual([]);
  });

  it('keeps the colour of every commit and the widest row', () => {
    const layout = layoutLog(input, 5);
    expect([...layout.colors]).toEqual(whole.map((row) => row.color));
    expect(layout.widest).toBe(Math.max(...whole.map((row) => row.laneCount)));
    expect(layout.widest).toBeGreaterThan(3);
  });

  it('is the same layout taken a stretch at a time, and answers for the rows it has reached', () => {
    const layout = beginLogLayout(input.skeleton.count, 5);
    expect(advanceLogLayout(input, layout, 7)).toBe(false);
    expect(layout.swept).toBe(7);
    expect(logGraphRows(input, layout, 3, 10)).toEqual(whole.slice(3, 7));
    expect(advanceLogLayout(input, layout, 1)).toBe(false);
    expect(advanceLogLayout(input, layout, 1000)).toBe(true);
    expect(layout).toEqual(layoutLog(input, 5));
  });
});
