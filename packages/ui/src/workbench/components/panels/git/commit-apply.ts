/**
 * commit-apply — the pure side of the log's Cherry-Pick and Revert
 * Commit: the order a set of commits is applied in. The log lists
 * newest first; a pick replays history, so it runs oldest first; a
 * revert unwinds it, so it runs newest first.
 */

export type CommitApplyMode = 'pick' | 'revert';

/** The selection (list order, newest first) in the order the host applies it. */
export function commitApplyOrder(shas: readonly string[], mode: CommitApplyMode): string[] {
  return mode === 'pick' ? [...shas].reverse() : [...shas];
}

/** The short form a toast names a commit by. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
