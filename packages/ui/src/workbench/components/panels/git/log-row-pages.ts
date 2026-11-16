/**
 * log-row-pages — the rows a log view holds of a list the host keeps
 * whole (`oh.workspaceTree.logRows`): pages of a fixed size, each read
 * once and kept while the list stands.
 *
 * A row is a NUMBER in a list, and a list is named twice over: by what
 * was asked (the scope, the order, the sifts, the folded runs) and by
 * the id the host answers with, which changes when the history was read
 * anew. Rows held under either other name are another list's — an
 * answer that names another drops every one of them.
 *
 * Only so many pages are kept: the ones nearest the rows the view has
 * mounted. Pure — the read itself is `use-log-rows.ts`.
 */

import type {
  WorkspaceTreeLogAskWire,
  WorkspaceTreeLogRowsWire,
  WorkspaceTreeLogRowWire,
  WorkspaceTreeLogRunWire,
} from '@openheaders/core/bridge';

/** Rows a page — half of what one read may ask the host for. */
export const LOG_PAGE_ROWS = 200;
/** Pages kept. */
export const LOG_PAGES_HELD = 16;
/** Rows read past the mounted ones, each way, so a scroll meets rows already held. */
const READ_AHEAD_ROWS = 100;

/** What a log asks to be listed — one object while what it asks stands. */
export type LogRowsAsk = WorkspaceTreeLogAskWire;
export type LogRowsAnswer = Extract<WorkspaceTreeLogRowsWire, { ok: true }>;
/** What the host refuses a list with — the same whichever verb asked for the list. */
export type LogRowsRefusal = Extract<WorkspaceTreeLogRowsWire, { ok: false }>;

/**
 * The host gave the list up as out of time — its pattern, or its
 * history, texts or walk: the one refusal that cost its whole wait, and
 * would cost it again asked again.
 */
export function logRefusalOutOfTime(refusal: LogRowsRefusal): boolean {
  return refusal.reason === 'search-timeout' || refusal.reason === 'log-timeout';
}

/** The rows a view has mounted: `[first, last]`, both inclusive. */
export interface LogRowRange {
  first: number;
  last: number;
}

/** No row mounted yet — the view stands at the list's start. */
export const NO_LOG_ROW_RANGE: LogRowRange = { first: 0, last: -1 };

/** A stretch to ask the host for. */
export interface LogRowStretch {
  from: number;
  count: number;
}

interface LogRowPage {
  rows: readonly WorkspaceTreeLogRowWire[];
  /** The runs the page's rows and their edges name, by number. */
  runs: ReadonlyMap<number, WorkspaceTreeLogRunWire>;
}

export interface LogRowPages {
  /** What the held rows were asked as; null while none is held. */
  ask: LogRowsAsk | null;
  /** The id the host names their list by. */
  list: string | null;
  /** How many rows the list holds. */
  total: number;
  /** The most lanes any row of the list occupies. */
  widest: number;
  pages: ReadonlyMap<number, LogRowPage>;
}

export const NO_LOG_ROWS: LogRowPages = { ask: null, list: null, total: 0, widest: 0, pages: new Map() };

const pageOf = (row: number): number => Math.floor(row / LOG_PAGE_ROWS);

/** Row `row` of the held list; null for one not read yet. */
export function logRowAt(held: LogRowPages, row: number): WorkspaceTreeLogRowWire | null {
  return held.pages.get(pageOf(row))?.rows[row - pageOf(row) * LOG_PAGE_ROWS] ?? null;
}

/** The run `run` as row `row`, or an edge of its cell, names it; null where the row is not held. */
export function logRunAt(held: LogRowPages, row: number, run: number): WorkspaceTreeLogRunWire | null {
  return held.pages.get(pageOf(row))?.runs.get(run) ?? null;
}

/** The authors of the rows held, each name once, in the locale's order — what the User filter offers. */
export function heldLogAuthors(held: LogRowPages): string[] {
  const names = new Set<string>();
  for (const page of held.pages.values()) {
    for (const row of page.rows) names.add(row.entry.authorName);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Rows taken each way of a row a view will stand on, while the view has not said how many it mounts. */
const ROWS_AROUND = 50;

/** The rows a view mounts once it stands on `row`: as many as it has mounted now, `row` in their middle. */
export function logRowsAround(row: number, mounted: LogRowRange): LogRowRange {
  const half = mounted.last >= mounted.first ? Math.ceil((mounted.last - mounted.first) / 2) : ROWS_AROUND;
  return { first: Math.max(0, row - half), last: row + half };
}

/** The pages the mounted rows sit on — the list's first while none is mounted. */
function mountedPages(mounted: LogRowRange): { first: number; last: number } {
  return { first: pageOf(Math.max(0, mounted.first)), last: pageOf(Math.max(0, mounted.last)) };
}

/** The mounted rows' own pages as one read — the first two where they span more. */
export function logReadOver(mounted: LogRowRange): LogRowStretch {
  const { first, last } = mountedPages(mounted);
  return { from: first * LOG_PAGE_ROWS, count: (last > first ? 2 : 1) * LOG_PAGE_ROWS };
}

/**
 * The stretch to read next for `ask`, or null when the view has what it
 * shows: a list not held yet is read where the view stands; a held one
 * is read where a mounted row is missing — two pages at once where two
 * are — and then a page ahead of the mounted rows, each way.
 */
export function nextLogRead(held: LogRowPages, ask: LogRowsAsk, mounted: LogRowRange): LogRowStretch | null {
  if (held.ask !== ask) return logReadOver(mounted);
  // A list with no row has no page: its last one is under its first.
  const lastPage = pageOf(held.total - 1);
  const missing = (page: number): boolean => page >= 0 && page <= lastPage && !held.pages.has(page);
  const { first, last } = mountedPages(mounted);
  for (let page = first; page <= last; page += 1) {
    if (!missing(page)) continue;
    const both = page < last && missing(page + 1);
    return { from: page * LOG_PAGE_ROWS, count: (both ? 2 : 1) * LOG_PAGE_ROWS };
  }
  for (const page of [pageOf(mounted.first - READ_AHEAD_ROWS), pageOf(mounted.last + READ_AHEAD_ROWS)]) {
    if (missing(page)) return { from: page * LOG_PAGE_ROWS, count: LOG_PAGE_ROWS };
  }
  return null;
}

/** How many pages `page` is from the mounted rows' own. */
function distance(page: number, near: { first: number; last: number }): number {
  if (page < near.first) return near.first - page;
  return page > near.last ? page - near.last : 0;
}

/**
 * The held rows with the host's answer to a read of `ask` from row
 * `from` — a stretch as {@link nextLogRead} names one. An answer of
 * another list than the held one starts from nothing. Past
 * {@link LOG_PAGES_HELD} the pages farthest from the mounted rows go.
 */
export function takeLogRows(
  held: LogRowPages,
  ask: LogRowsAsk,
  from: number,
  answer: LogRowsAnswer,
  mounted: LogRowRange,
): LogRowPages {
  const same = held.ask === ask && held.list === answer.list;
  const pages = new Map(same ? held.pages : []);
  const runs = new Map(answer.runs.map((run) => [run.run, run]));
  for (let at = 0; at < answer.rows.length; at += LOG_PAGE_ROWS) {
    pages.set(pageOf(from + at), { rows: answer.rows.slice(at, at + LOG_PAGE_ROWS), runs });
  }
  const near = mountedPages(mounted);
  while (pages.size > LOG_PAGES_HELD) {
    let farthest = -1;
    for (const page of pages.keys()) {
      if (farthest === -1 || distance(page, near) > distance(farthest, near)) farthest = page;
    }
    pages.delete(farthest);
  }
  return { ask, list: answer.list, total: answer.total, widest: answer.widest, pages };
}
