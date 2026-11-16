/**
 * A caller's ask for a log's list as the histories take it, and the
 * histories' refusals as the log verbs answer them. Pure: what only the
 * repo knows is handed in.
 */

import { type CommitLogFilters, isLogTextAsk, LOG_SCOPE_HEAD, type LogTextAsk } from '../../git';
import type { LogAsk, LogListResult } from '../history';
import type { WorkspaceTreeLogListAsk, WorkspaceTreeLogListRefusal } from './types';

/**
 * The text field of an ask: undefined when the caller sent none, null
 * when what it sent is nothing a history is searched for.
 */
export function readLogText(asked: WorkspaceTreeLogListAsk): LogTextAsk | undefined | null {
  if (asked.text === undefined) return undefined;
  const text = { text: asked.text, regex: asked.regex === true, matchCase: asked.matchCase === true };
  return isLogTextAsk(text) ? text : null;
}

/** The list `asked` names — its row filters settled into plumbing shape, its text read. */
export function logAskOf(
  asked: WorkspaceTreeLogListAsk,
  filters: CommitLogFilters,
  text: LogTextAsk | undefined,
): LogAsk {
  const walked =
    filters.author !== undefined ||
    filters.authors !== undefined ||
    filters.since !== undefined ||
    filters.until !== undefined ||
    filters.paths !== undefined;
  return {
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
    text: text ?? null,
    folds: { all: asked.foldAll === true, runs: asked.folds ?? [] },
  };
}

/**
 * A list the histories refused, as the verb's answer. `isRepo` is asked
 * only for a history that could not be read: the folder may be no repo
 * at all.
 */
export async function logListRefusal(
  refused: Extract<LogListResult, { ok: false }>,
  isRepo: () => Promise<boolean>,
): Promise<WorkspaceTreeLogListRefusal> {
  if (refused.reason === 'unknown-ref') return { ok: false, reason: 'unknown-ref', unknownRefs: refused.unknownRefs };
  if (refused.reason === 'invalid-scope') return { ok: false, reason: 'unknown-ref' };
  if (refused.reason === 'invalid-text') return { ok: false, reason: 'invalid-filter' };
  if (refused.reason === 'timeout') return { ok: false, reason: 'log-timeout' };
  if (refused.reason === 'pattern-timeout') return { ok: false, reason: 'search-timeout' };
  if (!(await isRepo())) return { ok: false, reason: 'not-a-repo' };
  return { ok: false, reason: 'log-failed', detail: refused.reason };
}
