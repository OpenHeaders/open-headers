/**
 * Workspace repo plumbing — init/adopt, commit identity, temp-index
 * commits, and the porcelain dirty feed (GIT_PLAN.md §3.3 bill of
 * rights + §10 Phase 3).
 *
 * Discipline this module owes the git user:
 *
 *   - engine commits are REAL `git commit`s through a temporary
 *     `GIT_INDEX_FILE` — repo-local hooks and commit signing run
 *     exactly as configured, and the user's own staging area is never
 *     read or written;
 *   - a failing hook blocks the commit and its output is surfaced;
 *     `--no-verify` is passed only when the caller's explicit setting
 *     says so;
 *   - no-op trees never produce empty commits;
 *   - identity resolution prefers the user's own `git config`
 *     (repo-local then global — real commits under their real
 *     identity, signing keys match); the synthetic identity fills only
 *     the holes, per-commit via GIT_AUTHOR / GIT_COMMITTER env pairs,
 *     and the engine NEVER writes git config (S5 §11.3 decision);
 *   - dirty state derives from `git status --porcelain -z`, never an
 *     app-side ledger.
 *
 * Every invocation addresses the repo explicitly (`--git-dir` +
 * `--work-tree`, §7) and rides the injected {@link GitRunner} seam.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { GitExecResult, GitRunner } from './git-exec';

/** Explicit repo addressing prefix for every command (GIT_PLAN.md §7). */
function repoArgs(rootDir: string): string[] {
  return ['--git-dir', path.join(rootDir, '.git'), '--work-tree', rootDir];
}

function failureDetail(result: GitExecResult): string {
  const parts = [result.stderr.trim(), result.stdout.trim()].filter((part) => part.length > 0);
  return parts.join('\n') || `git exited with code ${result.code}`;
}

// ── Repo presence + init/adopt ───────────────────────────────────────

export async function isWorkspaceRepo(run: GitRunner, rootDir: string): Promise<boolean> {
  const result = await run([...repoArgs(rootDir), 'rev-parse', '--git-dir'], { cwd: rootDir });
  return result.code === 0;
}

export type EnsureWorkspaceRepoResult =
  | { ok: true; initialized: boolean }
  | { ok: false; reason: 'init-failed'; detail: string };

/**
 * Make the bound folder a repo: adopt an existing `.git` untouched, or
 * `git init` a fresh one (bind has already authored `.gitignore` +
 * `.gitattributes`, so the first commit can never take secrets or
 * CRLF-mangled bytes).
 */
export async function ensureWorkspaceRepo(run: GitRunner, rootDir: string): Promise<EnsureWorkspaceRepoResult> {
  if (await isWorkspaceRepo(run, rootDir)) return { ok: true, initialized: false };
  const init = await run(['init', rootDir], { cwd: rootDir });
  if (init.code !== 0) return { ok: false, reason: 'init-failed', detail: failureDetail(init) };
  return { ok: true, initialized: true };
}

// ── Commit identity (§11.3: git config first, synthetic fallback) ────

export interface SyntheticCommitIdentity {
  /** Display name of the synthetic identity row (OS username). */
  name: string;
  /** Best-effort OS-derived email; null mints the noreply form. */
  email: string | null;
}

export interface ResolvedCommitIdentity {
  /**
   * Env entries for the commit invocation — empty when the user's own
   * git config fully resolves (git then stamps identity itself, and
   * repo-local overrides keep winning naturally).
   */
  env: Record<string, string>;
  /** True when any component fell back to the synthetic identity. */
  synthetic: boolean;
}

function syntheticEmail(identity: SyntheticCommitIdentity): string {
  if (identity.email !== null && identity.email.length > 0) return identity.email;
  const slug =
    identity.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'openheaders';
  return `${slug}@users.noreply.openheaders.io`;
}

async function configValue(run: GitRunner, rootDir: string, key: string): Promise<string | null> {
  const result = await run([...repoArgs(rootDir), 'config', '--get', key], { cwd: rootDir });
  const value = result.stdout.trim();
  return result.code === 0 && value.length > 0 ? value : null;
}

/**
 * Resolve what identity the next engine commit runs under. Only the
 * missing halves are supplied via env — a configured `user.name` with
 * no `user.email` keeps the user's name and fills only the email.
 */
export async function resolveCommitIdentity(
  run: GitRunner,
  rootDir: string,
  fallback: SyntheticCommitIdentity,
): Promise<ResolvedCommitIdentity> {
  const configuredName = await configValue(run, rootDir, 'user.name');
  const configuredEmail = await configValue(run, rootDir, 'user.email');
  const env: Record<string, string> = {};
  if (configuredName === null) {
    const name = fallback.name.length > 0 ? fallback.name : 'OpenHeaders';
    env.GIT_AUTHOR_NAME = name;
    env.GIT_COMMITTER_NAME = name;
  }
  if (configuredEmail === null) {
    const email = syntheticEmail(fallback);
    env.GIT_AUTHOR_EMAIL = email;
    env.GIT_COMMITTER_EMAIL = email;
  }
  return { env, synthetic: Object.keys(env).length > 0 };
}

// ── Status feeds (§3.3: git itself is the ledger) ────────────────────

/**
 * True when the USER's real staging area holds anything — the
 * auto-commit pause condition (§3.3: someone mid-`git add -p` is never
 * swept). Uses the real index, unlike every commit path below.
 */
export async function userIndexHasStagedChanges(run: GitRunner, rootDir: string): Promise<boolean> {
  const result = await run([...repoArgs(rootDir), 'diff', '--cached', '--quiet'], { cwd: rootDir });
  return result.code === 1;
}

/** Count entries in `git status --porcelain -z` (rename records carry a second path token — skipped). */
export function parsePorcelainCount(stdout: string): number {
  const tokens = stdout.split('\0').filter((token) => token.length > 0);
  let count = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    count += 1;
    const x = token[0];
    const y = token[1];
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') i += 1;
  }
  return count;
}

/** "N uncommitted" for the status feed — straight from porcelain. */
export async function countDirtyFiles(run: GitRunner, rootDir: string): Promise<number | null> {
  const result = await run([...repoArgs(rootDir), 'status', '--porcelain', '-z'], { cwd: rootDir });
  if (result.code !== 0) return null;
  return parsePorcelainCount(result.stdout);
}

// ── Temp-index commit (§3.3 / §23.4) ─────────────────────────────────

export interface CommitWorkspaceTreeOptions {
  run: GitRunner;
  rootDir: string;
  message: string;
  /** Env from {@link resolveCommitIdentity} — merged into the commit invocation. */
  identityEnv: Record<string, string>;
  /** The explicit user setting behind `--no-verify`; default false. */
  bypassHooks?: boolean;
}

export type CommitWorkspaceTreeResult =
  | { ok: true; committed: false }
  | { ok: true; committed: true; sha: string }
  | { ok: false; reason: 'not-a-repo' | 'stage-failed' | 'commit-failed'; detail: string };

/**
 * One engine commit of the working tree's current bytes, through a
 * throwaway index in the system tmpdir — OUTSIDE the work tree, so the
 * index file itself can never be swept into a commit even on a repo
 * whose `.gitignore` went missing. `git add -A` inside that index
 * respects `.gitignore` (secrets and the sidecar can never be staged),
 * hooks and signing run on `git commit` exactly as configured, and the
 * user's real index never participates.
 */
export async function commitWorkspaceTree(options: CommitWorkspaceTreeOptions): Promise<CommitWorkspaceTreeResult> {
  const { run, rootDir, message } = options;
  if (!(await isWorkspaceRepo(run, rootDir))) {
    return { ok: false, reason: 'not-a-repo', detail: `${rootDir} is not a git repository` };
  }

  const indexDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-commit-index-'));
  const indexPath = path.join(indexDir, 'index');
  const indexEnv = { GIT_INDEX_FILE: indexPath };
  try {
    const headProbe = await run([...repoArgs(rootDir), 'rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: rootDir });
    const hasHead = headProbe.code === 0;

    // Snapshot what the USER has staged in the real index before the
    // commit moves HEAD — these paths are theirs and the post-commit
    // index refresh below must leave them exactly as found. On an
    // unborn HEAD anything in the index is a staged entry.
    const stagedProbe = hasHead
      ? await run([...repoArgs(rootDir), 'diff', '--cached', '--name-only'], { cwd: rootDir })
      : await run([...repoArgs(rootDir), 'ls-files'], { cwd: rootDir });
    const userStagedPaths = new Set(stagedProbe.stdout.split('\n').filter((line) => line.length > 0));

    const seed = await run([...repoArgs(rootDir), 'read-tree', ...(hasHead ? ['HEAD'] : ['--empty'])], {
      cwd: rootDir,
      env: indexEnv,
    });
    if (seed.code !== 0) return { ok: false, reason: 'stage-failed', detail: failureDetail(seed) };

    const stage = await run([...repoArgs(rootDir), 'add', '-A', '--', '.'], { cwd: rootDir, env: indexEnv });
    if (stage.code !== 0) return { ok: false, reason: 'stage-failed', detail: failureDetail(stage) };

    const diff = await run([...repoArgs(rootDir), 'diff', '--cached', '--quiet'], { cwd: rootDir, env: indexEnv });
    if (diff.code === 0) return { ok: true, committed: false };

    const commit = await run(
      [...repoArgs(rootDir), 'commit', '-m', message, ...(options.bypassHooks === true ? ['--no-verify'] : [])],
      { cwd: rootDir, env: { ...indexEnv, ...options.identityEnv } },
    );
    if (commit.code !== 0) return { ok: false, reason: 'commit-failed', detail: failureDetail(commit) };

    const sha = await run([...repoArgs(rootDir), 'rev-parse', 'HEAD'], { cwd: rootDir });
    const commitSha = sha.code === 0 ? sha.stdout.trim() : '';

    // Keep the repo NORMAL after a temp-index commit: git's own commit
    // would have left index == HEAD, so ours must too — otherwise the
    // user's next `git status` shows phantom staged deletions for every
    // file this commit touched. Paths the user had staged stay exactly
    // as found (a mid-`git add -p` partial staging survives, §3.3);
    // everything else the commit changed is refreshed from HEAD.
    if (userStagedPaths.size === 0) {
      await run([...repoArgs(rootDir), 'read-tree', 'HEAD'], { cwd: rootDir });
    } else if (commitSha.length > 0) {
      const changed = await run(
        [...repoArgs(rootDir), 'diff-tree', '--no-commit-id', '--name-only', '-r', '--root', commitSha],
        { cwd: rootDir },
      );
      const toRefresh = changed.stdout.split('\n').filter((line) => line.length > 0 && !userStagedPaths.has(line));
      if (toRefresh.length > 0) {
        await run([...repoArgs(rootDir), 'reset', '-q', 'HEAD', '--', ...toRefresh], { cwd: rootDir });
      }
    }

    return { ok: true, committed: true, sha: commitSha };
  } finally {
    await fs.rm(indexDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
