/**
 * Workspace repo plumbing — init/adopt, commit identity, temp-index
 * commits, and the porcelain dirty feed (the git-sync plan §3.3 bill of
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
import type { IgnoreProvenance } from './ignore-ops';

/** Explicit repo addressing prefix for every command (the git-sync plan §7). */
export function repoArgs(rootDir: string): string[] {
  return ['--git-dir', path.join(rootDir, '.git'), '--work-tree', rootDir];
}

export function failureDetail(result: GitExecResult): string {
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
  return `${slug}@users.noreply.openheaders.com`;
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

// ── Working changes (the Commit tool window's tree feed) ─────────────

/** One row of the Commit window's changes tree — a porcelain entry. */
export interface WorkingChange {
  /** Repo-relative path where the file lives now. */
  path: string;
  /**
   * Merged display letter (worktree side wins over index side):
   * `A`/`M`/`D`/`T`/`R`/`C` for tracked rows, the raw `?`/`!` for
   * unversioned/ignored ones (the flags below are the real signal).
   */
  status: string;
  /** Porcelain `??` — the Unversioned Files group. */
  unversioned: boolean;
  /** Porcelain `!!` — listed only when the caller asked for ignored files. */
  ignored: boolean;
  /** Rename/copy origin (the old path) when the index carries one. */
  renamedFrom?: string;
  /** Ignored rows only: which ignore source matched (annotated by the runtime, not porcelain). */
  ignoreSource?: IgnoreProvenance;
}

/**
 * Parse `git status --porcelain -z` into display rows. Rename/copy
 * records carry the origin as a second NUL token. Rows sort by path so
 * repeated reads of an unchanged tree are byte-identical (the status
 * feed hashes frames).
 */
export function parseWorkingChanges(stdout: string): WorkingChange[] {
  const tokens = stdout.split('\0');
  const changes: WorkingChange[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.length < 4) continue;
    const x = token[0];
    const y = token[1];
    const filePath = token.slice(3);
    if (filePath.length === 0) continue;
    if (x === '?') {
      changes.push({ path: filePath, status: '?', unversioned: true, ignored: false });
      continue;
    }
    if (x === '!') {
      changes.push({ path: filePath, status: '!', unversioned: false, ignored: true });
      continue;
    }
    let renamedFrom: string | undefined;
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') {
      const origin = tokens[i + 1];
      if (origin !== undefined && origin.length > 0) renamedFrom = origin;
      i += 1;
    }
    const status = y !== ' ' ? y : x;
    changes.push({
      path: filePath,
      status,
      unversioned: false,
      ignored: false,
      ...(renamedFrom !== undefined ? { renamedFrom } : {}),
    });
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * The Commit window's changes rows; null when porcelain fails.
 * `--untracked-files=all` expands untracked directories into their
 * individual files (the tree shows files, not `rules/`).
 */
export async function listWorkingChanges(
  run: GitRunner,
  rootDir: string,
  options?: { includeIgnored?: boolean },
): Promise<WorkingChange[] | null> {
  const result = await run(
    [
      ...repoArgs(rootDir),
      'status',
      '--porcelain',
      '-z',
      '--untracked-files=all',
      ...(options?.includeIgnored === true ? ['--ignored'] : []),
    ],
    { cwd: rootDir },
  );
  if (result.code !== 0) return null;
  return parseWorkingChanges(result.stdout);
}

/** Parent shas of a commit (`rev-list --parents -n 1`); null when the ref is unknown. */
export async function commitParents(run: GitRunner, rootDir: string, ref: string): Promise<string[] | null> {
  const result = await run([...repoArgs(rootDir), 'rev-list', '--parents', '-n', '1', ref, '--'], { cwd: rootDir });
  if (result.code !== 0) return null;
  const shas = result.stdout
    .trim()
    .split(/\s+/)
    .filter((sha) => sha.length > 0);
  if (shas.length === 0) return null;
  return shas.slice(1);
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
  /** Parent shas in `%P` order (first parent first) — the log graph's edge feed;
   *  two or more mark a merge commit, none the root. */
  parents: string[];
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
export const LOG_FORMAT = '%x1e%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b';

const CO_AUTHOR_TRAILER = /^co-authored-by:\s*(.+)$/gim;

export function parseCommitLog(stdout: string): CommitLogEntry[] {
  const entries: CommitLogEntry[] = [];
  for (const record of stdout.split('\x1e')) {
    if (record.length === 0) continue;
    const tokens = record.split('\0');
    const header = tokens[0].split('\x1f');
    if (header.length < 7) continue;
    const coAuthors: string[] = [];
    for (const match of header.slice(6).join('\x1f').matchAll(CO_AUTHOR_TRAILER)) {
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
      parents: header[1].split(' ').filter((parent) => parent.length > 0),
      authorName: header[2],
      authorEmail: header[3],
      authoredAt: header[4],
      subject: header[5],
      coAuthors,
      files,
    });
  }
  return entries;
}

/**
 * Row filters for {@link listCommitLog} — the log toolbar's User /
 * Date / Paths chips and Graph Options riding the walk itself, so
 * answers are honest over real history rather than the loaded window.
 * `author` is matched as a literal substring (escaped before git's
 * regex machinery, case-insensitive); dates are ISO-8601 strings the
 * dispatch layer validated; `paths` are validated tree paths.
 */
export interface CommitLogFilters {
  author?: string;
  since?: string;
  until?: string;
  paths?: string[];
  noMerges?: boolean;
  firstParent?: boolean;
  topoOrder?: boolean;
  /** Walk every ref (branches + tags + remotes + HEAD) instead of one
   *  scope — the IDE log's unfiltered view. Composes rev ARGS, not
   *  filter flags; mutually exclusive with a `ref` scope. */
  allRefs?: boolean;
}

function escapeAuthorPattern(author: string): string {
  return author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The `User: me` filter's value — the same resolution order the commit
 * pass runs under (§11.3 git config first, synthetic fallback): the
 * configured `user.email`, else `user.name`, else the synthetic name.
 */
export async function resolveAuthorFilterValue(
  run: GitRunner,
  rootDir: string,
  fallback: SyntheticCommitIdentity,
): Promise<string> {
  const email = await configValue(run, rootDir, 'user.email');
  if (email !== null) return email;
  const name = await configValue(run, rootDir, 'user.name');
  if (name !== null) return name;
  return fallback.name.length > 0 ? fallback.name : 'OpenHeaders';
}

/**
 * Recent commits with their changed paths — the §9 history view's
 * workspace timeline. One invocation regardless of `limit`; an unborn
 * HEAD answers an empty list (a fresh repo has no history yet). `ref`
 * scopes the walk to a branch/tag instead of HEAD — a validated ref
 * NAME only ({@link isSafeRefName}), never a revision expression.
 */
export async function listCommitLog(
  run: GitRunner,
  rootDir: string,
  limit: number,
  ref?: string,
  filters?: CommitLogFilters,
): Promise<CommitLogEntry[] | null> {
  if (ref !== undefined && !isSafeRefName(ref)) return null;
  const allRefs = ref === undefined && filters?.allRefs === true;
  // HEAD is the default walk root, and under `allRefs` it still rides
  // along explicitly — but only when it resolves: an unborn HEAD would
  // fail the whole spawn, while other refs may still exist.
  const headSha = ref === undefined ? await localHeadSha(run, rootDir) : null;
  if (ref === undefined && !allRefs && headSha === null) return [];
  const paths = filters?.paths ?? [];
  const result = await run(
    [
      ...repoArgs(rootDir),
      'log',
      '-z',
      '--name-status',
      '-M',
      `-n`,
      String(limit),
      `--format=${LOG_FORMAT}`,
      ...(filters?.noMerges === true ? ['--no-merges'] : []),
      ...(filters?.firstParent === true ? ['--first-parent'] : []),
      ...(filters?.topoOrder === true ? ['--topo-order'] : []),
      ...(filters?.author !== undefined
        ? [`--author=${escapeAuthorPattern(filters.author)}`, '--regexp-ignore-case']
        : []),
      ...(filters?.since !== undefined ? [`--since=${filters.since}`] : []),
      ...(filters?.until !== undefined ? [`--until=${filters.until}`] : []),
      ...(ref !== undefined
        ? [ref]
        : allRefs
          ? ['--branches', '--tags', '--remotes', ...(headSha !== null ? ['HEAD'] : [])]
          : []),
      '--',
      ...paths,
    ],
    { cwd: rootDir },
  );
  if (result.code !== 0) {
    // All-refs over an empty repo (no refs, unborn HEAD): rev machinery
    // falls back to the unresolvable HEAD default — an empty timeline,
    // not a failure.
    return allRefs && headSha === null ? [] : null;
  }
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

// ── Ref tree (Phase 7 slice 2: §9 log view's left rail) ──────────────

/** One ref in the log view's tree, grouped by namespace. */
export interface RepoRef {
  /** Short name (`main`, `origin/main`, `v1.0`). */
  name: string;
  kind: 'local' | 'remote' | 'tag';
  sha: string;
}

/**
 * Strict refname gate for caller-supplied log scopes: a plain ref NAME
 * only — never a revision expression. Rejects range/exclusion syntax
 * (`..`, `^`, `~`), reflog syntax (`@{`), option injection (leading
 * `-`), and everything else `check-ref-format` would — without a spawn,
 * so the dispatch layer can refuse before touching git.
 */
export function isSafeRefName(ref: string): boolean {
  if (ref.length === 0 || ref.length > 512) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref)) return false;
  return !ref.includes('..') && !ref.includes('//') && !ref.endsWith('/') && !ref.endsWith('.lock');
}

/**
 * Every branch and tag of the repo — `for-each-ref` over the three
 * namespaces in one invocation. Annotated tags report the PEELED commit
 * sha (the log target), and the symbolic `<remote>/HEAD` pointer is
 * dropped (it duplicates the remote's default branch). A fresh repo
 * with no commits answers an empty list.
 */
export async function listRepoRefs(run: GitRunner, rootDir: string): Promise<RepoRef[] | null> {
  const result = await run(
    [
      ...repoArgs(rootDir),
      'for-each-ref',
      '--format=%(refname)%1f%(objectname)%1f%(*objectname)',
      '--sort=refname',
      'refs/heads',
      'refs/remotes',
      'refs/tags',
    ],
    { cwd: rootDir },
  );
  if (result.code !== 0) return null;
  const refs: RepoRef[] = [];
  for (const line of result.stdout.split('\n')) {
    if (line.length === 0) continue;
    const [refname, sha, peeled] = line.split('\x1f');
    if (refname === undefined || sha === undefined) continue;
    if (refname.startsWith('refs/heads/')) {
      refs.push({ name: refname.slice('refs/heads/'.length), kind: 'local', sha });
    } else if (refname.startsWith('refs/remotes/')) {
      const name = refname.slice('refs/remotes/'.length);
      if (name.endsWith('/HEAD')) continue;
      refs.push({ name, kind: 'remote', sha });
    } else if (refname.startsWith('refs/tags/')) {
      refs.push({
        name: refname.slice('refs/tags/'.length),
        kind: 'tag',
        sha: peeled !== undefined && peeled.length > 0 ? peeled : sha,
      });
    }
  }
  return refs;
}

// ── Commit file diff (Phase 7 slice 3: §9 log view's diff pane) ──────

/** Per-side blob cap for the diff pane — bigger blobs answer `tooLarge` with no contents. */
export const COMMIT_FILE_DIFF_MAX_BYTES = 1_048_576;

/**
 * Strict commit-hash gate for caller-supplied diff targets: a FULL hex
 * object name only (40 for SHA-1, 64 for SHA-256 repos) — never an
 * abbreviation, ref name, or revision expression.
 */
export function isCommitSha(sha: string): boolean {
  return /^[0-9a-f]{40}$/.test(sha) || /^[0-9a-f]{64}$/.test(sha);
}

/**
 * Strict tree-path gate for caller-supplied diff targets: a plain
 * repo-relative file path — no option injection (leading `-`), no
 * absolute paths, no `.`/`..` segments, no trailing slash, no control
 * characters (a newline would otherwise ride into `.gitignore` content
 * writes via `addIgnoreEntry`, and into log lines).
 */
export function isSafeTreePath(filePath: string): boolean {
  if (filePath.length === 0 || filePath.length > 4096) return false;
  for (let i = 0; i < filePath.length; i++) {
    const code = filePath.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  if (filePath.startsWith('-') || filePath.startsWith('/') || filePath.endsWith('/')) {
    return false;
  }
  return !filePath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
}

/** One file's old/new blob pair in one commit — the Monaco diff pane's feed. */
export interface CommitFileDiff {
  path: string;
  /** Old blob text; null when the commit added the file (or binary/over-cap). */
  oldContent: string | null;
  /** New blob text; null when the commit deleted the file (or binary/over-cap). */
  newContent: string | null;
  /** True when git reports the change as binary — no text contents ride along. */
  binary: boolean;
  /** True when either side exceeds the size cap — no contents ride along. */
  tooLarge: boolean;
  /** Byte size per side; null on an absent side. */
  oldSize: number | null;
  newSize: number | null;
}

export type CommitFileDiffResult =
  | { ok: true; diff: CommitFileDiff }
  | { ok: false; reason: 'unknown-commit' | 'unknown-path' | 'diff-failed'; detail?: string };

/** A blob side of the diff (`<sha>:<path>` / `<sha>^:<path>`); absent when that side doesn't exist. */
async function readBlobSize(run: GitRunner, rootDir: string, rev: string): Promise<number | null> {
  const result = await run([...repoArgs(rootDir), 'cat-file', '-s', rev], { cwd: rootDir });
  const size = Number(result.stdout.trim());
  return result.code === 0 && Number.isFinite(size) ? size : null;
}

/**
 * One file's change in one commit as an old/new blob pair — the slice-3
 * diff read. The old side is the FIRST parent's blob (`<sha>^:<path>`),
 * so an added file answers a null old side and a deleted file a null
 * new side; a rename's old-name blob is not chased (the record already
 * reports where the file lives now, like {@link listCommitLog}). The
 * caller supplies a validated full sha ({@link isCommitSha}) and plain
 * tree path ({@link isSafeTreePath}); both are re-checked here as
 * defense in depth. Binary changes (git's own `--numstat` verdict) and
 * blobs over `maxBytes` answer typed flags with sizes but no contents.
 */
export async function readCommitFileDiff(
  run: GitRunner,
  rootDir: string,
  sha: string,
  filePath: string,
  maxBytes: number = COMMIT_FILE_DIFF_MAX_BYTES,
): Promise<CommitFileDiffResult> {
  if (!isCommitSha(sha)) return { ok: false, reason: 'unknown-commit' };
  if (!isSafeTreePath(filePath)) return { ok: false, reason: 'unknown-path' };
  const commit = await run([...repoArgs(rootDir), 'rev-parse', '--verify', '--quiet', `${sha}^{commit}`], {
    cwd: rootDir,
  });
  if (commit.code !== 0) return { ok: false, reason: 'unknown-commit' };

  const numstat = await run(
    [...repoArgs(rootDir), 'diff-tree', '-r', '-z', '--root', '--no-commit-id', '--numstat', sha, '--', filePath],
    { cwd: rootDir },
  );
  if (numstat.code !== 0) return { ok: false, reason: 'diff-failed', detail: failureDetail(numstat) };
  const record = numstat.stdout.split('\0').find((token) => token.length > 0);
  if (record === undefined) return { ok: false, reason: 'unknown-path' };
  const binary = record.startsWith('-\t-\t');

  const oldRev = `${sha}^:${filePath}`;
  const newRev = `${sha}:${filePath}`;
  const oldSize = await readBlobSize(run, rootDir, oldRev);
  const newSize = await readBlobSize(run, rootDir, newRev);
  if (oldSize === null && newSize === null) return { ok: false, reason: 'unknown-path' };
  const tooLarge = (oldSize ?? 0) > maxBytes || (newSize ?? 0) > maxBytes;

  const base: CommitFileDiff = {
    path: filePath,
    oldContent: null,
    newContent: null,
    binary,
    tooLarge,
    oldSize,
    newSize,
  };
  if (binary || tooLarge) return { ok: true, diff: base };

  let oldContent: string | null = null;
  if (oldSize !== null) {
    const blob = await run([...repoArgs(rootDir), 'show', oldRev], { cwd: rootDir });
    if (blob.code !== 0) return { ok: false, reason: 'diff-failed', detail: failureDetail(blob) };
    oldContent = blob.stdout;
  }
  let newContent: string | null = null;
  if (newSize !== null) {
    const blob = await run([...repoArgs(rootDir), 'show', newRev], { cwd: rootDir });
    if (blob.code !== 0) return { ok: false, reason: 'diff-failed', detail: failureDetail(blob) };
    newContent = blob.stdout;
  }
  return { ok: true, diff: { ...base, oldContent, newContent } };
}

/** Git's own binary heuristic: a NUL in the first 8000 bytes. */
function looksBinary(content: string): boolean {
  return content.slice(0, 8000).includes('\0');
}

/**
 * One file's change between HEAD and the WORKING TREE — the Commit
 * window's diff feed. The old side is HEAD's blob (null when the file
 * is new/unversioned or HEAD is unborn), the new side the on-disk
 * bytes (null when deleted). Same caps and typed flags as
 * {@link readCommitFileDiff}; the caller supplies a validated tree
 * path, re-checked here as defense in depth.
 */
export async function readWorkingFileDiff(
  run: GitRunner,
  rootDir: string,
  filePath: string,
  maxBytes: number = COMMIT_FILE_DIFF_MAX_BYTES,
): Promise<CommitFileDiffResult> {
  if (!isSafeTreePath(filePath)) return { ok: false, reason: 'unknown-path' };
  const headRev = `HEAD:${filePath}`;
  const oldSize = await readBlobSize(run, rootDir, headRev);

  const absPath = path.join(rootDir, filePath);
  let newSize: number | null = null;
  try {
    const stat = await fs.stat(absPath);
    if (stat.isFile()) newSize = stat.size;
  } catch {
    // absent on disk — deleted (or never existed)
  }
  if (oldSize === null && newSize === null) return { ok: false, reason: 'unknown-path' };
  const tooLarge = (oldSize ?? 0) > maxBytes || (newSize ?? 0) > maxBytes;

  const base: CommitFileDiff = {
    path: filePath,
    oldContent: null,
    newContent: null,
    binary: false,
    tooLarge,
    oldSize,
    newSize,
  };
  if (tooLarge) return { ok: true, diff: base };

  let oldContent: string | null = null;
  if (oldSize !== null) {
    const blob = await run([...repoArgs(rootDir), 'show', headRev], { cwd: rootDir });
    if (blob.code !== 0) return { ok: false, reason: 'diff-failed', detail: failureDetail(blob) };
    oldContent = blob.stdout;
  }
  let newContent: string | null = null;
  if (newSize !== null) {
    try {
      newContent = await fs.readFile(absPath, 'utf-8');
    } catch (err) {
      return { ok: false, reason: 'diff-failed', detail: (err as Error).message };
    }
  }
  if ((oldContent !== null && looksBinary(oldContent)) || (newContent !== null && looksBinary(newContent))) {
    return { ok: true, diff: { ...base, binary: true } };
  }
  return { ok: true, diff: { ...base, oldContent, newContent } };
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
  /**
   * Commit only these validated tree paths (the Commit window's
   * checked set) instead of the whole tree. `git add -A` scoped to the
   * pathspec — modifications, deletions, and untracked files within
   * the set all stage; `.gitignore` still applies. An EMPTY array
   * skips staging entirely (the seeded HEAD tree commits as-is — the
   * message-only Amend gesture). Absent = the historic `-A .` pass.
   */
  paths?: readonly string[];
  /**
   * User-explicit Amend (the Commit window carve-out — never FROM the
   * engine): `git commit --amend` on the temp index. The CALLER owns
   * the refusal conditions (unborn/merge/pushed HEAD); an unchanged
   * tree still commits (a message-only amend is the point). Mutually
   * exclusive with `mergeParent`.
   */
  amend?: boolean;
  /** Per-commit `Signed-off-by` trailer (`--signoff`) — the gear's Sign-off option. */
  signOff?: boolean;
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

    if (options.paths === undefined || options.paths.length > 0) {
      const stage = await run([...repoArgs(rootDir), 'add', '-A', '--', ...(options.paths ?? ['.'])], {
        cwd: rootDir,
        env: indexEnv,
      });
      if (stage.code !== 0) return { ok: false, reason: 'stage-failed', detail: failureDetail(stage) };
    }

    const diff = await run([...repoArgs(rootDir), 'diff', '--cached', '--quiet'], { cwd: rootDir, env: indexEnv });
    if (diff.code === 0 && mergeParent === undefined && options.amend !== true) return { ok: true, committed: false };

    if (mergeParent !== undefined) {
      await fs.writeFile(mergeHeadPath, `${mergeParent}\n`, 'utf-8');
      mergeHeadPlaced = true;
    }

    const commit = await run(
      [
        ...repoArgs(rootDir),
        'commit',
        '-m',
        message,
        ...(options.amend === true ? ['--amend'] : []),
        ...(options.signOff === true ? ['--signoff'] : []),
        ...(options.bypassHooks === true ? ['--no-verify'] : []),
      ],
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
