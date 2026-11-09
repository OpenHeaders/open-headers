/**
 * Tag operations of the log's commit menu (New Tag…): a lightweight
 * tag minted at a commit — `git tag <name> <sha>`, never a history
 * edit, and tags never ride a push (the §8 law). Same discipline as
 * `branch-ops.ts`: explicit repo addressing, the injected
 * {@link GitRunner} seam, caller-validated shapes re-checked here as
 * defense in depth, typed failures with git's own stderr.
 */

import type { GitRunner } from './git-exec';
import { failureDetail, isCommitSha, isSafeRefName, repoArgs, resolveRefSha } from './repo';

export type TagCreateResult = { ok: true; sha: string } | { ok: false; detail: string };

/** Mint a lightweight tag `name` at the full commit `sha`; an existing name refuses through git's own guard. */
export async function createLightweightTag(
  run: GitRunner,
  rootDir: string,
  name: string,
  sha: string,
): Promise<TagCreateResult> {
  if (!isSafeRefName(name)) return { ok: false, detail: `invalid tag name: ${name}` };
  if (!isCommitSha(sha)) return { ok: false, detail: `invalid commit: ${sha}` };
  const valid = await run(['check-ref-format', `refs/tags/${name}`], { cwd: rootDir });
  if (valid.code !== 0) return { ok: false, detail: `invalid tag name: ${name}` };
  const target = await resolveRefSha(run, rootDir, sha);
  if (target === null) return { ok: false, detail: `unknown commit: ${sha}` };
  const result = await run([...repoArgs(rootDir), 'tag', name, sha], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true, sha: target };
}
