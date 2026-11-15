/**
 * Workspace-tree runtime — the history-read plane (§9, Phase 7): the
 * log/fileLog timelines, the ref tree, the per-commit file diff, a
 * commit's change against each parent, the commits' signatures, the
 * commit patch text, the
 * compare-with-current range read, and the
 * Console tab's audit slice.
 * Pure repo reads OFF the per-binding chain — they never queue behind
 * a commit/pull pass; caller-supplied targets are validated shapes.
 */

import {
  COMMIT_SIGNATURES_MAX_COMMITS,
  type CommitLogEntry,
  type CommitLogFilters,
  isCommitSha,
  isSafeRefName,
  isSafeTreePath,
  isWorkspaceRepo,
  listCommitLog,
  listCommitRangeLog,
  listFileLog,
  listHeadTreePaths,
  listRepoRefs,
  openLogSearchLane,
  readCommitFileDiff,
  readCommitParentChanges,
  readCommitPatch,
  readCommitSignatures,
  resolveAuthorFilterValue,
  searchCommitLog,
  unlistedScopeRefs,
} from '../../git';
import { LOG_DEFAULT_LIMIT, LOG_MAX_LIMIT, LOG_SEARCH_DEADLINE_MS, type RuntimeCtx } from './core';
import type {
  CompareRefsRpcResult,
  WorkspaceTreeCommitParentChangesRpcResult,
  WorkspaceTreeCommitPatchRpcResult,
  WorkspaceTreeCommitSignaturesRpcResult,
  WorkspaceTreeFileDiffRpcResult,
  WorkspaceTreeGitConsoleRpcResult,
  WorkspaceTreeLogFilters,
  WorkspaceTreeLogRpcResult,
  WorkspaceTreeLogSearch,
  WorkspaceTreeRefsRpcResult,
  WorkspaceTreeSearchLogRpcResult,
  WorkspaceTreeTreeFilesRpcResult,
} from './types';

/**
 * One history read — shared by `log` and `fileLog`. Every member of a
 * caller-supplied scope must be a ref NAME the tree lists (or HEAD) —
 * never a revision expression (no `..`, no flags, §9 slice 2); the
 * refusal names the members that are not.
 */
export async function runLog(
  ctx: RuntimeCtx,
  workspaceId: string,
  read: (rootDir: string, limit: number) => Promise<CommitLogEntry[] | null>,
  limit?: number,
  scope?: readonly string[],
): Promise<WorkspaceTreeLogRpcResult> {
  const history = await openHistory(ctx, workspaceId, scope);
  if (!history.ok) return history;
  const entries = await read(history.rootDir, cappedLimit(limit));
  if (entries === null) return { ok: false, reason: 'log-failed' };
  return { ok: true, entries };
}

type HistoryRefusal = Extract<WorkspaceTreeLogRpcResult, { ok: false }>;

/** What every history read stands on: a bound workspace, a git that runs, a repo, and a scope the tree lists. */
async function openHistory(
  ctx: RuntimeCtx,
  workspaceId: string,
  scope?: readonly string[],
): Promise<{ ok: true; rootDir: string } | HistoryRefusal> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (scope !== undefined) {
    const unlisted = await unlistedScopeRefs(ctx.gitRun, rootDir, scope);
    if (unlisted === null) return { ok: false, reason: 'unknown-ref' };
    if (unlisted.length > 0) return { ok: false, reason: 'unknown-ref', unknownRefs: unlisted };
  }
  return { ok: true, rootDir };
}

function cappedLimit(limit: number | undefined): number {
  return Math.min(Math.max(1, Math.floor(limit ?? LOG_DEFAULT_LIMIT)), LOG_MAX_LIMIT);
}

const LOG_FILTER_MAX_PATHS = 32;
const LOG_FILTER_MAX_AUTHORS = 32;
const LOG_SCOPE_MAX_REFS = 64;
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
  if (filters.authors !== undefined) {
    const { authors } = filters;
    if (filters.author !== undefined || authors.length === 0 || authors.length > LOG_FILTER_MAX_AUTHORS) {
      return { ok: false };
    }
    if (!authors.every(isValidAuthorFilter)) return { ok: false };
    out.authors = [...authors];
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
  if (filters.allRefs === true) out.allRefs = true;
  return { ok: true, filters: out };
}

/**
 * A log call's scope and row filters as plumbing takes them — null for
 * a shape that is none. `resolve` settles what only the repo knows.
 */
function readLogRequest(
  ctx: RuntimeCtx,
  scope?: readonly string[],
  filters?: WorkspaceTreeLogFilters,
): { resolve(rootDir: string): Promise<CommitLogFilters> } | null {
  const validated = filters !== undefined ? validateLogFilters(filters) : { ok: true as const, filters: {} };
  if (!validated.ok) return null;
  const authorMe = filters?.authorMe === true;
  if (authorMe && (filters?.author !== undefined || filters?.authors !== undefined)) return null;
  // `allRefs` is a scope, not a filter — it and a scope of refs are
  // mutually exclusive by construction. A scope names something.
  if (scope !== undefined && (filters?.allRefs === true || scope.length === 0 || scope.length > LOG_SCOPE_MAX_REFS)) {
    return null;
  }
  return {
    resolve: async (rootDir) => {
      const plumbing = { ...validated.filters };
      // `User: me` resolves HOST-SIDE to the identity the commit pass
      // itself runs under (§11.3) — the client never supplies it.
      if (authorMe) plumbing.author = await resolveAuthorFilterValue(ctx.gitRun, rootDir, ctx.syntheticIdentity());
      return plumbing;
    },
  };
}

export function runWorkspaceLog(
  ctx: RuntimeCtx,
  workspaceId: string,
  limit?: number,
  scope?: readonly string[],
  filters?: WorkspaceTreeLogFilters,
): Promise<WorkspaceTreeLogRpcResult> {
  const request = readLogRequest(ctx, scope, filters);
  if (request === null) return Promise.resolve({ ok: false, reason: 'invalid-filter' });
  return runLog(
    ctx,
    workspaceId,
    async (rootDir, capped) => listCommitLog(ctx.gitRun, rootDir, capped, scope, await request.resolve(rootDir)),
    limit,
    scope,
  );
}

const LOG_SEARCH_MAX_KEY = 64;

/**
 * The log's text field over the whole history a scope reaches. The
 * text's shape and the walk's bounds are the plumbing's; here the
 * search takes its turn — a newer one under the same key ends it — and
 * the plumbing's outcome becomes the verb's typed answer.
 */
export async function runSearchLog(
  ctx: RuntimeCtx,
  workspaceId: string,
  search: WorkspaceTreeLogSearch,
  limit?: number,
  scope?: readonly string[],
  filters?: WorkspaceTreeLogFilters,
): Promise<WorkspaceTreeSearchLogRpcResult> {
  const request = readLogRequest(ctx, scope, filters);
  const key = search.key ?? '';
  if (request === null || key.length > LOG_SEARCH_MAX_KEY) return { ok: false, reason: 'invalid-filter' };
  // A plain text is matched here; a pattern never runs on the host's own thread — the lane is the plumbing's.
  const lane = openLogSearchLane(search.text, search.regex === true, search.matchCase === true);
  if (lane === null) return { ok: false, reason: 'invalid-filter' };
  const history = await openHistory(ctx, workspaceId, scope);
  if (!history.ok) return history;
  const turn = ctx.searchTurns.take(workspaceId, key);
  try {
    const result = await searchCommitLog(ctx.gitStream, ctx.gitRun, history.rootDir, {
      scope,
      filters: await request.resolve(history.rootDir),
      limit: cappedLimit(limit),
      match: lane.match,
      deadlineMs: LOG_SEARCH_DEADLINE_MS,
      signal: turn.signal,
    });
    if (result.ok) return result;
    if (result.reason === 'timeout') return { ok: false, reason: 'search-timeout' };
    if (result.reason === 'aborted') return { ok: false, reason: 'superseded' };
    return { ok: false, reason: result.reason === 'invalid-scope' ? 'unknown-ref' : 'log-failed' };
  } catch (fault) {
    // The lane's own failure (its worker went away): the search failed, the host did not.
    return { ok: false, reason: 'log-failed', detail: fault instanceof Error ? fault.message : String(fault) };
  } finally {
    lane.close();
    turn.done();
  }
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
  base?: string,
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
  if (base !== undefined && !isCommitSha(base)) return { ok: false, reason: 'unknown-commit' };
  if (!isSafeTreePath(filePath)) return { ok: false, reason: 'unknown-path' };
  return readCommitFileDiff(ctx.gitRun, rootDir, sha, filePath, undefined, base);
}

export async function runCommitPatch(
  ctx: RuntimeCtx,
  workspaceId: string,
  shas: readonly string[],
): Promise<WorkspaceTreeCommitPatchRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  return readCommitPatch(ctx.gitRun, rootDir, shas);
}

/**
 * A commit's change against each of its parents — a merge's files, which
 * the log's own listing leaves empty. The commit is a full sha.
 */
export async function runCommitParentChanges(
  ctx: RuntimeCtx,
  workspaceId: string,
  sha: string,
): Promise<WorkspaceTreeCommitParentChangesRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (!isCommitSha(sha)) return { ok: false, reason: 'unknown-commit' };
  const changes = await readCommitParentChanges(ctx.gitRun, rootDir, sha);
  return changes === null ? { ok: false, reason: 'unknown-commit' } : { ok: true, ...changes };
}

/**
 * The signed commits among `shas`, each with what git makes of its
 * signature — the log's GPG Signature column. Full shas only, a bounded
 * list; the check runs on the signed ones alone.
 */
export async function runCommitSignatures(
  ctx: RuntimeCtx,
  workspaceId: string,
  shas: readonly string[],
): Promise<WorkspaceTreeCommitSignaturesRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  if (shas.length > COMMIT_SIGNATURES_MAX_COMMITS) return { ok: false, reason: 'unknown-commit' };
  const signatures = await readCommitSignatures(ctx.gitRun, rootDir, shas);
  return signatures === null ? { ok: false, reason: 'unknown-commit' } : { ok: true, signatures };
}

/** Every file of the checked-out commit's tree — the log's path picker's listing. */
export async function runTreeFiles(ctx: RuntimeCtx, workspaceId: string): Promise<WorkspaceTreeTreeFilesRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  const listed = await listHeadTreePaths(ctx.gitRun, rootDir);
  return listed === null ? { ok: false, reason: 'list-failed' } : { ok: true, ...listed };
}

/** Console-tab read: this binding's slice of the audit ring (cwd inside its root). */
export async function runGitConsole(ctx: RuntimeCtx, workspaceId: string): Promise<WorkspaceTreeGitConsoleRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  return { ok: true, rows: ctx.consoleRows.filter((row) => consoleRowIsOf(rootDir, row.cwd)) };
}

/** Whether a console row belongs to the repo at `rootDir`: the command ran in its work tree. */
export function consoleRowIsOf(rootDir: string, cwd: string): boolean {
  return cwd === rootDir || cwd.startsWith(`${rootDir}/`);
}
