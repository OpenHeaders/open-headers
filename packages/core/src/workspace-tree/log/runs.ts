/**
 * The linear runs of a log — the graph's hover and fold unit. A run is
 * the stretch of plain commits (one parent, one child in the list, no
 * anchor on it) between two ends: a fork, a merge, a commit a ref
 * points at, the checked-out commit, or the list's edge. The pointer
 * over a node lights the run it sits in; a fold hides the run's commits
 * and leaves the two ends, the pointer between them flagged so the
 * graph draws the stubs.
 *
 * Every run of a list is numbered in one pass down it — a plain commit
 * continues the run of the plain commit above it, or starts one under
 * the commit that is not.
 */

import type { DerivedLog, LogSkeleton } from './skeleton';

export interface LogRuns {
  /** Per row: the run whose hidden stretch the commit sits in; -1 for a commit in none. */
  runOf: Int32Array;
  /** How many runs the list holds. */
  count: number;
  /** Per run: the commit above its stretch — the one whose pointer leads into it. */
  tops: Int32Array;
  /** Per run: the first commit of its stretch, just under the top. */
  firsts: Int32Array;
  /** Per run: the commit under its stretch — at the list's edge, the last plain commit the list holds. */
  bottoms: Int32Array;
  /** Per run: how many commits its stretch hides when folded. */
  lengths: Int32Array;
}

/** Number the runs of `skeleton`; `anchors` flags the rows a run never crosses (a ref's commit, the checked-out one). */
export function linearRuns(skeleton: LogSkeleton, anchors: Uint8Array): LogRuns {
  const { count, starts, parents } = skeleton;
  const children = new Int32Array(count);
  const child = new Int32Array(count).fill(-1);
  for (let row = 0; row < count; row += 1) {
    for (let pointer = starts[row]; pointer < starts[row + 1]; pointer += 1) {
      const parent = parents[pointer];
      if (parent >= count) continue;
      children[parent] += 1;
      child[parent] = row;
    }
  }
  const plain = (row: number): boolean =>
    anchors[row] === 0 && starts[row + 1] - starts[row] === 1 && children[row] === 1;

  // Every chain of plain commits, in the order its first commit is met.
  const chainOf = new Int32Array(count).fill(-1);
  const tops: number[] = [];
  const firsts: number[] = [];
  const lasts: number[] = [];
  const sizes: number[] = [];
  for (let row = 0; row < count; row += 1) {
    if (!plain(row)) continue;
    const above = child[row];
    if (chainOf[above] !== -1) {
      chainOf[row] = chainOf[above];
      lasts[chainOf[row]] = row;
      sizes[chainOf[row]] += 1;
    } else {
      chainOf[row] = tops.length;
      tops.push(above);
      firsts.push(row);
      lasts.push(row);
      sizes.push(1);
    }
  }

  // A chain that runs off the list ends on its last commit; one with nothing left to hide is no run.
  const number = new Int32Array(tops.length).fill(-1);
  const runs: LogRuns = {
    runOf: new Int32Array(count).fill(-1),
    count: 0,
    tops: new Int32Array(tops.length),
    firsts: new Int32Array(tops.length),
    bottoms: new Int32Array(tops.length),
    lengths: new Int32Array(tops.length),
  };
  const ends = new Uint8Array(count);
  for (let chain = 0; chain < tops.length; chain += 1) {
    const under = parents[starts[lasts[chain]]];
    const offList = under >= count;
    const length = offList ? sizes[chain] - 1 : sizes[chain];
    if (offList) ends[lasts[chain]] = 1;
    if (length === 0) continue;
    number[chain] = runs.count;
    runs.tops[runs.count] = tops[chain];
    runs.firsts[runs.count] = firsts[chain];
    runs.bottoms[runs.count] = offList ? lasts[chain] : under;
    runs.lengths[runs.count] = length;
    runs.count += 1;
  }
  for (let row = 0; row < count; row += 1) {
    if (chainOf[row] !== -1 && ends[row] === 0) runs.runOf[row] = number[chainOf[row]];
  }
  runs.tops = runs.tops.subarray(0, runs.count);
  runs.firsts = runs.firsts.subarray(0, runs.count);
  runs.bottoms = runs.bottoms.subarray(0, runs.count);
  runs.lengths = runs.lengths.subarray(0, runs.count);
  return runs;
}

/**
 * The run a pointer over `row` lights: a commit inside a stretch names
 * its run; any other reads the run below it along its first parent. -1
 * where there is none.
 */
export function runAt(skeleton: LogSkeleton, runs: LogRuns, row: number): number {
  if (runs.runOf[row] !== -1) return runs.runOf[row];
  if (skeleton.starts[row + 1] === skeleton.starts[row]) return -1;
  const first = skeleton.parents[skeleton.starts[row]];
  if (first >= skeleton.count) return -1;
  const under = runs.runOf[first];
  return under !== -1 && runs.tops[under] === row ? under : -1;
}

/**
 * The list with the stretches of the `folded` runs (a flag per run)
 * left out: a pointer into a folded stretch reaches the run's bottom
 * instead, flagged as passing over hidden commits.
 */
export function foldRuns(source: LogSkeleton, runs: LogRuns, folded: Uint8Array): DerivedLog {
  const { count, starts, parents } = source;
  const hidden = (row: number): boolean => row < count && runs.runOf[row] !== -1 && folded[runs.runOf[row]] === 1;
  const placed = new Int32Array(count).fill(-1);
  let size = 0;
  for (let row = 0; row < count; row += 1) {
    if (hidden(row)) continue;
    placed[row] = size;
    size += 1;
  }
  const rows = new Int32Array(size);
  const listStarts = new Int32Array(size + 1);
  const pointers: number[] = [];
  const skips: number[] = [];
  let outside = 0;
  const outsideOf = new Map<number, number>();
  for (let row = 0; row < count; row += 1) {
    if (placed[row] === -1) continue;
    rows[placed[row]] = row;
    listStarts[placed[row]] = pointers.length;
    for (let pointer = starts[row]; pointer < starts[row + 1]; pointer += 1) {
      const parent = parents[pointer];
      const into = hidden(parent);
      const reaches = into ? runs.bottoms[runs.runOf[parent]] : parent;
      if (reaches < count) pointers.push(placed[reaches]);
      else {
        let number = outsideOf.get(reaches);
        if (number === undefined) {
          number = size + outside;
          outside += 1;
          outsideOf.set(reaches, number);
        }
        pointers.push(number);
      }
      skips.push(into || (source.skips !== undefined && source.skips[pointer] === 1) ? 1 : 0);
    }
  }
  listStarts[size] = pointers.length;
  return {
    skeleton: { count: size, starts: listStarts, parents: Int32Array.from(pointers), skips: Uint8Array.from(skips) },
    rows,
  };
}
