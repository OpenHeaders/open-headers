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
 * The ask that finds the row makes the list, so a list the host refuses
 * is refused THERE: that refusal is the ask's own, and no row is read
 * after it — a read would make the host refuse the same list again,
 * after the same wait.
 *
 * Pure — the ask is `use-log-entrance.ts`.
 */

import type { WorkspaceTreeLocateLogRowWire } from '@openheaders/core/bridge';
import type { LogRowsAsk, LogRowsRefusal } from './log-row-pages';

/** Where the list `ask` names is entered. */
export type LogEntrance =
  /** On the tab's commit `sha`: row `row` of the reading the host names `list`. */
  | { ask: LogRowsAsk; row: number; list: string; sha: string }
  /** From its top: the tab has no commit, the list leaves it out, or the host did not say. */
  | { ask: LogRowsAsk; row: null }
  /** Not at all: the host refused the list. Asked for again, it is read from its top. */
  | { ask: LogRowsAsk; row: null; refusal: LogRowsRefusal };

/** A list's entrance as a view takes it: known, being found, or none while nothing is asked. */
export type LogEntranceState = LogEntrance | 'finding' | null;

/** The entrance to `ask`'s list with no commit to stand on. */
export function logEntranceAtTop(ask: LogRowsAsk): LogEntrance {
  return { ask, row: null };
}

/** The host refused the LIST — it did not say the commit sits on no row of it. */
function refusesList(answer: Extract<WorkspaceTreeLocateLogRowWire, { ok: false }>): answer is LogRowsRefusal {
  return answer.reason !== 'not-listed' && answer.reason !== 'not-found';
}

/**
 * The entrance the host's answer to "where is `sha` in `ask`'s list"
 * gives. A commit the list leaves out, one the history does not hold
 * and an ask a newer one took the place of say nothing against the
 * list; any other refusal is the list's.
 */
export function logEntranceFound(ask: LogRowsAsk, sha: string, answer: WorkspaceTreeLocateLogRowWire): LogEntrance {
  if (answer.ok) return { ask, row: answer.row, list: answer.list, sha };
  if (!refusesList(answer) || answer.reason === 'superseded') return logEntranceAtTop(ask);
  return { ask, row: null, refusal: answer };
}

/** What the host refused the list with where it was to be entered; null for a list that is entered. */
export function logEntranceRefusal(entrance: LogEntrance): LogRowsRefusal | null {
  return 'refusal' in entrance ? entrance.refusal : null;
}
