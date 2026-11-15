/**
 * log-rows-ask — what a log tab asks the host to list
 * (`oh.workspaceTree.logRows`, `locateLogRow`): its scope, the row
 * filters, the order, the sifts and the folded linear runs. The ask is
 * the list's name at the host — two tabs that ask the same read one
 * list — so every part that is off is left out. Pure.
 */

import type { LogRowsAsk } from './log-row-pages';
import { type GitLogScope, searchScopeWire } from './log-scope';
import type { GitLogWireFilters } from './toolbar/log-filters';

/** The linear runs a tab folds, each named by the hash of the first commit it hides. */
export interface LogFolds {
  /** Every run is folded (Collapse Linear Branches) — and `runs` names the ones opened again. */
  all: boolean;
  runs: readonly string[];
}

export const NO_LOG_FOLDS: LogFolds = { all: false, runs: [] };

/** The folds after a press on a run's dot: a folded run opens, an open one folds. */
export function toggleLogFold(folds: LogFolds, first: string, folded: boolean): LogFolds {
  const runs = folds.runs.filter((sha) => sha !== first);
  // Under `all` the named runs are the OPEN ones: a press names a run to open it, and takes its name out to fold it.
  const named = folded === folds.all;
  return { all: folds.all, runs: named ? [...runs, first] : runs };
}

export interface LogRowsAskParts {
  workspaceId: string;
  /** The surface that asks (the log tab) — at the host its newer read ends its older one. */
  key: string;
  /** The refs the log walks. */
  scope: GitLogScope;
  /** The log's own wire filters — User, Date, Paths and the order. */
  filters: GitLogWireFilters;
  noMerges: boolean;
  firstParent: boolean;
  folds: LogFolds;
}

export function logRowsAsk(parts: LogRowsAskParts): LogRowsAsk {
  const { author, authors, authorMe, since, until, paths, topoOrder } = parts.filters;
  return {
    workspaceId: parts.workspaceId,
    key: parts.key,
    ...searchScopeWire(parts.scope),
    ...(author !== undefined ? { author } : {}),
    ...(authors !== undefined ? { authors } : {}),
    ...(authorMe === true ? { authorMe: true } : {}),
    ...(since !== undefined ? { since } : {}),
    ...(until !== undefined ? { until } : {}),
    ...(paths !== undefined ? { paths } : {}),
    ...(topoOrder === true ? { topoOrder: true } : {}),
    ...(parts.noMerges ? { noMerges: true } : {}),
    ...(parts.firstParent ? { firstParent: true } : {}),
    ...(parts.folds.all ? { foldAll: true } : {}),
    ...(parts.folds.runs.length > 0 ? { folds: [...parts.folds.runs] } : {}),
  };
}
