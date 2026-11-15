/**
 * A log with some of its commits hidden, still a graph — a sifted list
 * (No Merges, a text, a user, a date, a path). Each commit that stays
 * is joined to the nearest listed commits it descends from; a join that
 * passes over hidden commits is flagged, so the graph draws it as the
 * stubs and a line between two rows still means "this is the parent".
 *
 * A commit reached twice — by a listed parent and again through a
 * hidden path under another one — keeps the shorter story alone: a join
 * to a commit that another join already leads to is dropped.
 *
 * A row carries at most `limit` joins, the nearest by row: where the
 * listed commits sit on short side lines of a long hidden trunk, the
 * commits nothing listed leads to pile up without end, and a row with a
 * thousand lines out of it says nothing a row with eight does not.
 *
 * The work is one pass up the list, oldest first, taken a stretch at a
 * time (`contractLogSteps`) so a host does it between its other work.
 */

import type { DerivedLog, LogSkeleton } from './skeleton';

/** The most joins one row of a sifted list carries. */
export const LOG_JOIN_LIMIT = 8;

/** Rows a stretch of the pass reads before it hands the thread back. */
const STRETCH_ROWS = 20_000;

const NONE: readonly number[] = [];

/** The nearest `limit` of `rows` by row number, in the order they stand. */
function nearestOf(rows: number[], limit: number): number[] {
  if (rows.length <= limit) return rows;
  const farthest = [...rows].sort((a, b) => a - b)[limit - 1];
  return rows.filter((row) => row <= farthest);
}

/**
 * The pass, a stretch at a time: each `next()` reads up to a stretch of
 * rows; the list is the generator's return value. `listed` flags the
 * source's rows that stay.
 */
export function* contractLogSteps(
  source: LogSkeleton,
  listed: Uint8Array,
  limit: number = LOG_JOIN_LIMIT,
): Generator<void, DerivedLog, void> {
  const { count, starts, parents } = source;
  // What a row hands the rows above it: itself when listed, else what
  // its parents hand up — shared with a lone parent, never copied.
  const nearest = new Array<readonly number[]>(count);
  // A listed row's joins, in the order its parents lead to them.
  const joined = new Array<readonly number[]>(count);

  /** `from` leads to `target` through the joins made so far. A join only ever leads down the list. */
  const leadsTo = (from: number, target: number): boolean => {
    if (from > target) return false;
    const seen = new Set<number>([from]);
    const stack = [from];
    for (let row = stack.pop(); row !== undefined; row = stack.pop()) {
      if (row === target) return true;
      for (const under of joined[row]) {
        if (under <= target && !seen.has(under)) {
          seen.add(under);
          stack.push(under);
        }
      }
    }
    return false;
  };

  for (let row = count - 1; row >= 0; row -= 1) {
    if ((count - 1 - row) % STRETCH_ROWS === STRETCH_ROWS - 1) yield;
    const first = starts[row];
    const end = starts[row + 1];
    let reached: readonly number[] = NONE;
    if (end - first === 1) {
      if (parents[first] < count) reached = nearest[parents[first]];
    } else if (end > first) {
      const union: number[] = [];
      for (let pointer = first; pointer < end; pointer += 1) {
        if (parents[pointer] >= count) continue;
        for (const under of nearest[parents[pointer]]) {
          if (!union.includes(under)) union.push(under);
        }
      }
      reached = nearestOf(union, limit);
    }
    if (listed[row] === 0) {
      nearest[row] = reached;
      continue;
    }
    nearest[row] = [row];
    joined[row] =
      reached.length < 2
        ? reached
        : reached.filter((under) => !reached.some((other) => other !== under && leadsTo(other, under)));
  }

  const placed = new Int32Array(count).fill(-1);
  let size = 0;
  for (let row = 0; row < count; row += 1) {
    if (listed[row] === 1) {
      placed[row] = size;
      size += 1;
    }
  }
  const rows = new Int32Array(size);
  const listStarts = new Int32Array(size + 1);
  const joins: number[] = [];
  const skips: number[] = [];
  for (let row = 0; row < count; row += 1) {
    if (listed[row] === 0) continue;
    rows[placed[row]] = row;
    listStarts[placed[row]] = joins.length;
    for (const under of joined[row]) {
      joins.push(placed[under]);
      // A join to the commit's own parent is a plain line — unless that pointer already passed over hidden commits.
      let passes = 1;
      for (let pointer = starts[row]; pointer < starts[row + 1]; pointer += 1) {
        if (parents[pointer] === under) passes = source.skips === undefined ? 0 : source.skips[pointer];
      }
      skips.push(passes);
    }
  }
  listStarts[size] = joins.length;
  return {
    skeleton: { count: size, starts: listStarts, parents: Int32Array.from(joins), skips: Uint8Array.from(skips) },
    rows,
  };
}

/** The sifted list in one go. */
export function contractLog(source: LogSkeleton, listed: Uint8Array, limit: number = LOG_JOIN_LIMIT): DerivedLog {
  const steps = contractLogSteps(source, listed, limit);
  for (let step = steps.next(); ; step = steps.next()) {
    if (step.done === true) return step.value;
  }
}
