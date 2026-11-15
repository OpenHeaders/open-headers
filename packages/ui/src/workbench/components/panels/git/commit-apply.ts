/**
 * commit-apply — the pure side of the log's Cherry-Pick and Revert
 * Commit: the order a set of commits is applied in. The log lists
 * newest first; a pick replays history, so it runs oldest first; a
 * revert unwinds it, so it runs newest first. And which commits either
 * takes: one with ONE parent — a merge and the first commit have no
 * single change to read, and the host refuses both.
 */

export type CommitApplyMode = 'pick' | 'revert';

/** Whether a pick or a revert takes every commit of the set — a set stops at the first one it does not. */
export function commitsApply(
  entries: readonly { sha: string; parents: readonly string[] }[],
  shas: readonly string[],
): boolean {
  const set = new Set(shas);
  return entries.every((entry) => !set.has(entry.sha) || entry.parents.length === 1);
}

/** The selection (list order, newest first) in the order the host applies it. */
export function commitApplyOrder(shas: readonly string[], mode: CommitApplyMode): string[] {
  return mode === 'pick' ? [...shas].reverse() : [...shas];
}
