/**
 * Workspace-tree runtime — the log over a whole history: a stretch of
 * a list's rows, and a commit's place in a list. Thin: the ask is
 * validated into the list's name, the read takes its turn (a tab's
 * newer one ends its older one), and the answer of the histories
 * (`../history`) becomes the verb's typed one. Off the per-binding
 * chain, like every history read.
 */

import { isCommitSha, isWorkspaceRepo, LOG_SCOPE_HEAD } from '../../git';
import type { LogAsk, LogList, LogListResult } from '../history';
import { locateLogRow, readLogRows } from '../history';
import type { Turns } from '../turns';
import { LOG_ROWS_MAX_COUNT, LOG_ROWS_MAX_FOLDS, type RuntimeCtx } from './core';
import { LOG_SURFACE_MAX_KEY, readLogRequest } from './history';
import type {
  WorkspaceTreeLocateLogRowRpcResult,
  WorkspaceTreeLogListAsk,
  WorkspaceTreeLogListRefusal,
  WorkspaceTreeLogRowsRpcResult,
} from './types';

const LOCATE_MAX_TARGET = 512;

const INVALID: WorkspaceTreeLogListRefusal = { ok: false, reason: 'invalid-filter' };
const SUPERSEDED: WorkspaceTreeLogListRefusal = { ok: false, reason: 'superseded' };

/** The answer of `work`, or null once `signal` is aborted — whichever comes first. */
function unlessEnded<T>(work: Promise<T>, signal: AbortSignal): Promise<T | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const ended = (): void => resolve(null);
    signal.addEventListener('abort', ended, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', ended));
  });
}

/**
 * The list a caller's ask names, read under the caller's turn: the ask
 * as a validated shape, the binding and its git, then the histories'
 * answer as the verbs' refusals. `then` runs with the list while the
 * turn still stands.
 */
async function withLogList<T>(
  ctx: RuntimeCtx,
  turns: Turns,
  workspaceId: string,
  asked: WorkspaceTreeLogListAsk,
  then: (rootDir: string, list: LogList) => Promise<T | WorkspaceTreeLogListRefusal>,
): Promise<T | WorkspaceTreeLogListRefusal> {
  const key = asked.key ?? '';
  const folds = asked.folds ?? [];
  const request = readLogRequest(ctx, asked.scope, asked.filters);
  if (request === null || key.length > LOG_SURFACE_MAX_KEY) return INVALID;
  if (folds.length > LOG_ROWS_MAX_FOLDS || !folds.every(isCommitSha)) return INVALID;

  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  const { rootDir } = binding.record;
  const availability = await ctx.ensureGitAvailability(rootDir);
  if (!availability.available) return { ok: false, reason: 'git-unavailable' };

  // A ref moved outside the app says nothing here: a Refresh is the person's word that one may have.
  if (asked.refresh === true) ctx.logHistories.stale(workspaceId);
  const turn = turns.take(workspaceId, key);
  try {
    const filters = await request.resolve(rootDir);
    const walked =
      filters.author !== undefined ||
      filters.authors !== undefined ||
      filters.since !== undefined ||
      filters.until !== undefined ||
      filters.paths !== undefined;
    const ask: LogAsk = {
      // With neither a scope nor every ref asked for, the checked-out commit's history — as `log` reads it.
      scope: filters.allRefs === true ? null : (asked.scope ?? [LOG_SCOPE_HEAD]),
      topological: filters.topoOrder === true,
      firstParent: filters.firstParent === true,
      noMerges: filters.noMerges === true,
      walk: walked
        ? {
            ...(filters.author !== undefined ? { author: filters.author } : {}),
            ...(filters.authors !== undefined ? { authors: filters.authors } : {}),
            ...(filters.since !== undefined ? { since: filters.since } : {}),
            ...(filters.until !== undefined ? { until: filters.until } : {}),
            ...(filters.paths !== undefined ? { paths: filters.paths } : {}),
          }
        : null,
      folds: { all: asked.foldAll === true, runs: folds },
    };
    // The list is everyone's who asks the same: a turn taken away ends this wait, never the making.
    const listed = await unlessEnded(ctx.logHistories.list(workspaceId, rootDir, ask), turn.signal);
    if (listed === null) return SUPERSEDED;
    if (!listed.ok) return refusalOf(ctx, rootDir, listed);
    const answer = await unlessEnded(then(rootDir, listed.list), turn.signal);
    return answer === null ? SUPERSEDED : answer;
  } finally {
    turn.done();
  }
}

async function refusalOf(
  ctx: RuntimeCtx,
  rootDir: string,
  refused: Extract<LogListResult, { ok: false }>,
): Promise<WorkspaceTreeLogListRefusal> {
  if (refused.reason === 'unknown-ref') return { ok: false, reason: 'unknown-ref', unknownRefs: refused.unknownRefs };
  if (refused.reason === 'invalid-scope') return { ok: false, reason: 'unknown-ref' };
  if (refused.reason === 'timeout') return { ok: false, reason: 'log-timeout' };
  // A history that could not be read: the folder may be no repo at all.
  if (!(await isWorkspaceRepo(ctx.gitRun, rootDir))) return { ok: false, reason: 'not-a-repo' };
  return { ok: false, reason: 'log-failed', detail: refused.reason };
}

export function runLogRows(
  ctx: RuntimeCtx,
  workspaceId: string,
  asked: WorkspaceTreeLogListAsk,
  from: number,
  count: number,
): Promise<WorkspaceTreeLogRowsRpcResult> {
  if (!Number.isInteger(from) || from < 0 || !Number.isInteger(count) || count < 1) return Promise.resolve(INVALID);
  return withLogList<WorkspaceTreeLogRowsRpcResult>(
    ctx,
    ctx.logTurns.rows,
    workspaceId,
    asked,
    async (rootDir, list) => {
      const page = await readLogRows(ctx.gitRun, rootDir, list, from, Math.min(count, LOG_ROWS_MAX_COUNT));
      if (page === null) return { ok: false, reason: 'log-failed' };
      return {
        ok: true,
        list: list.generation.id,
        total: list.skeleton.count,
        widest: list.layout.widest,
        rows: page.rows,
        runs: page.runs,
      };
    },
  );
}

export function runLocateLogRow(
  ctx: RuntimeCtx,
  workspaceId: string,
  asked: WorkspaceTreeLogListAsk,
  target: string,
): Promise<WorkspaceTreeLocateLogRowRpcResult> {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
  if (target.length === 0 || target.length > LOCATE_MAX_TARGET || /[\x00-\x1f\x7f]/.test(target)) {
    return Promise.resolve(INVALID);
  }
  return withLogList<WorkspaceTreeLocateLogRowRpcResult>(
    ctx,
    ctx.logTurns.locate,
    workspaceId,
    asked,
    async (_rootDir, list) => {
      const located = locateLogRow(list, target);
      return located.found
        ? { ok: true, list: list.generation.id, row: located.row }
        : { ok: false, reason: located.reason };
    },
  );
}
