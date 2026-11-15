/**
 * The commits of the rows a log has selected
 * (`panels/git/log-selected-commits`): kept apart from the pages the
 * list draws from, taken from a held page or read from the host in as
 * few reads as cover the missing rows, one list's alone — and past the
 * most read together, a number of rows and nothing more.
 */

import type { WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import type { RowRange } from '@openheaders/ui/shared/selection';
import {
  LOG_PAGE_ROWS,
  type LogRowPages,
  type LogRowsAnswer,
  type LogRowsAsk,
  NO_LOG_ROWS,
  takeLogRows,
} from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import {
  keepSelectedCommits,
  NO_SELECTED_COMMITS,
  nextSelectedRead,
  SELECTED_COMMITS_MAX,
  type SelectedCommits,
  selectedCommitRows,
  selectedSet,
  takeSelectedRows,
} from '@openheaders/ui/workbench/components/panels/git/log-selected-commits';
import { describe, expect, it } from 'vitest';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };
const OTHER: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true, noMerges: true };

const sha = (row: number): string => row.toString(16).padStart(40, '0');

function row(at: number, list: string): WorkspaceTreeLogRowWire {
  return {
    entry: {
      sha: sha(at),
      parents: [sha(at + 1)],
      authorName: 'John Doe',
      authorEmail: 'john@openheaders.io',
      authoredAt: '2026-11-15T10:00:00.000Z',
      subject: `${list} commit ${at}`,
      coAuthors: [],
      files: [],
    },
    cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
    parents: [at + 1],
    child: at - 1,
  };
}

/** The host's answer to a read of `count` rows from `from` of a list of 100,000 it names `list`. */
function answer(from: number, count: number, list = 'g1'): LogRowsAnswer {
  const rows: WorkspaceTreeLogRowWire[] = [];
  for (let at = from; at < Math.min(100_000, from + count); at += 1) rows.push(row(at, list));
  return { ok: true, list, total: 100_000, widest: 1, rows, runs: [] };
}

/** The list with the named pages held, under the two names given. */
function holding(pages: number[], ask = ASK, list = 'g1'): LogRowPages {
  let held = NO_LOG_ROWS;
  for (const page of pages) {
    const from = page * LOG_PAGE_ROWS;
    held = takeLogRows(held, ask, from, answer(from, LOG_PAGE_ROWS, list), { first: from, last: from + 30 });
  }
  return held;
}

const range = (first: number, last: number): RowRange => ({ first, last });
const subjects = (kept: SelectedCommits): [number, string][] =>
  [...kept.commits].map(([at, entry]) => [at, entry.subject]);

describe('the rows whose commits are read', () => {
  it('are the selected rows, in list order', () => {
    expect(selectedCommitRows([range(3, 5), range(9, 9)])).toEqual([3, 4, 5, 9]);
    expect(selectedCommitRows([])).toEqual([]);
  });

  it('are every one of as many as are read together, and none of one more', () => {
    expect(selectedCommitRows([range(10, 10 + SELECTED_COMMITS_MAX - 1)])).toHaveLength(SELECTED_COMMITS_MAX);
    expect(selectedCommitRows([range(10, 10 + SELECTED_COMMITS_MAX)])).toEqual([]);
    expect(selectedCommitRows([range(0, 99), range(500, 600)])).toEqual([]);
  });
});

describe('the commits kept for the rows selected', () => {
  it('takes a selected row’s commit from its page, under the held list’s two names', () => {
    const kept = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [3, 4]);
    expect(kept).toMatchObject({ ask: ASK, list: 'g1' });
    expect(subjects(kept)).toEqual([
      [3, 'g1 commit 3'],
      [4, 'g1 commit 4'],
    ]);
  });

  it('keeps none for a row whose page is not held', () => {
    expect(subjects(keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [3, 4_000]))).toEqual([[3, 'g1 commit 3']]);
  });

  it('takes the held list’s names before any commit is kept — the read’s answer is that list’s', () => {
    const kept = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [4_000]);
    expect(kept).toMatchObject({ ask: ASK, list: 'g1' });
    expect(kept.commits.size).toBe(0);
    expect(subjects(takeSelectedRows(kept, ASK, 4_000, answer(4_000, 1), [4_000]))).toEqual([
      [4_000, 'g1 commit 4000'],
    ]);
  });

  it('keeps a commit once its page is let go', () => {
    const kept = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [3]);
    expect(subjects(keepSelectedCommits(kept, holding([40]), [3]))).toEqual([[3, 'g1 commit 3']]);
  });

  it('lets go of a row no longer selected', () => {
    const kept = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [3, 4, 5]);
    expect(subjects(keepSelectedCommits(kept, holding([0]), [4]))).toEqual([[4, 'g1 commit 4']]);
  });

  it('drops another list’s commits whole — another ask, or another id of the host’s', () => {
    const kept = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [3, 4]);
    const asked = keepSelectedCommits(kept, holding([40], OTHER), [3, 4]);
    expect(asked).toMatchObject({ ask: OTHER, list: 'g1' });
    expect(asked.commits.size).toBe(0);
    const anew = keepSelectedCommits(kept, holding([0], ASK, 'g2'), [3, 4]);
    expect(anew).toMatchObject({ ask: ASK, list: 'g2' });
    expect(subjects(anew)).toEqual([
      [3, 'g2 commit 3'],
      [4, 'g2 commit 4'],
    ]);
  });

  it('is the same object while nothing of it changed', () => {
    const kept = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [3, 4_000]);
    expect(keepSelectedCommits(kept, holding([0, 1]), [3, 4_000])).toBe(kept);
    expect(keepSelectedCommits(kept, holding([0]), [3, 4_000, 4])).not.toBe(kept);
    expect(keepSelectedCommits(kept, holding([0]), [4_000])).not.toBe(kept);
    // One row let go and one taken: as many kept, and not the same ones.
    expect(subjects(keepSelectedCommits(kept, holding([0]), [5, 4_000]))).toEqual([[5, 'g1 commit 5']]);
  });
});

describe('the stretch to read next', () => {
  const keptOf = (rows: number[], pages: number[] = []): SelectedCommits =>
    keepSelectedCommits(NO_SELECTED_COMMITS, holding(pages), rows);

  it('is none when every selected row’s commit is kept, or none is selected', () => {
    expect(nextSelectedRead(keptOf([3, 4], [0]), [3, 4])).toBeNull();
    expect(nextSelectedRead(NO_SELECTED_COMMITS, [])).toBeNull();
  });

  it('is one run of missing rows, end to end', () => {
    expect(nextSelectedRead(keptOf([5_000, 5_001, 5_002]), [5_000, 5_001, 5_002])).toEqual({ from: 5_000, count: 3 });
    expect(nextSelectedRead(keptOf([5_000]), [5_000])).toEqual({ from: 5_000, count: 1 });
  });

  it('starts at the first missing row, past the kept ones before it', () => {
    expect(nextSelectedRead(keptOf([3, 4, 900, 901], [0]), [3, 4, 900, 901])).toEqual({ from: 900, count: 2 });
  });

  it('covers missing rows apart in one read, as far as a read reaches', () => {
    expect(nextSelectedRead(keptOf([1_000, 1_100, 1_399]), [1_000, 1_100, 1_399])).toEqual({ from: 1_000, count: 400 });
    expect(nextSelectedRead(keptOf([1_000, 1_100, 1_400]), [1_000, 1_100, 1_400])).toEqual({ from: 1_000, count: 101 });
  });

  it('ends on the last missing row it covers — a kept row past it is not read for', () => {
    expect(nextSelectedRead(keptOf([1_000, 1_001, 150], [0]), [150, 1_000, 1_001])).toEqual({ from: 1_000, count: 2 });
    expect(nextSelectedRead(keptOf([1_000, 1_250, 1_210], [6]), [1_000, 1_210, 1_250])).toEqual({
      from: 1_000,
      count: 1,
    });
  });
});

describe('the host’s answer to a read for the selection', () => {
  const kept = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [3, 1_000, 1_002]);

  it('gives the selected rows among the ones it sent their commits, and no other row one', () => {
    const taken = takeSelectedRows(kept, ASK, 1_000, answer(1_000, 3), [3, 1_000, 1_002]);
    expect(subjects(taken)).toEqual([
      [3, 'g1 commit 3'],
      [1_000, 'g1 commit 1000'],
      [1_002, 'g1 commit 1002'],
    ]);
    expect(nextSelectedRead(taken, [3, 1_000, 1_002])).toBeNull();
  });

  it('leaves a selected row it did not reach, on either side, for a read of its own', () => {
    const taken = takeSelectedRows(kept, ASK, 1_001, answer(1_001, 1), [3, 1_000, 1_002]);
    expect(taken.commits.has(1_000)).toBe(false);
    expect(taken.commits.has(1_002)).toBe(false);
  });

  it('changes nothing when it answers for another ask, or for another id of the host’s', () => {
    expect(takeSelectedRows(kept, OTHER, 1_000, answer(1_000, 3), [3, 1_000, 1_002])).toBe(kept);
    expect(takeSelectedRows(kept, ASK, 1_000, answer(1_000, 3, 'g2'), [3, 1_000, 1_002])).toBe(kept);
  });
});

describe('the selection as its readers take it', () => {
  const kept = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0]), [3, 4, 9]);

  it('is none with no row selected', () => {
    expect(selectedSet(kept, [])).toEqual({ kind: 'none' });
  });

  it('is the selected rows’ commits in list order once each is kept', () => {
    const set = selectedSet(kept, [range(3, 4), range(9, 9)]);
    expect(set.kind).toBe('commits');
    expect(set.kind === 'commits' ? set.entries.map((entry) => entry.sha) : []).toEqual([sha(3), sha(4), sha(9)]);
  });

  it('is being read while one selected row’s commit is not kept', () => {
    expect(selectedSet(kept, [range(3, 5)])).toEqual({ kind: 'reading', count: 3 });
  });

  it('is a number of rows and no more past the most read together', () => {
    const most = keepSelectedCommits(NO_SELECTED_COMMITS, holding([0, 1]), selectedCommitRows([range(0, 199)]));
    expect(selectedSet(most, [range(0, SELECTED_COMMITS_MAX - 1)]).kind).toBe('commits');
    expect(selectedSet(most, [range(0, SELECTED_COMMITS_MAX)])).toEqual({
      kind: 'over',
      count: SELECTED_COMMITS_MAX + 1,
    });
    expect(selectedSet(NO_SELECTED_COMMITS, [range(0, 999_999)])).toEqual({ kind: 'over', count: 1_000_000 });
  });
});
