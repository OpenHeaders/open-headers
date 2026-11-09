/**
 * Patch read of the log's commit menu (Create Patch…): the selected
 * commits as ONE mailbox-format text — `git format-patch -1 --stdout`
 * per commit, concatenated in the caller's order (the order `git am`
 * applies them in). A pure read: nothing is written to the repo or the
 * work tree, the caller decides where the text goes. Same discipline
 * as `branch-ops.ts`: explicit repo addressing, the injected
 * {@link GitRunner} seam, full shas only (never a revision expression),
 * typed failures with git's own stderr.
 */

import type { GitRunner } from './git-exec';
import { failureDetail, isCommitSha, repoArgs, resolveRefSha } from './repo';

/** The most commits one patch read covers. */
export const COMMIT_PATCH_MAX_COMMITS = 100;

/** Byte cap on the patch text — it rides one wire frame. */
export const COMMIT_PATCH_MAX_BYTES = 2 * 1_048_576;

export type CommitPatchResult =
  | { ok: true; patch: string }
  | { ok: false; reason: 'unknown-commit' | 'empty' | 'too-large' | 'patch-failed'; detail?: string };

/** True when the commit has two or more parents. */
async function isMergeCommit(run: GitRunner, rootDir: string, sha: string): Promise<boolean> {
  const result = await run([...repoArgs(rootDir), 'rev-list', '--parents', '-n', '1', sha], { cwd: rootDir });
  return result.code === 0 && result.stdout.trim().split(/\s+/).length > 2;
}

/**
 * The patch text of `shas`, in the order given. A merge has no patch
 * of its own and contributes nothing — it is skipped HERE, because
 * `format-patch -1 <merge>` would answer the nearest plain commit
 * behind it instead. A read that ends with no text at all answers
 * `empty`.
 */
export async function readCommitPatch(
  run: GitRunner,
  rootDir: string,
  shas: readonly string[],
  maxBytes: number = COMMIT_PATCH_MAX_BYTES,
): Promise<CommitPatchResult> {
  if (shas.length === 0 || shas.length > COMMIT_PATCH_MAX_COMMITS) return { ok: false, reason: 'unknown-commit' };
  for (const sha of shas) {
    if (!isCommitSha(sha) || (await resolveRefSha(run, rootDir, sha)) === null) {
      return { ok: false, reason: 'unknown-commit', detail: sha };
    }
  }
  let patch = '';
  let bytes = 0;
  for (const sha of shas) {
    if (await isMergeCommit(run, rootDir, sha)) continue;
    const result = await run([...repoArgs(rootDir), 'format-patch', '-1', '--stdout', sha], { cwd: rootDir });
    if (result.code !== 0) return { ok: false, reason: 'patch-failed', detail: failureDetail(result) };
    bytes += Buffer.byteLength(result.stdout, 'utf8');
    if (bytes > maxBytes) return { ok: false, reason: 'too-large' };
    patch += result.stdout;
  }
  if (patch.length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, patch };
}
