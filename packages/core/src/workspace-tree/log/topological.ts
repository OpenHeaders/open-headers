/**
 * Sort › Topologically — the order git's own `--topo-order` only
 * approaches. The trunk runs unbroken: the checked-out commit leads,
 * every other head's run that the trunk has not taken in is listed as a
 * block above it (in the list's order, the newest head first), the
 * checked-out branch's own upstream last — next to the trunk commit it
 * extends — and a merged branch's commits sit directly under their
 * merge.
 *
 * One pass over a list in its own order (newest first, no parent above
 * its child). A commit is listed once every commit above it is; a line
 * goes on as far as it is free to, a merge's side parent before its
 * first. A parent outside the list is no one's to wait for.
 */

import type { LogSkeleton } from './skeleton';

export interface TopologicalOptions {
  /** The checked-out commit — its line leads the list; -1 for none. */
  lead: number;
  /** Per row: 1 on a head listed after every other one — the checked-out branch's upstream. */
  last?: Uint8Array;
}

/** The list's rows in topological order. */
export function topologicalRows(skeleton: LogSkeleton, options: TopologicalOptions): Int32Array {
  const { count, starts, parents } = skeleton;
  const { lead, last } = options;
  const waiting = new Int32Array(count);
  for (let pointer = 0; pointer < parents.length; pointer += 1) {
    if (parents[pointer] < count) waiting[parents[pointer]] += 1;
  }

  // The next commit to list is the stack's top: a line continues before
  // another head starts. Pushed last-to-first, so the lead is on top,
  // then the other heads in the list's order, the upstream under them.
  const stack: number[] = [];
  const isLast = (row: number): boolean => last !== undefined && last[row] === 1;
  for (let row = count - 1; row >= 0; row -= 1) {
    if (waiting[row] === 0 && row !== lead && isLast(row)) stack.push(row);
  }
  for (let row = count - 1; row >= 0; row -= 1) {
    if (waiting[row] === 0 && row !== lead && !isLast(row)) stack.push(row);
  }
  if (lead >= 0 && lead < count && waiting[lead] === 0) stack.push(lead);

  const order = new Int32Array(count);
  const listed = new Uint8Array(count);
  let size = 0;
  for (let row = stack.pop(); row !== undefined; row = stack.pop()) {
    if (listed[row] === 1) continue;
    listed[row] = 1;
    order[size] = row;
    size += 1;
    // Pushed in parent order, so the last (a merge's side) is taken first.
    for (let pointer = starts[row]; pointer < starts[row + 1]; pointer += 1) {
      const parent = parents[pointer];
      if (parent >= count) continue;
      waiting[parent] -= 1;
      if (waiting[parent] === 0) stack.push(parent);
    }
  }
  // A list that is no clean history (it cannot be, but nothing is dropped if it is).
  for (let row = 0; row < count && size < count; row += 1) {
    if (listed[row] === 0) {
      order[size] = row;
      size += 1;
    }
  }
  return order;
}
