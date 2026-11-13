/**
 * A commit's change read against EACH of its parents — what a merge's
 * files are. `git log` lists none for a merge (its default compares no
 * parent), so the log's own listing is empty there; this read answers,
 * per parent in `%P` order, the parent's subject and the files the
 * commit holds differently from it, and — for a merge — the files that
 * differ from EVERY parent (git's combined listing: what the merge
 * itself had to settle). A pure read with the same discipline as
 * `patch-ops.ts`: explicit repo addressing, the injected
 * {@link GitRunner} seam, a full sha only.
 */

import type { GitRunner } from './git-exec';
import { type CommitLogFileChange, commitParents, isCommitSha, parseNameStatus, repoArgs } from './repo';

export interface CommitParentChange {
  sha: string;
  subject: string;
  /** What the commit holds differently from this parent; a rename reports where the file lives now. */
  files: CommitLogFileChange[];
}

export interface CommitParentChanges {
  /** One per parent, first parent first; none for the root commit. */
  parents: CommitParentChange[];
  /** A merge's files that differ from every parent; empty for any other commit. */
  merged: CommitLogFileChange[];
}

async function subjectOf(run: GitRunner, rootDir: string, sha: string): Promise<string | null> {
  const shown = await run([...repoArgs(rootDir), 'show', '-s', '--format=%s', sha, '--'], { cwd: rootDir });
  return shown.code === 0 ? shown.stdout.replace(/\n$/, '') : null;
}

/**
 * The combined listing's records: one status letter PER PARENT, then the
 * path. Read as one change: added or deleted when every parent says so,
 * modified otherwise.
 */
export function parseCombinedNameStatus(stdout: string): CommitLogFileChange[] {
  const tokens = stdout.split('\0');
  const files: CommitLogFileChange[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const letters = tokens[i].replace(/^\n/, '');
    const filePath = tokens[i + 1];
    if (!/^[A-Z]{2,}$/.test(letters) || filePath.length === 0) continue;
    const status =
      [...letters].every((letter) => letter === letters[0]) && 'AD'.includes(letters[0]) ? letters[0] : 'M';
    files.push({ status, path: filePath });
  }
  return files;
}

/** Null when the repo does not hold the commit or a read of it fails. */
export async function readCommitParentChanges(
  run: GitRunner,
  rootDir: string,
  sha: string,
): Promise<CommitParentChanges | null> {
  if (!isCommitSha(sha)) return null;
  const parentShas = await commitParents(run, rootDir, sha);
  if (parentShas === null) return null;
  const parents: CommitParentChange[] = [];
  for (const parent of parentShas) {
    const subject = await subjectOf(run, rootDir, parent);
    const diff = await run([...repoArgs(rootDir), 'diff-tree', '-r', '-z', '-M', '--name-status', parent, sha], {
      cwd: rootDir,
    });
    if (subject === null || diff.code !== 0) return null;
    parents.push({ sha: parent, subject, files: parseNameStatus(diff.stdout.split('\0')) });
  }
  if (parentShas.length < 2) return { parents, merged: [] };
  const combined = await run(
    [...repoArgs(rootDir), 'diff-tree', '-c', '-r', '-z', '--no-commit-id', '--name-status', sha],
    { cwd: rootDir },
  );
  if (combined.code !== 0) return null;
  return { parents, merged: parseCombinedNameStatus(combined.stdout) };
}
