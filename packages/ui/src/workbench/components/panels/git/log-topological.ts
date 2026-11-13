/**
 * Sort › Topologically, the reference's reading — the order git's own
 * `--topo-order` only approaches. The trunk runs unbroken: the checked-
 * out commit leads, every other head's run that the trunk has not taken
 * in is listed as a block above it (in the window's order, the newest
 * head first), the checked-out branch's own upstream last — next to the
 * trunk commit it extends — and a merged branch's commits sit directly
 * under their merge.
 *
 * Pure: one pass over the window the host answered (newest first, no
 * parent before its child). A commit is listed once every commit above
 * it in the window is; a line goes on as far as it is free to, a
 * merge's side parent before its first. A parent outside the window is
 * no one's to wait for.
 */

export interface TopologicalEntry {
  sha: string;
  parents: readonly string[];
}

export interface TopologicalOptions {
  /** The checked-out commit — its line leads the list. */
  lead: string | null;
  /** Heads listed after every other one: the checked-out branch's upstream. */
  last: ReadonlySet<string>;
}

export function topologicalOrder<T extends TopologicalEntry>(window: readonly T[], options: TopologicalOptions): T[] {
  const bySha = new Map<string, T>();
  const waiting = new Map<string, number>();
  for (const entry of window) {
    bySha.set(entry.sha, entry);
    waiting.set(entry.sha, 0);
  }
  for (const entry of window) {
    for (const parent of entry.parents) {
      const count = waiting.get(parent);
      if (count !== undefined) waiting.set(parent, count + 1);
    }
  }

  const heads = window.filter((entry) => waiting.get(entry.sha) === 0).map((entry) => entry.sha);
  const ordered = [
    ...heads.filter((sha) => sha === options.lead),
    ...heads.filter((sha) => sha !== options.lead && !options.last.has(sha)),
    ...heads.filter((sha) => sha !== options.lead && options.last.has(sha)),
  ];

  const out: T[] = [];
  const listed = new Set<string>();
  // The next commit to list is the stack's top: a line continues before another head starts.
  const stack = ordered.reverse();
  for (let sha = stack.pop(); sha !== undefined; sha = stack.pop()) {
    const entry = bySha.get(sha);
    if (entry === undefined || listed.has(sha)) continue;
    listed.add(sha);
    out.push(entry);
    for (const parent of entry.parents) {
      const count = waiting.get(parent);
      if (count === undefined) continue;
      waiting.set(parent, count - 1);
      // Pushed in parent order, so the last (a merge's side) is taken first.
      if (count === 1) stack.push(parent);
    }
  }
  // A window that is no clean history (it cannot be, but nothing is dropped if it is).
  for (const entry of window) {
    if (!listed.has(entry.sha)) out.push(entry);
  }
  return out;
}
