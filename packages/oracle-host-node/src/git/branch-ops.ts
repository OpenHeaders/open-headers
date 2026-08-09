/**
 * Branch operations of the IDE-log activity bar (GIT_PLAN.md §9):
 * create-from, safe delete, per-branch upstream update, the explicit
 * all-remotes fetch, and the compare-with-current range read. Same
 * discipline as `repo.ts`: explicit repo addressing, the injected
 * {@link GitRunner} seam, caller-validated ref shapes re-checked here
 * as defense in depth, typed failures with git's own stderr.
 */

import type { GitExecResult, GitRunner } from './git-exec';
import {
  type CommitLogEntry,
  failureDetail,
  isCommitSha,
  isSafeRefName,
  LOG_FORMAT,
  parseCommitLog,
  repoArgs,
  resolveRefSha,
} from './repo';

export type BranchDeleteResult = { ok: true; sha: string } | { ok: false; detail: string };

/**
 * Safe local-branch delete (`git branch -d` — git itself refuses
 * unmerged work; force delete is deliberately not offered). The
 * pre-delete sha rides the answer so the surface can offer Restore
 * (a plain create-from-sha, never a history edit).
 */
export async function deleteLocalBranch(run: GitRunner, rootDir: string, branch: string): Promise<BranchDeleteResult> {
  if (!isSafeRefName(branch)) return { ok: false, detail: `invalid branch name: ${branch}` };
  const sha = await resolveRefSha(run, rootDir, `refs/heads/${branch}`);
  if (sha === null) return { ok: false, detail: `unknown branch: ${branch}` };
  const result = await run([...repoArgs(rootDir), 'branch', '-d', branch], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true, sha };
}

export type BranchCreateResult = { ok: true } | { ok: false; detail: string };

export interface CreateLocalBranchOptions {
  /** Start point (validated ref name or full sha); absent anchors at HEAD. */
  from?: string;
  /** Check the new branch out (`checkout -b/-B`) — dirty work rides along. */
  checkout: boolean;
  /** Reset an existing branch to the start point (`-B` / `branch -f`). */
  overwrite: boolean;
}

/**
 * Create a local branch at a start point — the New Branch dialog's
 * plumbing. `checkout` keeps the historic `checkout -b` gesture;
 * without it only the ref is minted (`git branch`), the working tree
 * untouched (the delete-toast Restore path).
 */
export async function createLocalBranch(
  run: GitRunner,
  rootDir: string,
  branch: string,
  options: CreateLocalBranchOptions,
): Promise<BranchCreateResult> {
  const valid = await run(['check-ref-format', '--branch', branch], { cwd: rootDir });
  if (valid.code !== 0) return { ok: false, detail: `invalid branch name: ${branch}` };
  const from = options.from !== undefined ? [options.from] : [];
  const result = options.checkout
    ? await run([...repoArgs(rootDir), 'checkout', options.overwrite ? '-B' : '-b', branch, ...from], { cwd: rootDir })
    : await run([...repoArgs(rootDir), 'branch', ...(options.overwrite ? ['-f'] : []), branch, ...from], {
        cwd: rootDir,
      });
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true };
}

export type BranchUpdateResult = { ok: true } | { ok: false; reason: 'no-upstream' | 'update-failed'; detail?: string };

async function branchConfig(run: GitRunner, rootDir: string, key: string): Promise<string | null> {
  const result: GitExecResult = await run([...repoArgs(rootDir), 'config', '--get', key], { cwd: rootDir });
  const value = result.stdout.trim();
  return result.code === 0 && value.length > 0 ? value : null;
}

/**
 * Update Selected (IDE-log): fast-forward a NON-current local branch
 * from its configured upstream without touching the working tree —
 * `git fetch <remote> <src>:<branch> --prune`, the exact IDE gesture.
 * Git itself refuses a non-fast-forward move (no `+` refspec) and
 * refuses to fetch into the checked-out branch — the runtime routes
 * the current branch to the pull gesture instead.
 */
export async function updateBranchFromUpstream(
  run: GitRunner,
  rootDir: string,
  branch: string,
): Promise<BranchUpdateResult> {
  if (!isSafeRefName(branch)) return { ok: false, reason: 'update-failed', detail: `invalid branch name: ${branch}` };
  const remote = await branchConfig(run, rootDir, `branch.${branch}.remote`);
  const mergeRef = await branchConfig(run, rootDir, `branch.${branch}.merge`);
  if (remote === null || mergeRef === null) return { ok: false, reason: 'no-upstream' };
  const src = mergeRef.startsWith('refs/heads/') ? mergeRef.slice('refs/heads/'.length) : mergeRef;
  const result = await run([...repoArgs(rootDir), 'fetch', remote, `${src}:${branch}`, '--prune'], {
    cwd: rootDir,
    timeoutMs: 120_000,
  });
  if (result.code !== 0) return { ok: false, reason: 'update-failed', detail: failureDetail(result) };
  return { ok: true };
}

export type FetchAllRemotesResult = { ok: true } | { ok: false; reason: 'no-remote' | 'fetch-failed'; detail?: string };

/**
 * The explicit Fetch gesture — every remote, pruned, non-mutating for
 * the working tree (§3.2). `GIT_TERMINAL_PROMPT=0` in the exec seam
 * turns credential prompts into fast failures the caller surfaces.
 */
export async function fetchAllRemotes(run: GitRunner, rootDir: string): Promise<FetchAllRemotesResult> {
  const remotes = await run([...repoArgs(rootDir), 'remote'], { cwd: rootDir });
  const names = remotes.stdout.split('\n').filter((line) => line.trim().length > 0);
  if (remotes.code !== 0 || names.length === 0) return { ok: false, reason: 'no-remote' };
  const result = await run([...repoArgs(rootDir), 'fetch', '--all', '--prune', '--quiet'], {
    cwd: rootDir,
    timeoutMs: 120_000,
  });
  if (result.code !== 0) return { ok: false, reason: 'fetch-failed', detail: failureDetail(result) };
  return { ok: true };
}

/**
 * Commits reachable from `includeRef` but not `excludeRef` — one half
 * of the Compare-with-Current answer. Both endpoints must be validated
 * shapes (ref name or full sha); the `..` range is composed HERE, so a
 * caller-supplied revision expression can never reach git.
 */
export async function listCommitRangeLog(
  run: GitRunner,
  rootDir: string,
  excludeRef: string,
  includeRef: string,
  limit: number,
): Promise<CommitLogEntry[] | null> {
  const validShape = (ref: string): boolean => isSafeRefName(ref) || isCommitSha(ref);
  if (!validShape(excludeRef) || !validShape(includeRef)) return null;
  const result = await run(
    [
      ...repoArgs(rootDir),
      'log',
      '-z',
      '--name-status',
      '-M',
      '-n',
      String(limit),
      `--format=${LOG_FORMAT}`,
      `${excludeRef}..${includeRef}`,
      '--',
    ],
    { cwd: rootDir },
  );
  if (result.code !== 0) return null;
  return parseCommitLog(result.stdout);
}
