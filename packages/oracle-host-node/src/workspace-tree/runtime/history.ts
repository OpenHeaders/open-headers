/**
 * Workspace-tree runtime — the history-read plane (§9, Phase 7): the
 * log/fileLog timelines, the ref tree, the per-commit file diff, the
 * compare-with-current range read, and the Console tab's audit slice.
 * Pure repo reads OFF the per-binding chain — they never queue behind
 * a commit/pull pass; caller-supplied targets are validated shapes.
 */

import {
  type CommitLogEntry,
  isCommitSha,
  isSafeRefName,
  isSafeTreePath,
  isWorkspaceRepo,
  listCommitLog,
  listCommitRangeLog,
  listFileLog,
  listRepoRefs,
  readCommitFileDiff,
} from '../../git';
import { LOG_DEFAULT_LIMIT, LOG_MAX_LIMIT, type RuntimeCtx } from './core';
import type {
  CompareRefsRpcResult,
  WorkspaceTreeFileDiffRpcResult,
  WorkspaceTreeGitConsoleRpcResult,
  WorkspaceTreeLogRpcResult,
  WorkspaceTreeRefsRpcResult,
} from './types';

/**
 * One history read — shared by `log` and `fileLog`. A caller-supplied
 * scope must be a ref NAME the tree lists — never a revision
 * expression (no `..`, no flags, §9 slice 2).
 */
export async function runLog(
  ctx: RuntimeCtx,
  workspaceId: string,
  read: (rootDir: string, limit: number) => Promise<CommitLogEntry[] | null>,
  limit?: number,
  ref?: string,
): Promise<WorkspaceTreeLogRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (ref !== undefined) {
    if (!isSafeRefName(ref)) return { ok: false, reason: 'unknown-ref' };
    const refs = await listRepoRefs(ctx.gitRun, rootDir);
    if (refs === null || !refs.some((repoRef) => repoRef.name === ref)) {
      return { ok: false, reason: 'unknown-ref' };
    }
  }
  const capped = Math.min(Math.max(1, Math.floor(limit ?? LOG_DEFAULT_LIMIT)), LOG_MAX_LIMIT);
  const entries = await read(rootDir, capped);
  if (entries === null) return { ok: false, reason: 'log-failed' };
  return { ok: true, entries };
}

export function runWorkspaceLog(
  ctx: RuntimeCtx,
  workspaceId: string,
  limit?: number,
  ref?: string,
): Promise<WorkspaceTreeLogRpcResult> {
  return runLog(ctx, workspaceId, (rootDir, capped) => listCommitLog(ctx.gitRun, rootDir, capped, ref), limit, ref);
}

export function runFileLog(
  ctx: RuntimeCtx,
  workspaceId: string,
  filePath: string,
  limit?: number,
): Promise<WorkspaceTreeLogRpcResult> {
  if (filePath.length === 0) return Promise.resolve({ ok: false, reason: 'log-failed', detail: 'empty path' });
  return runLog(ctx, workspaceId, (rootDir, capped) => listFileLog(ctx.gitRun, rootDir, filePath, capped), limit);
}

export async function runListRefs(ctx: RuntimeCtx, workspaceId: string): Promise<WorkspaceTreeRefsRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const refs = await listRepoRefs(ctx.gitRun, rootDir);
  if (refs === null) return { ok: false, reason: 'refs-failed' };
  // `current` comes from the status authority, not a fresh spawn —
  // HEAD moves invalidate it (head watcher, switch, checkout), so
  // the two reads stay coherent by construction.
  return { ok: true, refs, current: (await ctx.readGitStatus(binding)).branch };
}

/**
 * Compare with Current (§9 IDE-log): both exclusive commit lists
 * between the checked-out branch and a ref the tree lists. The `..`
 * ranges are composed in the plumbing from two validated names — a
 * caller expression can never reach git.
 */
export async function runCompareRefs(ctx: RuntimeCtx, workspaceId: string, ref: string): Promise<CompareRefsRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (!isSafeRefName(ref)) return { ok: false, reason: 'unknown-ref' };
  const refs = await listRepoRefs(ctx.gitRun, rootDir);
  if (refs === null || !refs.some((repoRef) => repoRef.name === ref)) return { ok: false, reason: 'unknown-ref' };
  const current = (await ctx.readGitStatus(binding)).branch;
  if (current === null) return { ok: false, reason: 'detached-head' };
  const onlyInRef = await listCommitRangeLog(ctx.gitRun, rootDir, current, ref, LOG_MAX_LIMIT);
  const onlyInCurrent = await listCommitRangeLog(ctx.gitRun, rootDir, ref, current, LOG_MAX_LIMIT);
  if (onlyInRef === null || onlyInCurrent === null) return { ok: false, reason: 'compare-failed' };
  return { ok: true, current, ref, onlyInCurrent, onlyInRef };
}

export async function runFileDiff(
  ctx: RuntimeCtx,
  workspaceId: string,
  sha: string,
  filePath: string,
): Promise<WorkspaceTreeFileDiffRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  // Same posture as the ref-scoped log: caller-supplied targets are
  // validated shapes, never revision expressions (§9 slice 2/3).
  if (!isCommitSha(sha)) return { ok: false, reason: 'unknown-commit' };
  if (!isSafeTreePath(filePath)) return { ok: false, reason: 'unknown-path' };
  return readCommitFileDiff(ctx.gitRun, rootDir, sha, filePath);
}

/** Console-tab read: this binding's slice of the audit ring (cwd inside its root). */
export async function runGitConsole(ctx: RuntimeCtx, workspaceId: string): Promise<WorkspaceTreeGitConsoleRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  return {
    ok: true,
    rows: ctx.consoleRows.filter((row) => row.cwd === rootDir || row.cwd.startsWith(`${rootDir}/`)),
  };
}
