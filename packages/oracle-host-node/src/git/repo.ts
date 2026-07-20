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
import type { TreeFile } from '@openheaders/core/workspace-tree';
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

/** One contributing user's git-author identity (§23.6 attribution). */
export interface CommitUserAttribution {
  name: string;
  email: string;
}

/**
 * §23.6 authorship for a commit carrying other users' work: a single
 * contributing user becomes the commit AUTHOR (the committer stays
 * whatever {@link resolveCommitIdentity} settled — the operator);
 * several contributors keep the operator author and ride as
 * `Co-Authored-By:` trailers, the same convention the merge path uses
 * for foreign commits. No contributors → the env and message pass
 * through untouched.
 */
export function withCommitAttribution(
  identityEnv: Record<string, string>,
  message: string,
  contributors: readonly CommitUserAttribution[],
): { env: Record<string, string>; message: string } {
  if (contributors.length === 0) return { env: identityEnv, message };
  if (contributors.length === 1) {
    const author = contributors[0];
    return {
      env: { ...identityEnv, GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email },
      message,
    };
  }
  const trailers: string[] = [];
  for (const contributor of contributors) {
    const line = `Co-Authored-By: ${contributor.name} <${contributor.email}>`;
    if (!trailers.includes(line)) trailers.push(line);
  }
  return { env: identityEnv, message: `${message}\n\n${trailers.join('\n')}` };
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

// ── In-progress-op detection (§3.3: mid-op trees are never ingested) ─

/**
 * Markers of a git operation the user is mid-way through. While any of
 * these exists, watcher sweeps and pull passes hold reconcile — a
 * mid-rebase tree with conflict markers must never enter the engine.
 */
const IN_PROGRESS_MARKERS = ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'BISECT_LOG'] as const;

/** The first in-progress marker present in `.git/`, or null when the repo is at rest. */
export async function gitOperationInProgress(rootDir: string): Promise<string | null> {
  for (const marker of IN_PROGRESS_MARKERS) {
    try {
      await fs.access(path.join(rootDir, '.git', marker));
      return marker;
    } catch {
      // marker absent — keep probing
    }
  }
  return null;
}

// ── Remote feeds (Phase 4: fetch always non-mutating, §3.2) ──────────

export interface UpstreamState {
  /** Remote-tracking ref name, e.g. `origin/main`. */
  upstream: string;
  /** Resolved sha of the remote-tracking ref. */
  sha: string;
  /** Local commits the upstream lacks. */
  ahead: number;
  /** Upstream commits the local branch lacks. */
  behind: number;
}

/**
 * The current branch's upstream + ahead/behind counts — pure local
 * reads against the remote-tracking ref (no network). Null when no
 * upstream is configured (or HEAD is unborn/detached).
 */
export async function resolveUpstream(run: GitRunner, rootDir: string): Promise<UpstreamState | null> {
  const name = await run([...repoArgs(rootDir), 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
    cwd: rootDir,
  });
  const upstream = name.stdout.trim();
  if (name.code !== 0 || upstream.length === 0) return null;
  const sha = await run([...repoArgs(rootDir), 'rev-parse', '@{u}'], { cwd: rootDir });
  if (sha.code !== 0) return null;
  const counts = await run([...repoArgs(rootDir), 'rev-list', '--left-right', '--count', 'HEAD...@{u}'], {
    cwd: rootDir,
  });
  if (counts.code !== 0) return null;
  const match = counts.stdout.trim().match(/^(\d+)\s+(\d+)$/);
  if (!match) return null;
  return { upstream, sha: sha.stdout.trim(), ahead: Number(match[1]), behind: Number(match[2]) };
}

export type FetchWorkspaceRemoteResult = { ok: true } | { ok: false; detail: string };

/**
 * `git fetch` against the branch's default remote. Non-mutating for
 * the working tree/engine; `GIT_TERMINAL_PROMPT=0` turns would-be
 * credential prompts into fast failures the caller surfaces.
 */
export async function fetchWorkspaceRemote(run: GitRunner, rootDir: string): Promise<FetchWorkspaceRemoteResult> {
  const result = await run([...repoArgs(rootDir), 'fetch', '--quiet'], { cwd: rootDir, timeoutMs: 120_000 });
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true };
}

/** Merge base of two refs; null when the histories are unrelated. */
export async function mergeBaseOf(run: GitRunner, rootDir: string, a: string, b: string): Promise<string | null> {
  const result = await run([...repoArgs(rootDir), 'merge-base', a, b], { cwd: rootDir });
  const sha = result.stdout.trim();
  return result.code === 0 && sha.length > 0 ? sha : null;
}

export interface ForeignTreeDiff {
  /** Paths added or modified on the foreign side relative to the base. */
  changed: Set<string>;
  /** Paths the foreign side deleted relative to the base. */
  removed: Set<string>;
}

/**
 * The foreign side's file-level delta against the merge base — the
 * changed/removed classification `synthesizeWorkspaceTreeDelta` runs
 * on (three-way discipline: only what the FOREIGN history touched is
 * tree-authored; everything else stays engine-owned). A null base
 * (unrelated histories / first pull) classifies every foreign file as
 * changed and nothing as removed.
 */
export async function diffForeignPaths(
  run: GitRunner,
  rootDir: string,
  baseRef: string | null,
  foreignRef: string,
): Promise<ForeignTreeDiff | null> {
  const changed = new Set<string>();
  const removed = new Set<string>();
  if (baseRef === null) {
    const listing = await run([...repoArgs(rootDir), 'ls-tree', '-r', '-z', '--name-only', foreignRef], {
      cwd: rootDir,
    });
    if (listing.code !== 0) return null;
    for (const entry of listing.stdout.split('\0')) {
      if (entry.length > 0) changed.add(entry);
    }
    return { changed, removed };
  }
  const diff = await run(
    [...repoArgs(rootDir), 'diff-tree', '-r', '-z', '--no-renames', '--name-status', baseRef, foreignRef],
    { cwd: rootDir },
  );
  if (diff.code !== 0) return null;
  const tokens = diff.stdout.split('\0');
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const status = tokens[i];
    const filePath = tokens[i + 1];
    if (status.length === 0 || filePath.length === 0) continue;
    if (status[0] === 'D') removed.add(filePath);
    else changed.add(filePath);
  }
  return { changed, removed };
}

/**
 * A commit's tree as the string-in file listing `readWorkspaceTree`
 * consumes — the foreign checkout snapshot of the §11.4 pull path.
 * Only `.yaml` files are read (the reader classifies by manifest
 * convention; the user's own files never need parsing).
 */
export async function readCommitTreeFiles(run: GitRunner, rootDir: string, ref: string): Promise<TreeFile[] | null> {
  const listing = await run([...repoArgs(rootDir), 'ls-tree', '-r', '-z', '--name-only', ref], { cwd: rootDir });
  if (listing.code !== 0) return null;
  const files: TreeFile[] = [];
  for (const entry of listing.stdout.split('\0')) {
    if (entry.length === 0 || !entry.endsWith('.yaml')) continue;
    const blob = await run([...repoArgs(rootDir), 'show', `${ref}:${entry}`], { cwd: rootDir });
    if (blob.code !== 0) return null;
    files.push({ path: entry, content: blob.stdout });
  }
  return files;
}

/**
 * Unique `Name <email>` authors of the foreign-only commits — the
 * `Co-Authored-By:` trailer feed for the merge commit (§23.6/§23.7).
 */
export async function listForeignAuthors(
  run: GitRunner,
  rootDir: string,
  localRef: string,
  foreignRef: string,
): Promise<string[]> {
  const log = await run([...repoArgs(rootDir), 'log', '--format=%an <%ae>', `${localRef}..${foreignRef}`], {
    cwd: rootDir,
  });
  if (log.code !== 0) return [];
  const seen = new Set<string>();
  const authors: string[] = [];
  for (const line of log.stdout.split('\n')) {
    const author = line.trim();
    if (author.length === 0 || seen.has(author)) continue;
    seen.add(author);
    authors.push(author);
  }
  return authors;
}

export type FastForwardResult = { ok: true } | { ok: false; detail: string };

/**
 * Move the current branch to `foreignSha` — the pull leg for a local
 * branch that has NOT diverged (plain `git pull` semantics: no merge
 * bubble), and the deliberate ref move of a §16 trichotomy resolution
 * (there the target is the rewritten remote head, ancestry or not —
 * the user chose it in the dialog). CAS on the old HEAD so a
 * concurrent move fails loudly instead of clobbering; afterwards the
 * REAL index is resynced to the new HEAD with the same §3.3
 * discipline as the temp-index commit — paths the user had staged
 * stay exactly as found.
 */
export async function fastForwardWorkspaceBranch(
  run: GitRunner,
  rootDir: string,
  foreignSha: string,
): Promise<FastForwardResult> {
  const head = await run([...repoArgs(rootDir), 'rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: rootDir });
  if (head.code !== 0) return { ok: false, detail: 'no local HEAD to fast-forward' };
  const oldHead = head.stdout.trim();

  const stagedProbe = await run([...repoArgs(rootDir), 'diff', '--cached', '--name-only'], { cwd: rootDir });
  const userStagedPaths = new Set(stagedProbe.stdout.split('\n').filter((line) => line.length > 0));

  const moved = await run([...repoArgs(rootDir), 'update-ref', 'HEAD', foreignSha, oldHead], { cwd: rootDir });
  if (moved.code !== 0) return { ok: false, detail: failureDetail(moved) };

  if (userStagedPaths.size === 0) {
    await run([...repoArgs(rootDir), 'read-tree', 'HEAD'], { cwd: rootDir });
  } else {
    const changed = await run(
      [...repoArgs(rootDir), 'diff-tree', '--no-commit-id', '--name-only', '-r', oldHead, foreignSha],
      { cwd: rootDir },
    );
    const toRefresh = changed.stdout.split('\n').filter((line) => line.length > 0 && !userStagedPaths.has(line));
    if (toRefresh.length > 0) {
      await run([...repoArgs(rootDir), 'reset', '-q', 'HEAD', '--', ...toRefresh], { cwd: rootDir });
    }
  }
  return { ok: true };
}

// ── Push + force-push safety (Phase 5: G5/G6/G11, §16 / §8.2) ────────

/** True when `ancestor` is reachable from `descendant` (`merge-base --is-ancestor`); unknown objects read as false. */
export async function isAncestorOf(
  run: GitRunner,
  rootDir: string,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  const result = await run([...repoArgs(rootDir), 'merge-base', '--is-ancestor', ancestor, descendant], {
    cwd: rootDir,
  });
  return result.code === 0;
}

/** The current HEAD sha; null on an unborn branch. */
export async function localHeadSha(run: GitRunner, rootDir: string): Promise<string | null> {
  const result = await run([...repoArgs(rootDir), 'rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: rootDir });
  const sha = result.stdout.trim();
  return result.code === 0 && sha.length > 0 ? sha : null;
}

/** All `.yaml` paths in a commit's tree — the removal side of a full-tree convergence. */
export async function listTreeYamlPaths(run: GitRunner, rootDir: string, ref: string): Promise<string[] | null> {
  const listing = await run([...repoArgs(rootDir), 'ls-tree', '-r', '-z', '--name-only', ref], { cwd: rootDir });
  if (listing.code !== 0) return null;
  return listing.stdout.split('\0').filter((entry) => entry.length > 0 && entry.endsWith('.yaml'));
}

export type PushWorkspaceBranchResult =
  | { ok: true; pushed: boolean; remoteSha: string }
  | { ok: false; reason: 'no-upstream' | 'rejected' | 'no-permission' | 'push-failed'; detail: string };

/**
 * Classify a failed push honestly (§8.2): a non-fast-forward rejection
 * gets the pull-first nudge; a permission/auth refusal gets the
 * read-only-remote affordance; everything else surfaces as-is.
 */
function classifyPushFailure(result: GitExecResult): 'rejected' | 'no-permission' | 'push-failed' {
  const text = `${result.stderr}\n${result.stdout}`;
  if (/non-fast-forward|fetch first|\[rejected\]/i.test(text)) return 'rejected';
  if (/denied|read.?only|not authorized|authenticat|authoriz|protected|declined|remote rejected|\b40[13]\b/i.test(text))
    return 'no-permission';
  return 'push-failed';
}

/**
 * Push the current branch to its upstream — the explicit Push gesture
 * (§3.2: push is a deliberate act; the runtime's auto-push toggle is
 * the only automation). With no upstream but exactly ONE remote, the
 * first push establishes tracking (`push -u <remote> HEAD`); with no
 * remote at all it refuses. Nothing to push is a clean no-op that
 * never touches the network.
 */
export async function pushWorkspaceBranch(run: GitRunner, rootDir: string): Promise<PushWorkspaceBranchResult> {
  const upstream = await resolveUpstream(run, rootDir);
  const head = await localHeadSha(run, rootDir);
  if (head === null) return { ok: false, reason: 'push-failed', detail: 'no local HEAD to push' };
  if (upstream !== null) {
    if (upstream.ahead === 0) return { ok: true, pushed: false, remoteSha: upstream.sha };
    const result = await run([...repoArgs(rootDir), 'push', '--quiet'], { cwd: rootDir, timeoutMs: 120_000 });
    if (result.code !== 0) return { ok: false, reason: classifyPushFailure(result), detail: failureDetail(result) };
    return { ok: true, pushed: true, remoteSha: head };
  }
  const remotes = await run([...repoArgs(rootDir), 'remote'], { cwd: rootDir });
  const names = remotes.stdout.split('\n').filter((line) => line.trim().length > 0);
  if (remotes.code !== 0 || names.length !== 1) {
    return { ok: false, reason: 'no-upstream', detail: 'no upstream configured' };
  }
  const result = await run([...repoArgs(rootDir), 'push', '--quiet', '-u', names[0].trim(), 'HEAD'], {
    cwd: rootDir,
    timeoutMs: 120_000,
  });
  if (result.code !== 0) return { ok: false, reason: classifyPushFailure(result), detail: failureDetail(result) };
  return { ok: true, pushed: true, remoteSha: head };
}

/**
 * Publish local HEAD as a NEW branch on the upstream's remote — the
 * §8.2 read-only-remote affordance (a write-protected base branch can
 * still receive the work as a merge request from the user's git host).
 */
export async function pushHeadToNewBranch(
  run: GitRunner,
  rootDir: string,
  branch: string,
): Promise<PushWorkspaceBranchResult> {
  const valid = await run(['check-ref-format', '--branch', branch], { cwd: rootDir });
  if (valid.code !== 0) return { ok: false, reason: 'push-failed', detail: `invalid branch name: ${branch}` };
  const head = await localHeadSha(run, rootDir);
  if (head === null) return { ok: false, reason: 'push-failed', detail: 'no local HEAD to push' };
  const upstream = await resolveUpstream(run, rootDir);
  let remote: string | null = upstream !== null ? upstream.upstream.split('/')[0] : null;
  if (remote === null) {
    const remotes = await run([...repoArgs(rootDir), 'remote'], { cwd: rootDir });
    const names = remotes.stdout.split('\n').filter((line) => line.trim().length > 0);
    remote = remotes.code === 0 && names.length === 1 ? names[0].trim() : null;
  }
  if (remote === null) return { ok: false, reason: 'no-upstream', detail: 'no remote configured' };
  const result = await run([...repoArgs(rootDir), 'push', '--quiet', remote, `HEAD:refs/heads/${branch}`], {
    cwd: rootDir,
    timeoutMs: 120_000,
  });
  if (result.code !== 0) return { ok: false, reason: classifyPushFailure(result), detail: failureDetail(result) };
  return { ok: true, pushed: true, remoteSha: head };
}

export type CreateRescueBranchResult = { ok: true } | { ok: false; detail: string };

/**
 * Preserve `sha` on a NEW local branch (§16's "Preserve on
 * `oh-rescue-<ts>`") — `update-ref` with a must-not-exist guard, so a
 * rescue is only ever a new ref, never a history edit.
 */
export async function createRescueBranch(
  run: GitRunner,
  rootDir: string,
  branch: string,
  sha: string,
): Promise<CreateRescueBranchResult> {
  const result = await run([...repoArgs(rootDir), 'update-ref', `refs/heads/${branch}`, sha, ''], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true };
}

// ── Branches (Phase 6: G3/G4, §6) ────────────────────────────────────

/**
 * The branch HEAD points at (`symbolic-ref`, so an unborn branch still
 * answers); null on a detached HEAD.
 */
export async function currentBranch(run: GitRunner, rootDir: string): Promise<string | null> {
  const result = await run([...repoArgs(rootDir), 'symbolic-ref', '--short', '-q', 'HEAD'], { cwd: rootDir });
  const name = result.stdout.trim();
  return result.code === 0 && name.length > 0 ? name : null;
}

/** Local branch names, sorted — rescue/fork branches appear here naturally. */
export async function listLocalBranches(run: GitRunner, rootDir: string): Promise<string[]> {
  const result = await run(
    [...repoArgs(rootDir), 'for-each-ref', '--format=%(refname:short)', '--sort=refname', 'refs/heads'],
    { cwd: rootDir },
  );
  if (result.code !== 0) return [];
  return result.stdout.split('\n').filter((line) => line.trim().length > 0);
}

/** Resolve any ref (branch, remote-tracking, sha) to its commit sha; null when unknown. */
export async function resolveRefSha(run: GitRunner, rootDir: string, ref: string): Promise<string | null> {
  const result = await run([...repoArgs(rootDir), 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    cwd: rootDir,
  });
  const sha = result.stdout.trim();
  return result.code === 0 && sha.length > 0 ? sha : null;
}

export interface LeftRightCounts {
  /** Commits `localRef` has that `foreignRef` lacks. */
  ahead: number;
  /** Commits `foreignRef` has that `localRef` lacks. */
  behind: number;
}

/**
 * Ahead/behind between two arbitrary refs — the branch-merge analogue
 * of {@link resolveUpstream}'s upstream counts.
 */
export async function countLeftRight(
  run: GitRunner,
  rootDir: string,
  localRef: string,
  foreignRef: string,
): Promise<LeftRightCounts | null> {
  const result = await run(
    [...repoArgs(rootDir), 'rev-list', '--left-right', '--count', `${localRef}...${foreignRef}`],
    { cwd: rootDir },
  );
  if (result.code !== 0) return null;
  const match = result.stdout.trim().match(/^(\d+)\s+(\d+)$/);
  if (!match) return null;
  return { ahead: Number(match[1]), behind: Number(match[2]) };
}

export type BranchOpResult = { ok: true } | { ok: false; detail: string };

/**
 * Create a branch at HEAD and switch to it (`checkout -b`) — the
 * create gesture. A dirty tree rides along untouched, exactly like the
 * terminal gesture, so no uncommitted-changes prompt is needed.
 */
export async function createAndSwitchBranch(run: GitRunner, rootDir: string, branch: string): Promise<BranchOpResult> {
  const valid = await run(['check-ref-format', '--branch', branch], { cwd: rootDir });
  if (valid.code !== 0) return { ok: false, detail: `invalid branch name: ${branch}` };
  const result = await run([...repoArgs(rootDir), 'checkout', '-b', branch], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true };
}

/**
 * The wrapped checkout behind the in-app switch gesture (§6.2). Plain
 * by default — git itself refuses when uncommitted work would be
 * clobbered (the caller's dirty prompt should have handled it);
 * `force` is the user's explicit Discard choice.
 */
export async function checkoutWorkspaceBranch(
  run: GitRunner,
  rootDir: string,
  branch: string,
  options?: { force?: boolean },
): Promise<BranchOpResult> {
  const result = await run(
    [...repoArgs(rootDir), 'checkout', ...(options?.force === true ? ['--force'] : []), branch],
    { cwd: rootDir },
  );
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true };
}

/**
 * Stash the working tree including untracked files — the Stash choice
 * of the §6.2 switch prompt. The entry lands on the user's ordinary
 * stash stack, recoverable with their own `git stash pop`.
 */
export async function stashWorkspaceTree(run: GitRunner, rootDir: string, message: string): Promise<BranchOpResult> {
  const result = await run([...repoArgs(rootDir), 'stash', 'push', '--include-untracked', '-m', message], {
    cwd: rootDir,
  });
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true };
}

/**
 * Remove untracked files/directories (`clean -fd`, gitignored paths —
 * the sidecar and secrets — survive). Only ever run as the second half
 * of the user's explicit Discard choice, after `checkout --force`.
 */
export async function cleanUntracked(run: GitRunner, rootDir: string): Promise<BranchOpResult> {
  const result = await run([...repoArgs(rootDir), 'clean', '-fd'], { cwd: rootDir });
  if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
  return { ok: true };
}

// ── History feeds (Phase 7: §9 history view, §7.1 audit trail) ───────

/** One changed path in a log entry; rename/copy records report the new path. */
export interface CommitLogFileChange {
  /** Porcelain status letter (`A`/`M`/`D`/`T`, `R`/`C` for rename/copy). */
  status: string;
  path: string;
}

export interface CommitLogEntry {
  sha: string;
  authorName: string;
  authorEmail: string;
  /** Author date, strict ISO-8601 (`%aI`). */
  authoredAt: string;
  subject: string;
  /** `Co-Authored-By:` trailer values (`Name <email>`) — §23.6 attribution. */
  coAuthors: string[];
  /** Changed paths; empty for a path-scoped log (the diff wasn't asked for). */
  files: CommitLogFileChange[];
}

/**
 * Record separator idiom: each commit begins `\x1e`, header fields ride
 * `\x1f`, and `-z` NUL-separates the header from the `--name-status`
 * tokens (status and path are separate tokens; renames carry old+new).
 * Trailers are parsed from `%b` app-side — the `%(trailers:…)` pretty
 * options postdate the 2.20 version floor.
 */
const LOG_FORMAT = '%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b';

const CO_AUTHOR_TRAILER = /^co-authored-by:\s*(.+)$/gim;

function parseCommitLog(stdout: string): CommitLogEntry[] {
  const entries: CommitLogEntry[] = [];
  for (const record of stdout.split('\x1e')) {
    if (record.length === 0) continue;
    const tokens = record.split('\0');
    const header = tokens[0].split('\x1f');
    if (header.length < 6) continue;
    const coAuthors: string[] = [];
    for (const match of header.slice(5).join('\x1f').matchAll(CO_AUTHOR_TRAILER)) {
      const author = match[1].trim();
      if (author.length > 0 && !coAuthors.includes(author)) coAuthors.push(author);
    }
    const files: CommitLogFileChange[] = [];
    for (let i = 1; i < tokens.length; i += 1) {
      const status = tokens[i].replace(/^\n/, '');
      if (!/^[A-Z]\d*$/.test(status)) continue;
      // Rename/copy records carry old then new — report where the file lives now.
      const pathIndex = status[0] === 'R' || status[0] === 'C' ? i + 2 : i + 1;
      const filePath = tokens[pathIndex];
      if (filePath === undefined || filePath.length === 0) continue;
      files.push({ status: status[0], path: filePath });
      i = pathIndex;
    }
    entries.push({
      sha: header[0],
      authorName: header[1],
      authorEmail: header[2],
      authoredAt: header[3],
      subject: header[4],
      coAuthors,
      files,
    });
  }
  return entries;
}

/**
 * Recent commits with their changed paths — the §9 history view's
 * workspace timeline. One invocation regardless of `limit`; an unborn
 * HEAD answers an empty list (a fresh repo has no history yet).
 */
export async function listCommitLog(run: GitRunner, rootDir: string, limit: number): Promise<CommitLogEntry[] | null> {
  if ((await localHeadSha(run, rootDir)) === null) return [];
  const result = await run(
    [...repoArgs(rootDir), 'log', '-z', '--name-status', '-M', `-n`, String(limit), `--format=${LOG_FORMAT}`],
    { cwd: rootDir },
  );
  if (result.code !== 0) return null;
  return parseCommitLog(result.stdout);
}

/**
 * A single path's timeline (`--follow`, so a §11.7 rename keeps the
 * entity's earlier history) — the blame answer: the newest entry is
 * "who last touched this". No diff is asked for; `files` stays empty.
 */
export async function listFileLog(
  run: GitRunner,
  rootDir: string,
  filePath: string,
  limit: number,
): Promise<CommitLogEntry[] | null> {
  if ((await localHeadSha(run, rootDir)) === null) return [];
  const result = await run(
    [...repoArgs(rootDir), 'log', '-z', '--follow', `-n`, String(limit), `--format=${LOG_FORMAT}`, '--', filePath],
    { cwd: rootDir },
  );
  if (result.code !== 0) return null;
  return parseCommitLog(result.stdout);
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
  /**
   * Second parent for a merge commit (§11.4: the foreign head). The
   * engine writes the converged tree; git only records the parents —
   * `MERGE_HEAD` is placed so `git commit` itself mints the two-parent
   * commit with hooks and signing running exactly as configured. An
   * unchanged tree still commits (recording the merge IS the point).
   * Only meaningful when the histories genuinely diverged: git reduces
   * redundant parents, so an un-diverged branch belongs to
   * {@link fastForwardWorkspaceBranch} instead.
   */
  mergeParent?: string;
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

  const mergeParent = options.mergeParent;
  const mergeHeadPath = path.join(rootDir, '.git', 'MERGE_HEAD');
  if (mergeParent !== undefined) {
    // Refuse to clobber a real in-progress merge — the caller's
    // in-progress-op hold should have caught this already (§3.3).
    try {
      await fs.access(mergeHeadPath);
      return { ok: false, reason: 'commit-failed', detail: 'a merge is already in progress' };
    } catch {
      // no MERGE_HEAD — ours to place
    }
  }

  const indexDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-commit-index-'));
  const indexPath = path.join(indexDir, 'index');
  const indexEnv = { GIT_INDEX_FILE: indexPath };
  let mergeHeadPlaced = false;
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
    if (diff.code === 0 && mergeParent === undefined) return { ok: true, committed: false };

    if (mergeParent !== undefined) {
      await fs.writeFile(mergeHeadPath, `${mergeParent}\n`, 'utf-8');
      mergeHeadPlaced = true;
    }

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
    // A successful merge `git commit` consumes MERGE_HEAD itself; a
    // failed one (blocking hook) must not leave the repo looking
    // mid-merge — the marker is ours, so it goes.
    if (mergeHeadPlaced) await fs.rm(mergeHeadPath, { force: true }).catch(() => undefined);
    await fs.rm(indexDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
