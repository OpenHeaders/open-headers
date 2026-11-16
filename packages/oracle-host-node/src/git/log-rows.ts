/**
 * Commits read by their hashes — a stretch of a log's rows, a
 * selection's commits. The hashes are named one by one and not walked
 * from, so a stretch deep in a history costs what one at its top does.
 *
 * Two reads. WITH their changed paths a stretch is one `git log`: a
 * process, and a diff per commit. WITHOUT them it is read off the
 * commits' own objects through the repo's kept-open batch
 * (`object-batch.ts`, `commit-object.ts`) — no process and no diff, so a
 * list drawn under a moving scrollbar is answered within a frame. A
 * commit that read does not give exactly as git prints it sends its
 * stretch to git itself.
 */

import { parseCommitObject } from './commit-object';
import type { GitRunner } from './git-exec';
import type { GitObjectBatch } from './object-batch';
import { type CommitLogEntry, type CommitLogHead, isCommitSha, LOG_FORMAT, parseCommitLog } from './repo';
import { repoArgs } from './repo-args';

/**
 * The commits in full, in the order given — full hashes only; `files`
 * asks git for each one's changed paths (left empty without it). Null
 * when git cannot read them.
 */
export async function listCommitsBySha(
  run: GitRunner,
  rootDir: string,
  shas: readonly string[],
  files: boolean,
): Promise<CommitLogEntry[] | null> {
  if (shas.length === 0) return [];
  if (!shas.every(isCommitSha)) return null;
  const result = await run(
    [
      ...repoArgs(rootDir),
      'log',
      '--no-walk=unsorted',
      '-z',
      ...(files ? ['--name-status', '-M'] : []),
      `--format=${LOG_FORMAT}`,
      ...shas,
      '--',
    ],
    { cwd: rootDir },
  );
  return result.code !== 0 ? null : parseCommitLog(result.stdout);
}

/** A commit of a `git log` read without its (unread, empty) changed paths. */
function headOf({ files: _unread, ...head }: CommitLogEntry): CommitLogHead {
  return head;
}

/**
 * The commits without their changed paths, in the order given — full
 * hashes only — read through `batch`. Null when the repo holds no
 * commit under one of them, or git cannot read them.
 */
export async function readCommitHeads(
  batch: GitObjectBatch,
  run: GitRunner,
  rootDir: string,
  shas: readonly string[],
): Promise<CommitLogHead[] | null> {
  if (shas.length === 0) return [];
  if (!shas.every(isCommitSha)) return null;
  const objects = await batch.readCommits(shas);
  if (objects !== null) {
    const heads: CommitLogHead[] = [];
    for (const [at, bytes] of objects.entries()) {
      if (bytes === null) return null;
      const head = parseCommitObject(shas[at], bytes);
      if (head === null) break;
      heads.push(head);
    }
    if (heads.length === shas.length) return heads;
  }
  // The batch did not answer, or holds a commit only git reads exactly: git itself, one process.
  return (await listCommitsBySha(run, rootDir, shas, false))?.map(headOf) ?? null;
}
