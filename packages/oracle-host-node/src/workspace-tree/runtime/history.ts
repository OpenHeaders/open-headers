/**
 * Workspace-tree runtime — the history-read plane (§9, Phase 7): the
 * log/fileLog timelines, the ref tree, the per-commit file diff, the
 * compare-with-current range read, and the Console tab's audit slice.
 * Pure repo reads OFF the per-binding chain — they never queue behind
 * a commit/pull pass; caller-supplied targets are validated shapes.
 */

import {
  type CommitLogEntry,
  type CommitLogFilters,
  isCommitSha,
  isSafeRefName,
  isSafeTreePath,
  isWorkspaceRepo,
  listCommitLog,
  listCommitRangeLog,
  listFileLog,
  listRepoRefs,
  readCommitFileDiff,
  resolveAuthorFilterValue,
} from '../../git';
import { LOG_DEFAULT_LIMIT, LOG_MAX_LIMIT, type RuntimeCtx } from './core';
import type {
  CompareRefsRpcResult,
  WorkspaceTreeFileDiffRpcResult,
  WorkspaceTreeGitConsoleRpcResult,
  WorkspaceTreeLogFilters,
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

const LOG_FILTER_MAX_PATHS = 32;
const LOG_FILTER_MAX_AUTHOR = 200;
// Strict ISO-8601: a date, optionally with a time and zone — the only
// shapes the Date chip composes; anything else refuses.
const LOG_FILTER_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function isValidAuthorFilter(author: string): boolean {
  if (author.length === 0 || author.length > LOG_FILTER_MAX_AUTHOR) return false;
  if (author.startsWith('-')) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
  return !/[\x00-\x1f\x7f]/.test(author);
}

function isValidDateFilter(value: string): boolean {
  return LOG_FILTER_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

/** Validate the caller's row filters into plumbing shape (§9 posture:
 *  typed refusals, host-composed arguments). */
function validateLogFilters(filters: WorkspaceTreeLogFilters): { ok: true; filters: CommitLogFilters } | { ok: false } {
  const out: CommitLogFilters = {};
  if (filters.author !== undefined) {
    if (!isValidAuthorFilter(filters.author)) return { ok: false };
    out.author = filters.author;
  }
  if (filters.since !== undefined) {
    if (!isValidDateFilter(filters.since)) return { ok: false };
    out.since = filters.since;
  }
  if (filters.until !== undefined) {
    if (!isValidDateFilter(filters.until)) return { ok: false };
    out.until = filters.until;
  }
  if (filters.paths !== undefined) {
    if (filters.paths.length > LOG_FILTER_MAX_PATHS || !filters.paths.every((path) => isSafeTreePath(path))) {
      return { ok: false };
    }
    if (filters.paths.length > 0) out.paths = [...filters.paths];
  }
  if (filters.noMerges === true) out.noMerges = true;
  if (filters.firstParent === true) out.firstParent = true;
  if (filters.topoOrder === true) out.topoOrder = true;
  return { ok: true, filters: out };
}

export function runWorkspaceLog(
  ctx: RuntimeCtx,
  workspaceId: string,
  limit?: number,
  ref?: string,
  filters?: WorkspaceTreeLogFilters,
): Promise<WorkspaceTreeLogRpcResult> {
  const validated = filters !== undefined ? validateLogFilters(filters) : { ok: true as const, filters: {} };
  if (!validated.ok) return Promise.resolve({ ok: false, reason: 'invalid-filter' });
  const authorMe = filters?.authorMe === true;
  if (authorMe && filters?.author !== undefined) return Promise.resolve({ ok: false, reason: 'invalid-filter' });
  return runLog(
    ctx,
    workspaceId,
    async (rootDir, capped) => {
      const plumbing = { ...validated.filters };
      // `User: me` resolves HOST-SIDE to the identity the commit pass
      // itself runs under (§11.3) — the client never supplies it.
      if (authorMe) plumbing.author = await resolveAuthorFilterValue(ctx.gitRun, rootDir, ctx.syntheticIdentity());
      return listCommitLog(ctx.gitRun, rootDir, capped, ref, plumbing);
    },
    limit,
    ref,
  );
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
