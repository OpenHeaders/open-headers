/**
 * log-tab-row — the tab's ONE commit as a row of the list drawn.
 *
 * The tab remembers a commit by its hash; the list selects by row
 * number, and a row number means something only under the list's two
 * names (`log-row-pages.ts`: what was asked, and the id the host
 * answers with). This is what joins the two: where the tab's commit
 * sits in the list the view holds, and what to do when that is not
 * known.
 *
 * A press knows its row and reads nothing. Anything else — a commit
 * navigated to, a list that changed under the tab — is asked of the
 * host (`oh.workspaceTree.locateLogRow`). A row walked to whose commit
 * is not read yet (an arrow to a far parent, a place Go To found)
 * stands for itself until its page lands and gives the tab its commit.
 * A commit the list leaves out stays the tab's and selects no row.
 * Pure.
 */

import { type LogRowPages, type LogRowsAsk, logRowAt } from './log-row-pages';

/** The tab's commit as a row of one list. */
export interface LogTabRow {
  /** The list's two names. */
  ask: LogRowsAsk;
  list: string;
  /** Where the commit is listed; null when the list leaves it out. */
  row: number | null;
  /** The commit; null for a row walked to whose commit is not read yet. */
  sha: string | null;
}

/** `known` is of the list the view holds. */
function ofHeld(known: LogTabRow | null, held: LogRowPages): known is LogTabRow {
  return known !== null && known.ask === held.ask && known.list === held.list;
}

/** Row `row` of the held list as the tab's — with its commit where its page is held; null while no list is. */
export function tabRowAt(held: LogRowPages, row: number): LogTabRow | null {
  if (held.ask === null || held.list === null) return null;
  return { ask: held.ask, list: held.list, row, sha: logRowAt(held, row)?.entry.sha ?? null };
}

/**
 * The host's answer to where a commit sits in the list `ask` names, as
 * the tab's row: null when it answers for another list than the one
 * held — the row is not this list's.
 */
export function tabRowFound(held: LogRowPages, ask: LogRowsAsk, list: string, row: number): LogTabRow | null {
  return held.ask === ask && held.list === list ? tabRowAt(held, row) : null;
}

/** The tab's commit `sha` as one the held list leaves out; null while no list is held. */
export function tabRowLeftOut(held: LogRowPages, sha: string): LogTabRow | null {
  if (held.ask === null || held.list === null) return null;
  return { ask: held.ask, list: held.list, row: null, sha };
}

/**
 * The row the held list selects as the tab's, the tab's commit being
 * `sha`: null where it is not known, or the list leaves the commit out.
 */
export function tabRowIn(known: LogTabRow | null, held: LogRowPages, sha: string | null): number | null {
  if (!ofHeld(known, held)) return null;
  // A row walked to is the tab's before its commit is: the tab still names the commit it walked from.
  if (known.sha === null) return known.row;
  return known.sha === sha ? known.row : null;
}

/** The commit to ask the host the row of; null when the tab has none, no list is held, or its row is known. */
export function tabRowToLocate(known: LogTabRow | null, held: LogRowPages, sha: string | null): string | null {
  if (held.ask === null) return null;
  if (ofHeld(known, held) && (known.sha === null || known.sha === sha)) return null;
  return sha;
}

/** The row walked to with its commit, once its page is held; null while there is nothing to take. */
export function tabRowRead(known: LogTabRow | null, held: LogRowPages): LogTabRow | null {
  if (!ofHeld(known, held) || known.sha !== null || known.row === null) return null;
  const sha = logRowAt(held, known.row)?.entry.sha;
  return sha === undefined ? null : { ...known, sha };
}

/** The held list is known to leave the tab's commit `sha` out. */
export function tabRowUnlisted(known: LogTabRow | null, held: LogRowPages, sha: string | null): boolean {
  return ofHeld(known, held) && known.sha === sha && known.row === null;
}
