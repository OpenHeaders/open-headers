/**
 * log-rows-ask — what a log tab asks the host to list
 * (`oh.workspaceTree.logRows`, `locateLogRow`): its scope, the row
 * filters, the order, the sifts and the folded linear runs. The ask is
 * the list's name at the host — two tabs that ask the same read one
 * list — so every part that is off is left out. Pure.
 */

import type { LogFolds } from './log-folds';
import type { LogRowsAsk } from './log-row-pages';
import { type GitLogScope, searchScopeWire } from './log-scope';
import type { GitLogWireFilters } from './toolbar/log-filters';

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
