/**
 * log-reachability — the commits reachable from a tip over the loaded
 * log window: a walk down `parents` (every entry carries them) that
 * stops at the window's edge. The rail-selection wash and the
 * current-branch band are both this set over a different tip. Pure.
 */

export interface LogParentEntry {
  sha: string;
  parents: readonly string[];
}

/** Null when the tip is not in the window (nothing to paint). */
export function reachableFrom(tip: string, entries: readonly LogParentEntry[]): ReadonlySet<string> | null {
  const bySha = new Map(entries.map((entry) => [entry.sha, entry]));
  const reachable = new Set<string>();
  const queue = [tip];
  while (queue.length > 0) {
    const sha = queue.pop() as string;
    if (reachable.has(sha)) continue;
    const entry = bySha.get(sha);
    if (entry === undefined) continue;
    reachable.add(sha);
    queue.push(...entry.parents);
  }
  return reachable.size > 0 ? reachable : null;
}
