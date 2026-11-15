/**
 * log-entrance — where a list is first looked at.
 *
 * Another listing (what is asked before its folds) is another list to
 * look at: on the tab's commit where the new list has it, else from its
 * top. That row is found BEFORE any of the list's rows is read — the
 * ask that finds it makes the list at the host — so the first rows read
 * are the ones looked at, and the view moves once, when they land, over
 * no row it does not hold. Until then the rows of the list before stay
 * where they are.
 *
 * Pure — the ask is `use-log-entrance.ts`.
 */

import type { WorkspaceTreeLocateLogRowWire } from '@openheaders/core/bridge';
import type { LogRowsAsk } from './log-row-pages';

/** Where the list `ask` names is entered. */
export type LogEntrance =
  /** On the tab's commit `sha`: row `row` of the reading the host names `list`. */
  | { ask: LogRowsAsk; row: number; list: string; sha: string }
  /** From its top: the tab has no commit, the list leaves it out, or the host did not say. */
  | { ask: LogRowsAsk; row: null };

/** A list's entrance as a view takes it: known, being found, or none while nothing is asked. */
export type LogEntranceState = LogEntrance | 'finding' | null;

/** The entrance to `ask`'s list with no commit to stand on. */
export function logEntranceAtTop(ask: LogRowsAsk): LogEntrance {
  return { ask, row: null };
}

/** The entrance the host's answer to "where is `sha` in `ask`'s list" gives. */
export function logEntranceFound(ask: LogRowsAsk, sha: string, answer: WorkspaceTreeLocateLogRowWire): LogEntrance {
  return answer.ok ? { ask, row: answer.row, list: answer.list, sha } : logEntranceAtTop(ask);
}
