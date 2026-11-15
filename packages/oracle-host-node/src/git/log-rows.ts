/**
 * Commits read in full by their hashes — a stretch of a log's rows, a
 * search's page. The hashes are named one by one and not walked from,
 * so a stretch deep in a history costs what one at its top does.
 */

import type { GitRunner } from './git-exec';
import { type CommitLogEntry, isCommitSha, LOG_FORMAT, parseCommitLog } from './repo';
import { repoArgs } from './repo-args';

/** The commits in full, in the order given — full hashes only. Null when git cannot read them. */
export async function listCommitsBySha(
  run: GitRunner,
  rootDir: string,
  shas: readonly string[],
): Promise<CommitLogEntry[] | null> {
  if (shas.length === 0) return [];
  if (!shas.every(isCommitSha)) return null;
  const result = await run(
    [
      ...repoArgs(rootDir),
      'log',
      '--no-walk=unsorted',
      '-z',
      '--name-status',
      '-M',
      `--format=${LOG_FORMAT}`,
      ...shas,
      '--',
    ],
    { cwd: rootDir },
  );
  return result.code !== 0 ? null : parseCommitLog(result.stdout);
}
