/**
 * What a set of commits reaches in a log — the rows a scope's refs
 * list, the rows on the current branch, the rows a first-parent walk
 * keeps. One pass down the list: no parent sits above its child, so by
 * the time a row is read every commit that leads to it has been.
 */

import type { LogSkeleton } from './skeleton';

function flagged(skeleton: LogSkeleton, tips: Iterable<number>): Uint8Array {
  const reached = new Uint8Array(skeleton.count);
  for (const tip of tips) {
    if (tip >= 0 && tip < skeleton.count) reached[tip] = 1;
  }
  return reached;
}

/** Per row: 1 for the tips and every commit they descend from. */
export function reachFrom(skeleton: LogSkeleton, tips: Iterable<number>): Uint8Array {
  const { count, starts, parents } = skeleton;
  const reached = flagged(skeleton, tips);
  for (let row = 0; row < count; row += 1) {
    if (reached[row] === 0) continue;
    for (let pointer = starts[row]; pointer < starts[row + 1]; pointer += 1) {
      if (parents[pointer] < count) reached[parents[pointer]] = 1;
    }
  }
  return reached;
}

/**
 * Per row: 1 for what a first-parent walk lists — what the list's heads
 * and `tips` (the refs the log walks from) reach through first parents.
 * A commit only a merge's side parent leads to is listed when a tip
 * still names it, and not otherwise — as git's own walk has it.
 */
export function firstParentReach(skeleton: LogSkeleton, tips: Iterable<number>): Uint8Array {
  const { count, starts, parents } = skeleton;
  const hasChild = new Uint8Array(count);
  for (let pointer = 0; pointer < parents.length; pointer += 1) {
    if (parents[pointer] < count) hasChild[parents[pointer]] = 1;
  }
  const reached = flagged(skeleton, tips);
  for (let row = 0; row < count; row += 1) {
    if (hasChild[row] === 0) reached[row] = 1;
    if (reached[row] === 0 || starts[row + 1] === starts[row]) continue;
    const first = parents[starts[row]];
    if (first < count) reached[first] = 1;
  }
  return reached;
}

/** The rows a flag is set on, in list order. */
export function flaggedRows(flags: Uint8Array): Int32Array {
  let size = 0;
  for (let row = 0; row < flags.length; row += 1) size += flags[row];
  const rows = new Int32Array(size);
  let at = 0;
  for (let row = 0; row < flags.length; row += 1) {
    if (flags[row] === 1) {
      rows[at] = row;
      at += 1;
    }
  }
  return rows;
}
