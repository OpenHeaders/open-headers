/**
 * Where a repo's refs and its checked-out commit point — what a reading
 * of its history stands on. A history is read again only when one of
 * them has moved: a new commit, a branch made or deleted, a tag, a
 * fetch that brought something, a checkout.
 */

import { currentBranch, type GitRunner, listRepoRefs, localHeadSha, type RepoRef } from '../../git';

export interface HistoryTips {
  refs: RepoRef[];
  /** The checked-out commit; null while there is none (an unborn branch). */
  headSha: string | null;
  /** The checked-out branch; null on a detached HEAD. */
  branch: string | null;
}

/** Null when the refs cannot be read. */
export async function readHistoryTips(run: GitRunner, rootDir: string): Promise<HistoryTips | null> {
  const refs = await listRepoRefs(run, rootDir);
  if (refs === null) return null;
  return { refs, headSha: await localHeadSha(run, rootDir), branch: await currentBranch(run, rootDir) };
}

function written(tips: HistoryTips): string {
  return [...tips.refs.map((ref) => `${ref.kind} ${ref.name} ${ref.sha}`), tips.headSha ?? '', tips.branch ?? ''].join(
    '\n',
  );
}

export function sameTips(a: HistoryTips, b: HistoryTips): boolean {
  return written(a) === written(b);
}
