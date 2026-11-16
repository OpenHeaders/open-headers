/**
 * log-rows-ask — what a log tab asks the host to list
 * (`oh.workspaceTree.logRows`, `locateLogRow`): its scope, the row
 * filters, the order, the sifts, the text field and the folded linear
 * runs. The ask is the list's name at the host — two tabs that ask the
 * same read one list — so every part that is off is left out. Pure.
 */

import type { LogFolds } from './log-folds';
import type { LogRowsAsk } from './log-row-pages';
import { type GitLogScope, logRowsScopeWire } from './log-scope';
import type { GitLogWireFilters } from './toolbar/log-filters';

/** The text field as it is applied: what to match, and how. */
export interface LogRowsText {
  text: string;
  regex: boolean;
  matchCase: boolean;
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
  /** The applied text — every commit of the history it matches is listed; null with none applied. */
  text: LogRowsText | null;
  folds: LogFolds;
}

export function logRowsAsk(parts: LogRowsAskParts): LogRowsAsk {
  const { author, authors, authorMe, since, until, paths, topoOrder } = parts.filters;
  const { text } = parts;
  return {
    workspaceId: parts.workspaceId,
    key: parts.key,
    ...logRowsScopeWire(parts.scope),
    ...(author !== undefined ? { author } : {}),
    ...(authors !== undefined ? { authors } : {}),
    ...(authorMe === true ? { authorMe: true } : {}),
    ...(since !== undefined ? { since } : {}),
    ...(until !== undefined ? { until } : {}),
    ...(paths !== undefined ? { paths } : {}),
    ...(topoOrder === true ? { topoOrder: true } : {}),
    ...(parts.noMerges ? { noMerges: true } : {}),
    ...(parts.firstParent ? { firstParent: true } : {}),
    // A text matches without the blanks typed around it: they name no other list.
    ...(text !== null ? { text: text.text.trim() } : {}),
    ...(text?.regex === true ? { regex: true } : {}),
    ...(text?.matchCase === true ? { matchCase: true } : {}),
    ...(parts.folds.all ? { foldAll: true } : {}),
    ...(parts.folds.runs.length > 0 ? { folds: [...parts.folds.runs] } : {}),
  };
}

/**
 * What an ask lists before its folds — its scope, its filters, its
 * text, its order. Two asks of one listing differ by a folded run
 * alone, and the rows a person is looking at stay where they are;
 * another listing is another list to look at, entered on the tab's
 * commit.
 */
export function logListingName(ask: LogRowsAsk): string {
  return JSON.stringify({ ...ask, foldAll: undefined, folds: undefined });
}
