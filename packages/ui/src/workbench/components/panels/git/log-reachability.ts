/**
 * log-reachability — the current-branch band's set: the host's
 * per-entry `onHead` flags when every row carries one (true containment,
 * so a scope that leaves HEAD's tip out of the window still bands the
 * rows already on the current branch), else a walk down `parents` from
 * the tip over the loaded window (the edge-stopping fallback for an
 * older host). The band's tip is HEAD's commit (a branch tip or a
 * detached sha) and it is withheld while the log is scoped to HEAD, to
 * the checked-out branch itself, or to the two together (the reference
 * rule: every row would carry it, so it says nothing). Pure.
 */

export interface LogParentEntry {
  sha: string;
  parents: readonly string[];
  /** The host's containment answer; absent from an older host or a range log. */
  onHead?: boolean;
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

export interface CurrentBranchBandScope {
  /** The log scope: empty = every ref; a member is the HEAD sentinel or a ref name. */
  selectedRefs: readonly string[];
  /** The HEAD sentinel the scope triad uses. */
  headScope: string;
  /** The checked-out branch's name; null when detached or unborn. */
  currentBranch: string | null;
}

/**
 * The tip the current-branch band walks from: HEAD's commit, unless the
 * scope holds nothing but HEAD and the checked-out branch (every row
 * reachable — the reference paints nothing) or HEAD's commit is unknown.
 */
export function currentBranchBandTip(headSha: string | null, scope: CurrentBranchBandScope): string | null {
  if (headSha === null) return null;
  const onHead = (ref: string): boolean =>
    ref === scope.headScope || (scope.currentBranch !== null && ref === scope.currentBranch);
  if (scope.selectedRefs.length > 0 && scope.selectedRefs.every(onHead)) return null;
  return headSha;
}

/**
 * The rows the band paints: the host's flags when the whole window
 * carries them, else the window walk from the tip. Null when nothing
 * is on the current branch or the tip is outside the window.
 */
export function currentBranchShas(tip: string, entries: readonly LogParentEntry[]): ReadonlySet<string> | null {
  if (entries.length > 0 && entries.every((entry) => entry.onHead !== undefined)) {
    const flagged = new Set(entries.filter((entry) => entry.onHead === true).map((entry) => entry.sha));
    return flagged.size > 0 ? flagged : null;
  }
  return reachableFrom(tip, entries);
}
