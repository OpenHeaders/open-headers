/**
 * The rows a log view holds of a list the host keeps whole
 * (`panels/git/log-row-pages`): pages read once and kept under the
 * list's two names — what was asked and the id the host answers with —
 * the stretch to read next for the rows mounted, and the bound on the
 * pages kept. And what a tab asks the host to list
 * (`panels/git/log-rows-ask`).
 */

import type { WorkspaceTreeLogRowWire, WorkspaceTreeLogRunWire } from '@openheaders/core/bridge';
import { NO_LOG_FOLDS } from '@openheaders/ui/workbench/components/panels/git/log-folds';
import {
  LOG_PAGE_ROWS,
  LOG_PAGES_HELD,
  type LogRowPages,
  type LogRowsAnswer,
  type LogRowsAsk,
  logReadOver,
  logRowAt,
  logRunAt,
  NO_LOG_ROW_RANGE,
  NO_LOG_ROWS,
  nextLogRead,
  takeLogRows,
} from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import { logRowsAsk } from '@openheaders/ui/workbench/components/panels/git/log-rows-ask';
import { describe, expect, it } from 'vitest';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };
const OTHER: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true, noMerges: true };

const sha = (row: number): string => row.toString(16).padStart(40, '0');

function row(at: number, run?: number): WorkspaceTreeLogRowWire {
  return {
    entry: {
      sha: sha(at),
      parents: [sha(at + 1)],
      authorName: 'John Doe',
      authorEmail: 'john@openheaders.io',
      authoredAt: '2026-11-15T10:00:00.000Z',
      subject: `commit ${at}`,
      coAuthors: [],
      files: [],
      onHead: true,
    },
    cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
    parents: [at + 1],
    child: at - 1,
    ...(run !== undefined ? { run } : {}),
  };
}

const run = (number: number, top: number, bottom: number): WorkspaceTreeLogRunWire => ({
  run: number,
  first: sha(top + 1),
  top,
  bottom,
  hidden: bottom - top - 1,
  folded: false,
});

/** The host's answer to a read of `count` rows from `from` of a list of `total`. */
function answer(
  from: number,
  count: number,
  total: number,
  list = 'g1',
  runs: WorkspaceTreeLogRunWire[] = [],
): LogRowsAnswer {
  const rows: WorkspaceTreeLogRowWire[] = [];
  for (let at = from; at < Math.min(total, from + count); at += 1) rows.push(row(at, runs[0]?.run));
  return { ok: true, list, total, widest: 2, rows, runs };
}

const mounted = (first: number, last: number) => ({ first, last });

/** `ASK`'s list of `total` rows with the named pages held. */
function holding(total: number, pages: number[], at = mounted(0, 30)): LogRowPages {
  let held = NO_LOG_ROWS;
  for (const page of pages) {
    held = takeLogRows(held, ASK, page * LOG_PAGE_ROWS, answer(page * LOG_PAGE_ROWS, LOG_PAGE_ROWS, total), at);
  }
  return held;
}

describe('the stretch to read next', () => {
  it('reads a list not held yet where the view stands — its first page while nothing is mounted', () => {
    expect(nextLogRead(NO_LOG_ROWS, ASK, NO_LOG_ROW_RANGE)).toEqual({ from: 0, count: 200 });
    expect(nextLogRead(NO_LOG_ROWS, ASK, mounted(500_010, 500_090))).toEqual({ from: 500_000, count: 200 });
    expect(nextLogRead(NO_LOG_ROWS, ASK, mounted(500_150, 500_230))).toEqual({ from: 500_000, count: 400 });
  });

  it('reads the list of another ask from the start of its own name, whatever is held', () => {
    expect(nextLogRead(holding(1_000, [0, 1]), OTHER, mounted(10, 60))).toEqual({ from: 0, count: 200 });
  });

  it('reads the page a mounted row is missing from, and two at once where two are', () => {
    const held = holding(10_000, [0]);
    expect(nextLogRead(held, ASK, mounted(390, 470))).toEqual({ from: 200, count: 400 });
    expect(nextLogRead(holding(10_000, [0, 1]), ASK, mounted(390, 470))).toEqual({ from: 400, count: 200 });
    expect(nextLogRead(holding(10_000, [0, 2]), ASK, mounted(390, 470))).toEqual({ from: 200, count: 200 });
  });

  it('then reads a page ahead of the mounted rows, the one above first', () => {
    const held = holding(10_000, [5]);
    expect(nextLogRead(held, ASK, mounted(1_050, 1_150))).toEqual({ from: 800, count: 200 });
    expect(nextLogRead(holding(10_000, [4, 5]), ASK, mounted(1_050, 1_150))).toEqual({ from: 1_200, count: 200 });
    expect(nextLogRead(holding(10_000, [4, 5, 6]), ASK, mounted(1_050, 1_150))).toBeNull();
  });

  it('reads the first page of a held list while nothing is mounted, and nothing ahead of it', () => {
    expect(nextLogRead(holding(10_000, [5]), ASK, NO_LOG_ROW_RANGE)).toEqual({ from: 0, count: 200 });
    expect(nextLogRead(holding(10_000, [0]), ASK, NO_LOG_ROW_RANGE)).toBeNull();
  });

  it('never reads past either end of the list', () => {
    expect(nextLogRead(holding(250, [0, 1]), ASK, mounted(180, 249))).toBeNull();
    expect(nextLogRead(holding(250, [0]), ASK, mounted(0, 40))).toBeNull();
    expect(nextLogRead(holding(250, [0]), ASK, mounted(120, 180))).toEqual({ from: 200, count: 200 });
    // The view still stands where a longer list was: nothing of this one is there.
    expect(nextLogRead(holding(250, [0, 1]), ASK, mounted(5_000, 5_080))).toBeNull();
  });

  it('reads nothing of a list that holds no row', () => {
    const empty = takeLogRows(NO_LOG_ROWS, ASK, 0, answer(0, 200, 0), NO_LOG_ROW_RANGE);
    expect(empty.total).toBe(0);
    expect(nextLogRead(empty, ASK, NO_LOG_ROW_RANGE)).toBeNull();
  });

  it('reads the mounted rows’ own pages again as one stretch', () => {
    expect(logReadOver(NO_LOG_ROW_RANGE)).toEqual({ from: 0, count: 200 });
    expect(logReadOver(mounted(410, 520))).toEqual({ from: 400, count: 200 });
    expect(logReadOver(mounted(590, 700))).toEqual({ from: 400, count: 400 });
    expect(logReadOver(mounted(590, 1_300))).toEqual({ from: 400, count: 400 });
  });
});

describe('the rows held', () => {
  it('holds a row by its number, and none it has not read', () => {
    const held = takeLogRows(NO_LOG_ROWS, ASK, 400, answer(400, 400, 10_000), mounted(590, 700));
    expect(held).toMatchObject({ ask: ASK, list: 'g1', total: 10_000, widest: 2 });
    expect(logRowAt(held, 400)?.entry.subject).toBe('commit 400');
    expect(logRowAt(held, 599)?.entry.subject).toBe('commit 599');
    expect(logRowAt(held, 600)?.entry.subject).toBe('commit 600');
    expect(logRowAt(held, 799)?.entry.subject).toBe('commit 799');
    expect(logRowAt(held, 399)).toBeNull();
    expect(logRowAt(held, 800)).toBeNull();
    // Two pages asked at once are kept as two, each its own rows.
    expect([...held.pages].map(([page, { rows }]) => [page, rows.length])).toEqual([
      [2, 200],
      [3, 200],
    ]);
  });

  it('holds the short page a list ends on', () => {
    const held = takeLogRows(NO_LOG_ROWS, ASK, 200, answer(200, 200, 250), mounted(200, 249));
    expect(logRowAt(held, 249)?.entry.subject).toBe('commit 249');
    expect(logRowAt(held, 250)).toBeNull();
  });

  it('keeps what it read when more of the same list lands', () => {
    const first = holding(10_000, [0]);
    const both = takeLogRows(first, ASK, 200, answer(200, 200, 10_000), mounted(150, 260));
    expect(logRowAt(both, 10)).toBe(logRowAt(first, 10));
    expect(logRowAt(both, 210)?.entry.subject).toBe('commit 210');
  });

  it('drops every row when the host names another list — the history was read anew', () => {
    const anew = takeLogRows(holding(10_000, [0, 1]), ASK, 200, answer(200, 200, 10_003, 'g2'), mounted(210, 290));
    expect(anew).toMatchObject({ list: 'g2', total: 10_003 });
    expect(logRowAt(anew, 10)).toBeNull();
    expect(logRowAt(anew, 210)?.entry.subject).toBe('commit 210');
  });

  it('drops every row when the answer is another ask’s, the host’s id the same', () => {
    const other = takeLogRows(holding(10_000, [0, 1]), OTHER, 0, answer(0, 200, 9_000), mounted(0, 30));
    expect(other).toMatchObject({ ask: OTHER, list: 'g1', total: 9_000 });
    expect(logRowAt(other, 210)).toBeNull();
  });

  it('takes the list’s length from an answer that reached past its end', () => {
    const past = takeLogRows(NO_LOG_ROWS, ASK, 5_000, answer(5_000, 200, 12), mounted(5_010, 5_090));
    expect(past.total).toBe(12);
    expect(past.pages.size).toBe(0);
    expect(nextLogRead(past, ASK, mounted(0, 11))).toEqual({ from: 0, count: 200 });
  });

  it('names a run by the row that carries it', () => {
    const runs = [run(7, 410, 440)];
    const held = takeLogRows(NO_LOG_ROWS, ASK, 400, answer(400, 200, 10_000, 'g1', runs), mounted(410, 470));
    expect(logRowAt(held, 420)?.run).toBe(7);
    expect(logRunAt(held, 420, 7)).toEqual(runs[0]);
    expect(logRunAt(held, 420, 8)).toBeNull();
    expect(logRunAt(held, 20, 7)).toBeNull();
  });
});

describe('the bound on the pages kept', () => {
  const pagesOf = (held: LogRowPages): number[] => [...held.pages.keys()].sort((a, b) => a - b);

  it('keeps the pages nearest the mounted rows', () => {
    let held = NO_LOG_ROWS;
    for (let page = 0; page < LOG_PAGES_HELD + 4; page += 1) {
      const from = page * LOG_PAGE_ROWS;
      held = takeLogRows(held, ASK, from, answer(from, LOG_PAGE_ROWS, 100_000), mounted(from + 10, from + 90));
    }
    expect(held.pages.size).toBe(LOG_PAGES_HELD);
    expect(pagesOf(held)).toEqual(Array.from({ length: LOG_PAGES_HELD }, (_, at) => at + 4));
  });

  it('lets go of the page just read when the view has moved far from it', () => {
    const near = Array.from({ length: LOG_PAGES_HELD }, (_, at) => at);
    const held = takeLogRows(holding(100_000, near), ASK, 80_000, answer(80_000, 200, 100_000), mounted(10, 90));
    expect(pagesOf(held)).toEqual(near);
  });

  it('counts the distance from either end of the mounted rows', () => {
    // The mounted rows sit on pages 10 to 12: page 2 is eight away, page 19 is seven.
    const at = mounted(2_000, 2_599);
    const around = [2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 10];
    expect(around).toHaveLength(LOG_PAGES_HELD);
    const held = takeLogRows(holding(100_000, around, at), ASK, 2_200, answer(2_200, 200, 100_000), at);
    expect(pagesOf(held)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19]);
  });
});

describe('what a tab asks the host to list', () => {
  const parts = {
    workspaceId: 'ws-1',
    key: 'log:1',
    scope: [] as string[],
    filters: {},
    noMerges: false,
    firstParent: false,
    folds: NO_LOG_FOLDS,
  };

  it('asks for every ref with nothing else, each part that is off left out', () => {
    expect(logRowsAsk(parts)).toEqual({ workspaceId: 'ws-1', key: 'log:1', allRefs: true });
  });

  it('sends the checked-out commit’s history as no scope, and refs walked together as a list', () => {
    expect(logRowsAsk({ ...parts, scope: ['HEAD'] })).toEqual({ workspaceId: 'ws-1', key: 'log:1' });
    expect(logRowsAsk({ ...parts, scope: ['main'] })).toEqual({ workspaceId: 'ws-1', key: 'log:1', refs: ['main'] });
    expect(logRowsAsk({ ...parts, scope: ['HEAD', 'origin/main'] }).refs).toEqual(['HEAD', 'origin/main']);
  });

  it('carries the row filters, the order and the sifts', () => {
    expect(
      logRowsAsk({
        ...parts,
        filters: {
          authorMe: true,
          since: '2026-11-01',
          until: '2026-11-15T23:59:59',
          paths: ['docs'],
          topoOrder: true,
        },
        noMerges: true,
        firstParent: true,
      }),
    ).toEqual({
      workspaceId: 'ws-1',
      key: 'log:1',
      allRefs: true,
      authorMe: true,
      since: '2026-11-01',
      until: '2026-11-15T23:59:59',
      paths: ['docs'],
      topoOrder: true,
      noMerges: true,
      firstParent: true,
    });
    expect(logRowsAsk({ ...parts, filters: { author: 'John Doe' } }).author).toBe('John Doe');
    expect(logRowsAsk({ ...parts, filters: { authors: ['John Doe', 'Jane Doe'] } }).authors).toEqual([
      'John Doe',
      'Jane Doe',
    ]);
  });

  it('names the folded runs, and every run folded but the named ones', () => {
    expect(logRowsAsk({ ...parts, folds: { all: false, runs: [sha(4)] } })).toMatchObject({ folds: [sha(4)] });
    expect(logRowsAsk({ ...parts, folds: { all: false, runs: [sha(4)] } }).foldAll).toBeUndefined();
    expect(logRowsAsk({ ...parts, folds: { all: true, runs: [] } })).toEqual({
      workspaceId: 'ws-1',
      key: 'log:1',
      allRefs: true,
      foldAll: true,
    });
    expect(logRowsAsk({ ...parts, folds: { all: true, runs: [sha(9)] } })).toMatchObject({
      foldAll: true,
      folds: [sha(9)],
    });
  });
});
