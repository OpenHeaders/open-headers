/**
 * The tab's ONE commit as a row of the list drawn
 * (`panels/git/log-tab-row`): a press knows its row; a commit whose row
 * is not known under the held list's two names is asked of the host; a
 * row walked to stands for itself until its page gives the tab its
 * commit; a commit the list leaves out stays the tab's and selects no
 * row.
 */

import type { WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import {
  LOG_PAGE_ROWS,
  type LogRowPages,
  type LogRowsAnswer,
  type LogRowsAsk,
  NO_LOG_ROWS,
  takeLogRows,
} from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import {
  type LogTabRow,
  tabRowAt,
  tabRowFound,
  tabRowIn,
  tabRowLeftOut,
  tabRowRead,
  tabRowToLocate,
  tabRowUnlisted,
} from '@openheaders/ui/workbench/components/panels/git/log-tab-row';
import { describe, expect, it } from 'vitest';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };
const OTHER: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true, noMerges: true };

const sha = (row: number): string => row.toString(16).padStart(40, '0');

function row(at: number): WorkspaceTreeLogRowWire {
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
    },
    cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
    parents: [at + 1],
    child: at - 1,
  };
}

function answer(from: number, total: number, list: string): LogRowsAnswer {
  const rows: WorkspaceTreeLogRowWire[] = [];
  for (let at = from; at < Math.min(total, from + LOG_PAGE_ROWS); at += 1) rows.push(row(at));
  return { ok: true, list, total, widest: 1, rows, runs: [] };
}

/** A list of 10,000 rows with the named pages held, under the two names given. */
function holding(pages: number[], ask = ASK, list = 'g1'): LogRowPages {
  let held = NO_LOG_ROWS;
  for (const page of pages) {
    const from = page * LOG_PAGE_ROWS;
    held = takeLogRows(held, ask, from, answer(from, 10_000, list), { first: from, last: from + 30 });
  }
  return held;
}

const HELD = holding([0]);
const at = (rowNumber: number | null, commit: string | null, ask = ASK, list = 'g1'): LogTabRow => ({
  ask,
  list,
  row: rowNumber,
  sha: commit,
});

describe('a row pressed or walked to', () => {
  it('is the tab’s with its commit where its page is held', () => {
    expect(tabRowAt(HELD, 7)).toEqual(at(7, sha(7)));
  });

  it('is the tab’s with no commit yet where its page is not', () => {
    expect(tabRowAt(HELD, 4_321)).toEqual(at(4_321, null));
  });

  it('is no one’s while no list is held', () => {
    expect(tabRowAt(NO_LOG_ROWS, 0)).toBeNull();
  });
});

describe('the row the list selects as the tab’s', () => {
  it('is the row known for the tab’s commit under the held list’s two names', () => {
    expect(tabRowIn(at(7, sha(7)), HELD, sha(7))).toBe(7);
  });

  it('is none while nothing is known', () => {
    expect(tabRowIn(null, HELD, sha(7))).toBeNull();
  });

  it('is none for a row known under another ask, or under another id of the host’s', () => {
    expect(tabRowIn(at(7, sha(7), OTHER), HELD, sha(7))).toBeNull();
    expect(tabRowIn(at(7, sha(7), ASK, 'g2'), HELD, sha(7))).toBeNull();
    expect(tabRowIn(at(7, sha(7)), holding([0], OTHER), sha(7))).toBeNull();
    expect(tabRowIn(at(7, sha(7)), holding([0], ASK, 'g2'), sha(7))).toBeNull();
  });

  it('is none once the tab names another commit than the row’s, or none at all', () => {
    expect(tabRowIn(at(7, sha(7)), HELD, sha(9))).toBeNull();
    expect(tabRowIn(at(7, sha(7)), HELD, null)).toBeNull();
  });

  it('is a row walked to before its commit is read — the tab still names the commit it walked from', () => {
    expect(tabRowIn(at(4_321, null), HELD, sha(7))).toBe(4_321);
    expect(tabRowIn(at(4_321, null), HELD, null)).toBe(4_321);
  });

  it('is none for a commit the list leaves out', () => {
    expect(tabRowIn(at(null, sha(7)), HELD, sha(7))).toBeNull();
  });
});

describe('the commit to ask the host the row of', () => {
  it('is the tab’s commit while nothing is known of it', () => {
    expect(tabRowToLocate(null, HELD, sha(7))).toBe(sha(7));
  });

  it('is none while the tab has no commit, or no list is held', () => {
    expect(tabRowToLocate(null, HELD, null)).toBeNull();
    expect(tabRowToLocate(null, NO_LOG_ROWS, sha(7))).toBeNull();
    expect(tabRowToLocate(at(7, sha(7)), NO_LOG_ROWS, sha(7))).toBeNull();
  });

  it('is none once its row is known in the held list — listed or left out', () => {
    expect(tabRowToLocate(at(7, sha(7)), HELD, sha(7))).toBeNull();
    expect(tabRowToLocate(at(null, sha(7)), HELD, sha(7))).toBeNull();
  });

  it('is the tab’s commit again under another ask, and under another id of the host’s', () => {
    expect(tabRowToLocate(at(7, sha(7)), holding([0], OTHER), sha(7))).toBe(sha(7));
    expect(tabRowToLocate(at(7, sha(7)), holding([0], ASK, 'g2'), sha(7))).toBe(sha(7));
  });

  it('is the commit the tab moved to, where the row known is another’s', () => {
    expect(tabRowToLocate(at(7, sha(7)), HELD, sha(9))).toBe(sha(9));
  });

  it('is none for a row walked to: its commit comes with its page', () => {
    expect(tabRowToLocate(at(4_321, null), HELD, sha(7))).toBeNull();
  });
});

describe('the host’s answer to where a commit sits', () => {
  it('is the tab’s row in the held list, with its commit where its page is held', () => {
    expect(tabRowFound(HELD, ASK, 'g1', 12)).toEqual(at(12, sha(12)));
    expect(tabRowFound(HELD, ASK, 'g1', 4_321)).toEqual(at(4_321, null));
  });

  it('is no row of the held list when it answers for another ask or another id', () => {
    expect(tabRowFound(HELD, OTHER, 'g1', 12)).toBeNull();
    expect(tabRowFound(HELD, ASK, 'g2', 12)).toBeNull();
  });

  it('keeps a commit the list leaves out as the tab’s, on no row', () => {
    expect(tabRowLeftOut(HELD, sha(7))).toEqual(at(null, sha(7)));
    expect(tabRowLeftOut(NO_LOG_ROWS, sha(7))).toBeNull();
  });
});

describe('a row walked to, once its page is held', () => {
  it('takes its commit from the page', () => {
    expect(tabRowRead(at(230, null), holding([0, 1]))).toEqual(at(230, sha(230)));
  });

  it('takes nothing while its page is not held', () => {
    expect(tabRowRead(at(230, null), HELD)).toBeNull();
  });

  it('takes nothing for a row whose commit is known, a commit left out, or no row at all', () => {
    expect(tabRowRead(at(7, sha(7)), HELD)).toBeNull();
    expect(tabRowRead(at(null, sha(7)), HELD)).toBeNull();
    expect(tabRowRead(null, HELD)).toBeNull();
  });

  it('takes nothing from another list’s page', () => {
    expect(tabRowRead(at(7, null, OTHER), HELD)).toBeNull();
    expect(tabRowRead(at(7, null, ASK, 'g2'), HELD)).toBeNull();
  });
});

describe('a commit the held list is known to leave out', () => {
  it('is the tab’s commit, known under the held list’s names, on no row', () => {
    expect(tabRowUnlisted(at(null, sha(7)), HELD, sha(7))).toBe(true);
  });

  it('is not one that is listed, one not known yet, or another commit than the tab’s', () => {
    expect(tabRowUnlisted(at(7, sha(7)), HELD, sha(7))).toBe(false);
    expect(tabRowUnlisted(null, HELD, sha(7))).toBe(false);
    expect(tabRowUnlisted(at(null, sha(7)), HELD, sha(9))).toBe(false);
    expect(tabRowUnlisted(at(null, sha(7)), HELD, null)).toBe(false);
  });

  it('is not known of another list', () => {
    expect(tabRowUnlisted(at(null, sha(7), OTHER), HELD, sha(7))).toBe(false);
    expect(tabRowUnlisted(at(null, sha(7), ASK, 'g2'), HELD, sha(7))).toBe(false);
  });
});
