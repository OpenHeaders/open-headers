/**
 * What the commit menu covers when it opens on a row of the list over
 * row numbers (`panels/git/log-row-menu-target`): the row alone with
 * the rows its walks go to, or the selection it sits in — which covers
 * no commit until its commits are read.
 */

import type { WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import type { RowRange } from '@openheaders/ui/shared/selection';
import { logRowMenuTarget } from '@openheaders/ui/workbench/components/panels/git/log-row-menu-target';
import {
  LOG_PAGE_ROWS,
  type LogRowPages,
  type LogRowsAsk,
  NO_LOG_ROWS,
  takeLogRows,
} from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import type { SelectedSet } from '@openheaders/ui/workbench/components/panels/git/log-selected-commits';
import { describe, expect, it } from 'vitest';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };
const TOTAL = 150;

const sha = (row: number): string => row.toString(16).padStart(40, '0');

/** Row 0 has no child; row 20 is a merge; the last row is the first commit and row 148 joins a commit just past the list's end. */
function row(at: number): WorkspaceTreeLogRowWire {
  const parents = at === TOTAL - 1 ? [] : at === 20 ? [sha(21), sha(40)] : [sha(at + 1)];
  return {
    entry: {
      sha: sha(at),
      parents,
      authorName: 'John Doe',
      authorEmail: 'john@openheaders.io',
      authoredAt: '2026-11-15T10:00:00.000Z',
      subject: `commit ${at}`,
      coAuthors: [],
      files: [],
    },
    cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
    parents: at === TOTAL - 1 ? [] : at === 148 ? [TOTAL] : at === 20 ? [21, 40] : [at + 1],
    child: at - 1,
  };
}

const held: LogRowPages = takeLogRows(
  NO_LOG_ROWS,
  ASK,
  0,
  {
    ok: true,
    list: 'g1',
    total: TOTAL,
    widest: 1,
    rows: Array.from({ length: TOTAL }, (_, at) => row(at)),
    runs: [],
  },
  { first: 0, last: 30 },
);

const range = (first: number, last: number): RowRange => ({ first, last });
const NONE: SelectedSet = { kind: 'none' };
const commits = (...rows: number[]): SelectedSet => ({ kind: 'commits', entries: rows.map((at) => row(at).entry) });

describe('the menu on a row alone', () => {
  it('covers the row’s commit and walks to the rows its child and its first parent sit on', () => {
    expect(logRowMenuTarget(held, [], NONE, 7)).toEqual({ shas: [sha(7)], child: 6, parent: 8, applies: true });
  });

  it('has no child at the list’s first row — and row 0 is a place to walk to', () => {
    expect(logRowMenuTarget(held, [], NONE, 0)).toEqual({ shas: [sha(0)], child: null, parent: 1, applies: true });
    expect(logRowMenuTarget(held, [], NONE, 1).child).toBe(0);
  });

  it('has no parent where the join leaves the list, or the commit has none', () => {
    expect(logRowMenuTarget(held, [], NONE, 148)).toMatchObject({ parent: null, applies: true });
    expect(logRowMenuTarget(held, [], NONE, TOTAL - 1)).toEqual({
      shas: [sha(TOTAL - 1)],
      child: TOTAL - 2,
      parent: null,
      applies: false,
    });
  });

  it('walks to a merge’s FIRST parent, and no pick takes a merge', () => {
    expect(logRowMenuTarget(held, [], NONE, 20)).toMatchObject({ parent: 21, applies: false });
  });

  it('covers a row selected alone as itself', () => {
    expect(logRowMenuTarget(held, [range(7, 7)], commits(7), 7)).toEqual({
      shas: [sha(7)],
      child: 6,
      parent: 8,
      applies: true,
    });
  });

  it('covers a row outside a wider selection as itself', () => {
    expect(logRowMenuTarget(held, [range(3, 5)], commits(3, 4, 5), 7)).toEqual({
      shas: [sha(7)],
      child: 6,
      parent: 8,
      applies: true,
    });
  });

  it('covers no commit on a row that is not read', () => {
    expect(logRowMenuTarget(held, [], NONE, LOG_PAGE_ROWS + 5)).toEqual({
      shas: null,
      child: null,
      parent: null,
      applies: false,
    });
  });
});

describe('the menu on a row of a wider selection', () => {
  it('covers the set’s commits in list order, with no walk', () => {
    expect(logRowMenuTarget(held, [range(3, 5)], commits(3, 4, 5), 4)).toEqual({
      shas: [sha(3), sha(4), sha(5)],
      child: null,
      parent: null,
      applies: true,
    });
  });

  it('covers a set of two as a set', () => {
    expect(logRowMenuTarget(held, [range(3, 4)], commits(3, 4), 3)).toEqual({
      shas: [sha(3), sha(4)],
      child: null,
      parent: null,
      applies: true,
    });
  });

  it('is told a pick does not take a set that holds a merge or the first commit', () => {
    expect(logRowMenuTarget(held, [range(19, 21)], commits(19, 20, 21), 19).applies).toBe(false);
    expect(
      logRowMenuTarget(held, [range(TOTAL - 2, TOTAL - 1)], commits(TOTAL - 2, TOTAL - 1), TOTAL - 1).applies,
    ).toBe(false);
  });

  it('covers no commit while the set’s commits are being read', () => {
    expect(logRowMenuTarget(held, [range(3, 5)], { kind: 'reading', count: 3 }, 4)).toEqual({
      shas: null,
      child: null,
      parent: null,
      applies: false,
    });
  });

  it('covers no commit past the most that are read together', () => {
    expect(logRowMenuTarget(held, [range(0, 140), range(145, 149)], { kind: 'over', count: 146 }, 147)).toEqual({
      shas: null,
      child: null,
      parent: null,
      applies: false,
    });
  });
});
